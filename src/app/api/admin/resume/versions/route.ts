import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  listVersions,
  getVersion,
  updateVersion,
  deleteVersion,
} from "@/lib/resume";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const versions = await listVersions();
    return NextResponse.json({ versions });
  } catch {
    return NextResponse.json({ versions: [] });
  }
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.action === "get" && typeof body.id === "string") {
    const version = await getVersion(body.id);
    if (!version) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ version });
  }

  if (body.action === "update" && typeof body.id === "string") {
    const version = await updateVersion(body.id, body.patch as Record<string, unknown>);
    return NextResponse.json({ version });
  }

  if (body.action === "delete" && typeof body.id === "string") {
    await deleteVersion(body.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
