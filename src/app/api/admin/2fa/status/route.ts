import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTotpStatus } from "@/lib/totp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = await getTotpStatus();
  return NextResponse.json({ status });
}
