import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import {
  startAuthentication,
  finishAuthentication,
  hasAnyCredential,
} from "@/lib/webauthn";
import { checkRateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET → returns authentication options for the browser. Public endpoint
 *  (the user isn't signed in yet) — rate-limited per IP. */
export async function GET(request: Request) {
  const ip = clientIpFromRequest(request);
  const rl = await checkRateLimit({ ip, max: 10, windowSeconds: 300 }).catch(
    () => ({ allowed: true, remaining: 999, retryAfter: 0 })
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rl.retryAfter}s.` },
      { status: 429 }
    );
  }
  if (!(await hasAnyCredential())) {
    return NextResponse.json(
      { error: "No Face Lock set up yet — sign in with password first, then enable it in Settings." },
      { status: 404 }
    );
  }
  try {
    const options = await startAuthentication();
    return NextResponse.json({ options });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start" },
      { status: 500 }
    );
  }
}

/** POST → verify the assertion + grant a session. */
export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const rl = await checkRateLimit({ ip, max: 10, windowSeconds: 300 }).catch(
    () => ({ allowed: true, remaining: 999, retryAfter: 0 })
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rl.retryAfter}s.` },
      { status: 429 }
    );
  }
  const body = (await request.json().catch(() => ({}))) as {
    response?: AuthenticationResponseJSON;
  };
  if (!body.response) {
    return NextResponse.json({ error: "response required" }, { status: 400 });
  }
  const result = await finishAuthentication(body.response);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  // Face Lock proves possession AND user verification (Face ID), so it
  // counts as both first and second factor. Grant the session.
  const email = (process.env.ADMIN_EMAIL ?? "krishna").trim().toLowerCase();
  await setSessionCookie(email);
  return NextResponse.json({ ok: true });
}
