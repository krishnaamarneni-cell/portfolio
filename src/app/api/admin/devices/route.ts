import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listTrustedDevices, revokeAllTrustedDevices } from "@/lib/trusted-devices";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const devices = await listTrustedDevices();
  return NextResponse.json({ devices });
}

export async function DELETE() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await revokeAllTrustedDevices();
  return NextResponse.json({ ok: true });
}
