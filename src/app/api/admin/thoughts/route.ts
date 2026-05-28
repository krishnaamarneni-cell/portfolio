import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchAllThoughts, createThought } from "@/lib/content";
import { EMPTY_THOUGHT } from "@/lib/content-types";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const thoughts = await fetchAllThoughts();
    return NextResponse.json({ thoughts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const input = {
    ...EMPTY_THOUGHT,
    ...body,
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
  };
  try {
    const thought = await createThought(input);
    return NextResponse.json({ thought });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
