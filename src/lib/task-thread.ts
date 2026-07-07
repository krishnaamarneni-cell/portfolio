import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────

export type TaskStatus = "open" | "in_progress" | "waiting" | "done" | "failed";

export type AgentTask = {
  id: string;
  parent_id: string | null;
  title: string;
  goal: string | null;
  status: TaskStatus;
  agent_slug: string | null;
  artifacts: unknown[];
  context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type RunStatus = "running" | "success" | "failed" | "cancelled";

export type AgentRun = {
  id: string;
  task_id: string | null;
  agent_slug: string;
  parent_run_id: string | null;
  goal: string | null;
  model: string;
  temperature: number | null;
  prompt_hash: string | null;
  tools_used: string[];
  tool_calls: unknown[];
  memory_reads: unknown[];
  memory_writes: unknown[];
  scratchpad: Record<string, unknown>;
  output: string | null;
  output_format: string;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  status: RunStatus;
  error: string | null;
  quality_score: number | null;
  anomaly_flags: string[];
  created_at: string;
  finished_at: string | null;
};

// ─── Task CRUD ────────────────────────────────────────────────────

export async function createTask(input: {
  title: string;
  goal?: string;
  agent_slug?: string;
  parent_id?: string;
  context?: Record<string, unknown>;
}): Promise<AgentTask> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("agent_tasks")
    .insert({
      title: input.title,
      goal: input.goal ?? null,
      agent_slug: input.agent_slug ?? null,
      parent_id: input.parent_id ?? null,
      context: input.context ?? {},
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AgentTask;
}

export async function getTask(id: string): Promise<AgentTask | null> {
  const db = requireSupabaseAdmin();
  const { data } = await db
    .from("agent_tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as AgentTask) ?? null;
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<AgentTask, "status" | "title" | "goal" | "artifacts" | "context">>
): Promise<AgentTask> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("agent_tasks")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AgentTask;
}

export async function listTasks(opts?: {
  status?: TaskStatus;
  agent_slug?: string;
  limit?: number;
}): Promise<AgentTask[]> {
  const db = requireSupabaseAdmin();
  let q = db
    .from("agent_tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.agent_slug) q = q.eq("agent_slug", opts.agent_slug);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentTask[];
}

// ─── Run Logging ──────────────────────────────────────────────────

export async function startRun(input: {
  agent_slug: string;
  task_id?: string;
  parent_run_id?: string;
  goal?: string;
  model: string;
  temperature?: number;
  prompt_hash?: string;
}): Promise<AgentRun> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("agent_runs")
    .insert({
      agent_slug: input.agent_slug,
      task_id: input.task_id ?? null,
      parent_run_id: input.parent_run_id ?? null,
      goal: input.goal ?? null,
      model: input.model,
      temperature: input.temperature ?? null,
      prompt_hash: input.prompt_hash ?? null,
      status: "running",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (input.task_id) {
    await db
      .from("agent_tasks")
      .update({ status: "in_progress" })
      .eq("id", input.task_id)
      .eq("status", "open");
  }

  return data as AgentRun;
}

export async function finishRun(
  runId: string,
  result: {
    status: "success" | "failed" | "cancelled";
    output?: string;
    output_format?: string;
    tokens_in?: number;
    tokens_out?: number;
    cost_usd?: number;
    latency_ms?: number;
    tools_used?: string[];
    tool_calls?: unknown[];
    memory_reads?: unknown[];
    memory_writes?: unknown[];
    scratchpad?: Record<string, unknown>;
    error?: string;
    quality_score?: number;
    anomaly_flags?: string[];
  }
): Promise<AgentRun> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("agent_runs")
    .update({
      status: result.status,
      output: result.output ?? null,
      output_format: result.output_format ?? "markdown",
      tokens_in: result.tokens_in ?? null,
      tokens_out: result.tokens_out ?? null,
      cost_usd: result.cost_usd ?? null,
      latency_ms: result.latency_ms ?? null,
      tools_used: result.tools_used ?? [],
      tool_calls: result.tool_calls ?? [],
      memory_reads: result.memory_reads ?? [],
      memory_writes: result.memory_writes ?? [],
      scratchpad: result.scratchpad ?? {},
      error: result.error ?? null,
      quality_score: result.quality_score ?? null,
      anomaly_flags: result.anomaly_flags ?? [],
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AgentRun;
}

export async function getRunsForTask(taskId: string): Promise<AgentRun[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("agent_runs")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentRun[];
}

export async function listRecentRuns(opts?: {
  agent_slug?: string;
  limit?: number;
}): Promise<AgentRun[]> {
  const db = requireSupabaseAdmin();
  let q = db
    .from("agent_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 20);
  if (opts?.agent_slug) q = q.eq("agent_slug", opts.agent_slug);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentRun[];
}

// ─── Agent Registry ───────────────────────────────────────────────

export type AgentRegistryEntry = {
  id: string;
  slug: string;
  name: string;
  role: string;
  model: string;
  temperature: number;
  max_tokens: number;
  tools: string[];
  memory_read: string[];
  memory_write: string[];
  rag_domains: string[];
  risk_level: "low" | "medium" | "high";
  requires_approval: boolean;
  cost_ceiling_usd: number;
  system_prompt: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export async function getAgent(slug: string): Promise<AgentRegistryEntry | null> {
  const db = requireSupabaseAdmin();
  const { data } = await db
    .from("agent_registry")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  return (data as AgentRegistryEntry) ?? null;
}

export async function listAgents(): Promise<AgentRegistryEntry[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("agent_registry")
    .select("*")
    .eq("active", true)
    .order("slug");
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentRegistryEntry[];
}
