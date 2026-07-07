import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { readMemoryForAgent } from "@/lib/memory";
import {
  createTask,
  updateTask,
  startRun,
  finishRun,
  getAgent,
  type AgentRegistryEntry,
} from "@/lib/task-thread";
import { runAgent, resolveAgentModel } from "@/lib/agents";

// ─── Types ────────────────────────────────────────────────────────

export type OrchestratorRequest = {
  goal: string;
  agentSlug?: string;
  parentTaskId?: string;
  context?: Record<string, unknown>;
  maxTokens?: number;
  systemPromptOverride?: string;
};

export type OrchestratorResult = {
  ok: boolean;
  taskId: string;
  runId?: string;
  agentSlug: string;
  modelUsed?: string;
  content?: string;
  error?: string;
  needsApproval?: boolean;
  approvalId?: string;
};

// ─── Routing ──────────────────────────────────────────────────────

const SLUG_KEYWORDS: Record<string, string[]> = {
  career: ["resume", "job", "interview", "career", "linkedin", "apply"],
  research: ["research", "learn", "study", "paper", "topic"],
  email: ["email", "draft", "reply", "inbox", "message"],
  finance: ["finance", "invest", "stock", "portfolio", "budget", "expense"],
  visibility: ["blog", "post", "twitter", "content", "social", "seo"],
  news: ["news", "headline", "market", "morning", "briefing"],
  life: ["habit", "reading", "personal", "visa", "birthday", "reminder"],
  legal: ["contract", "nda", "agreement", "compliance", "legal"],
};

function routeToAgent(goal: string): string {
  const lower = goal.toLowerCase();
  let best: { slug: string; hits: number } = { slug: "research", hits: 0 };
  for (const [slug, kws] of Object.entries(SLUG_KEYWORDS)) {
    const hits = kws.filter((kw) => lower.includes(kw)).length;
    if (hits > best.hits) best = { slug, hits };
  }
  return best.slug;
}

// ─── Approval Check ───────────────────────────────────────────────

async function requiresApproval(
  agent: AgentRegistryEntry,
  goal: string
): Promise<boolean> {
  if (agent.requires_approval) return true;
  if (agent.risk_level === "high") return true;
  const dangerWords = ["delete", "send", "publish", "transfer", "remove"];
  if (dangerWords.some((w) => goal.toLowerCase().includes(w))) return true;
  return false;
}

async function createApprovalRequest(
  taskId: string,
  agentSlug: string,
  goal: string,
  risk: string
): Promise<string> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("approval_queue")
    .insert({
      task_id: taskId,
      agent_slug: agentSlug,
      action_summary: goal.slice(0, 500),
      risk_level: risk,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

// ─── Orchestrator ─────────────────────────────────────────────────

export async function orchestrate(
  req: OrchestratorRequest
): Promise<OrchestratorResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { ok: false, taskId: "", agentSlug: "", error: "Missing GROQ_API_KEY" };
  }

  // 1. Route to the right agent
  const slug = req.agentSlug ?? routeToAgent(req.goal);
  const agent = await getAgent(slug);
  const model = resolveAgentModel(agent?.model);

  // 2. Create task
  const task = await createTask({
    title: req.goal.slice(0, 200),
    goal: req.goal,
    agent_slug: slug,
    parent_id: req.parentTaskId,
    context: req.context ?? {},
  });

  // 3. Approval gate
  if (agent && (await requiresApproval(agent, req.goal))) {
    const approvalId = await createApprovalRequest(
      task.id,
      slug,
      req.goal,
      agent.risk_level
    );
    await updateTask(task.id, { status: "waiting" });
    return {
      ok: true,
      taskId: task.id,
      agentSlug: slug,
      needsApproval: true,
      approvalId,
    };
  }

  // 4. Build memory context
  let memoryContext = "";
  try {
    memoryContext = await readMemoryForAgent(slug);
  } catch {
    // No memory tables yet — continue without context
  }

  // 5. Build system prompt
  const systemPrompt =
    req.systemPromptOverride ??
    buildSystemPrompt(agent, memoryContext);

  // 6. Start run log
  const t0 = Date.now();
  let runId: string | undefined;
  try {
    const run = await startRun({
      agent_slug: slug,
      task_id: task.id,
      goal: req.goal,
      model,
    });
    runId = run.id;
  } catch {
    // DB not migrated yet — continue without logging
  }

  // 7. Run the agent
  const result = await runAgent({
    apiKey,
    model,
    systemPrompt,
    userPrompt: req.goal,
    maxTokens: req.maxTokens ?? (agent?.max_tokens || 4096),
  });

  // 8. Finish run log
  if (runId) {
    finishRun(runId, {
      status: result.ok ? "success" : "failed",
      output: result.content?.slice(0, 10_000),
      error: result.error,
      latency_ms: Date.now() - t0,
    }).catch(() => {});
  }

  // 9. Update task status
  await updateTask(task.id, {
    status: result.ok ? "done" : "failed",
  });

  return {
    ok: result.ok,
    taskId: task.id,
    runId,
    agentSlug: slug,
    modelUsed: result.modelUsed,
    content: result.content,
    error: result.error,
  };
}

// ─── System Prompt Builder ────────────────────────────────────────

function buildSystemPrompt(
  agent: AgentRegistryEntry | null,
  memoryContext: string
): string {
  const parts: string[] = [];

  if (agent?.system_prompt) {
    parts.push(agent.system_prompt);
  } else {
    parts.push(
      `You are ${agent?.name ?? "a helpful assistant"}.` +
      (agent?.role ? ` Your role: ${agent.role}` : "")
    );
  }

  parts.push(
    "Respond in clear markdown. Be direct and actionable.",
    "If you need more information to complete the task, say so explicitly."
  );

  if (memoryContext) {
    parts.push("\n---\n" + memoryContext);
  }

  return parts.join("\n\n");
}

// ─── Approval Resolution ──────────────────────────────────────────

export async function resolveApproval(
  approvalId: string,
  decision: "approved" | "rejected",
  reviewerNote?: string
): Promise<OrchestratorResult | null> {
  const db = requireSupabaseAdmin();

  const { data: approval, error } = await db
    .from("approval_queue")
    .update({
      status: decision,
      reviewed_at: new Date().toISOString(),
      reviewer_note: reviewerNote ?? null,
    })
    .eq("id", approvalId)
    .eq("status", "pending")
    .select("task_id, agent_slug, action_summary")
    .single();

  if (error || !approval) return null;

  if (decision === "rejected") {
    await updateTask(approval.task_id, { status: "failed" });
    return {
      ok: false,
      taskId: approval.task_id,
      agentSlug: approval.agent_slug,
      error: "Rejected by reviewer" + (reviewerNote ? `: ${reviewerNote}` : ""),
    };
  }

  // Approved — execute the task now
  return orchestrate({
    goal: approval.action_summary,
    agentSlug: approval.agent_slug,
  });
}
