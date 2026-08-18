import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { parseNote } from "@/lib/note-parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Read one written note and return the structured fields for it.
 *
 * Deliberately does not save. The parse is a suggestion the person confirms or
 * edits before it becomes a note — an inferred date that is silently wrong is
 * worse than no date, because nothing then prompts anyone to check it.
 */
export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY is not set" }, { status: 503 });
  }

  const { body } = (await request.json().catch(() => ({}))) as { body?: string };
  if (!body?.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const res = await parseNote(apiKey, body.trim());
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });

  return NextResponse.json({ ok: true, ...res.parsed });
}
