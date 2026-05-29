import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/admin/voice/transcribe — multipart/form-data with a single "file"
 * audio blob (webm/m4a/mp3/wav). We pipe it to Groq's whisper-large-v3-turbo
 * and return the plain transcript.
 *
 * Groq is OpenAI-compatible at /openai/v1/audio/transcriptions, so we just
 * forward the FormData with the model field added.
 */
export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY not set" },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "file field is required" }, { status: 400 });
  }
  // Whisper free quota is generous but cap upload to ~10MB for safety.
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Audio too large — keep recordings under 10MB" },
      { status: 413 }
    );
  }

  const upstream = new FormData();
  upstream.set("file", file, "audio.webm");
  upstream.set("model", "whisper-large-v3-turbo");
  upstream.set("response_format", "json");
  // Auto-detect language; user can override later if we ever expose it.

  const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upstream,
    cache: "no-store",
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return NextResponse.json(
      { error: `Groq Whisper ${r.status}: ${text.slice(0, 200)}` },
      { status: 502 }
    );
  }
  const j = (await r.json()) as { text?: string };
  return NextResponse.json({ text: j.text ?? "" });
}
