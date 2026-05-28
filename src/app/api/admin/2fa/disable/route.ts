import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { disableTotp } from "@/lib/totp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { code?: string };
  if (!body.code) {
    return NextResponse.json({ error: "Code required" }, { status: 400 });
  }
  const result = await disableTotp(body.code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
