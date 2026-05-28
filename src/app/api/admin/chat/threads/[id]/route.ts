import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  deleteThread,
  getThread,
  getThreadMessages,
  updateThread,
} from "@/lib/chat-history";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const thread = await getThread(id);
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const messages = await getThreadMessages(id);
  return NextResponse.json({ thread, messages });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    pinned?: boolean;
    archived?: boolean;
  };
  try {
    const thread = await updateThread(id, body);
    return NextResponse.json({ thread });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  await deleteThread(id);
  return NextResponse.json({ ok: true });
}
