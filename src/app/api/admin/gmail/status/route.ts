import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteStoredTokens, getOAuthEnv, getStoredTokens } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const env = getOAuthEnv();
  const row = await getStoredTokens().catch(() => null);
  return NextResponse.json({
    configured: !!env,
    connected: !!row?.access_token,
    email: row?.email ?? null,
    expiresAt: row?.expires_at ?? null,
    redirectUri: env?.redirectUri ?? null,
  });
}

export async function DELETE() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await deleteStoredTokens();
  return NextResponse.json({ ok: true });
}
