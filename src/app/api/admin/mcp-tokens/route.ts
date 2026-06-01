import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createToken, listTokens, deleteToken } from "@/lib/mcp-tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tokens = await listTokens();
  return NextResponse.json({ tokens });
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.action === "delete" && typeof body.id === "string") {
    await deleteToken(body.id);
    return NextResponse.json({ ok: true });
  }

  // Generate new token.
  const name = (body.name as string) || "Unnamed";
  const expiryDays = typeof body.expiry_days === "number" ? body.expiry_days : undefined;
  const result = await createToken(name, expiryDays);
  return NextResponse.json(result);
}
