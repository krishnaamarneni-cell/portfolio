import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchProjects, createProject } from "@/lib/content";
import { EMPTY_PROJECT } from "@/lib/content-types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await fetchProjects();
    return NextResponse.json({ projects });
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
    ...EMPTY_PROJECT,
    ...body,
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
  };
  try {
    const project = await createProject(input);
    return NextResponse.json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
