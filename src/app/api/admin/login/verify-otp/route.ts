import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import {
  clearPreauthCookie,
  readPreauthCookie,
  verifyLoginCode,
} from "@/lib/totp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const code = (body.code ?? "").trim();
  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }
  // Make sure the password step really happened — without a valid pre-auth
  // cookie there's nothing to grant.
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
  // Grant the actual admin session, drop the pre-auth crumbs.
  await setSessionCookie(email);
  await clearPreauthCookie();
  return NextResponse.json({
    ok: true,
    usedBackup: result.usedBackup,
  });
}
