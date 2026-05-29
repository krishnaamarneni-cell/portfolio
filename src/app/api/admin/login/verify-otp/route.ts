import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import {
  clearPreauthCookie,
  readPreauthCookie,
  verifyLoginCode,
} from "@/lib/totp";
import { trustThisDevice } from "@/lib/trusted-devices";
import { clientIpFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { code?: string; trustDevice?: boolean; deviceLabel?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const code = (body.code ?? "").trim();
  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }
  const email = await readPreauthCookie();
  if (!email) {
    return NextResponse.json(
      { error: "Login expired — go back and enter your password again." },
      { status: 401 }
    );
  }
  const result = await verifyLoginCode(code);
  if (!result.ok) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  await setSessionCookie(email);
  await clearPreauthCookie();
  // Remember this device so the next 30 days of logins skip the OTP step.
  if (body.trustDevice) {
    const ip = clientIpFromRequest(request);
    const userAgent = request.headers.get("user-agent") ?? null;
    await trustThisDevice({
      label: body.deviceLabel,
      ip,
      userAgent: userAgent ?? undefined,
    }).catch(() => undefined);
  }
  return NextResponse.json({
    ok: true,
    usedBackup: result.usedBackup,
    trustedDevice: !!body.trustDevice,
  });
}
