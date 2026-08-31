import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolveModel } from "@/lib/groq-models";
import { COMPOSE_SYSTEM_PROMPT, extractPostJson } from "@/lib/social-prompt";
import { getPlaybook, playbookToPrompt } from "@/lib/social-playbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ComposeRequest = {
  topic?: string;
  hint?: string;
  voice?: string;
  audience?: string;
  goal?: string;
  tone?: string;
  model?: string;
};

const SYSTEM_PROMPT = COMPOSE_SYSTEM_PROMPT;

/**
 * The base rules plus whatever this account has actually learned.
 *
 * Returns the base prompt unchanged when there is no playbook yet or the
 * sample is too small to mean anything — better to write from general rules
 * than to chase a pattern drawn from three posts.
 */
async function systemPromptWithPlaybook(): Promise<string> {
  const learned = playbookToPrompt(await getPlaybook());
  return learned ? `${SYSTEM_PROMPT}

${learned}` : SYSTEM_PROMPT;
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not set in env." },
      { status: 503 }
    );
  }

  let body: ComposeRequest;
  try {
    body = (await request.json()) as ComposeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const topic = (body.topic ?? "").trim();
  if (!topic) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 });
  }

  const userMsg = [
    `Topic: ${topic}`,
    body.hint ? `Hint / direction: ${body.hint}` : "",
    body.audience ? `Target audience: ${body.audience}` : "",
    body.goal ? `Goal: ${body.goal}` : "",
    body.tone ? `Tone: ${body.tone}` : "",
    body.voice ? `Voice notes: ${body.voice}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { default: Groq } = await import("groq-sdk");
    const groq = new Groq({ apiKey });
    // Base rules plus whatever reach has actually taught this account.
    const systemPrompt = await systemPromptWithPlaybook();
    const model = resolveModel("writing", body.model);

    const run = (json: boolean) =>
      groq.chat.completions.create({
        model,
        temperature: 0.5,
        // Generous budget so three full posts + image fields never get cut off
        // mid-JSON (which Groq rejects with json_validate_failed).
        max_tokens: 4096,
        ...(json ? { response_format: { type: "json_object" as const } } : {}),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
        ],
      });

    // Strict JSON mode is cleaner, but small models occasionally overrun it and
    // Groq hard-fails the request. Fall back to a plain call + tolerant parse.
    let raw = "";
    try {
      const completion = await run(true);
      raw = completion.choices[0]?.message?.content ?? "";
    } catch {
      const completion = await run(false);
      raw = completion.choices[0]?.message?.content ?? "";
    }

    const parsed = extractPostJson(raw);
    if (!parsed) {
      return NextResponse.json(
        { error: "The model couldn't produce a clean draft. Try again or pick a stronger model." },
        { status: 502 }
      );
    }
    return NextResponse.json({
      linkedin: (parsed.linkedin ?? "").slice(0, 3000),
      x: (parsed.x ?? "").slice(0, 270),
      instagram: (parsed.instagram ?? "").slice(0, 2000),
      image_query: parsed.image_query ?? "",
      image_prompt: parsed.image_prompt ?? "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Groq request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
