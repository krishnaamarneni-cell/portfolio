import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchJobs, createJob } from "@/lib/content";
import { EMPTY_JOB } from "@/lib/content-types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const jobs = await fetchJobs();
    return NextResponse.json({ jobs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = {
    ...EMPTY_JOB,
    ...body,
    highlights: Array.isArray(body.highlights) ? (body.highlights as string[]) : [],
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
  };

  try {
    const job = await createJob(input);
    return NextResponse.json({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
