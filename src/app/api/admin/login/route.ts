import { NextResponse } from "next/server";
import {
  verifyCredentials,
  setSessionCookie,
  useSupabaseAuth,
} from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import { getTotpStatus, setPreauthCookie } from "@/lib/totp";
import { checkRateLimit, clientIpFromRequest } from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Per-IP rate-limit BEFORE any expensive work — prevents brute-force
  // burning Supabase / TOTP cycles. 5 attempts per 5 minutes per IP.
  const ip = clientIpFromRequest(request);
  const rl = await checkRateLimit({ ip, max: 5, windowSeconds: 300 }).catch(
    () => ({ allowed: true, remaining: 999, retryAfter: 0 })
  );
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: `Too many login attempts. Try again in ${rl.retryAfter}s.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfter) },
      }
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  // Fail fast with a clear message if SESSION_SECRET isn't configured —
  // otherwise we'd 500 inside the cookie helpers with a stack trace.
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      {
        error:
          "SESSION_SECRET is not set in env (need 32+ random chars). " +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\" " +
          "and add it to Vercel env + .env.local.",
      },
      { status: 503 }
    );
  }

  const expectedAdmin = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();

  // ── Check 2FA status up front so the response can ask for the code ──
  const totp = await getTotpStatus().catch(() => null);

  if (useSupabaseAuth()) {
    if (expectedAdmin && email.toLowerCase() !== expectedAdmin) {
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json(
        { error: "This email is not the admin." },
        { status: 403 }
      );
    }
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.session) {
        await new Promise((r) => setTimeout(r, 500));
        return NextResponse.json(
          { error: error?.message || "Invalid email or password" },
          { status: 401 }
        );
      }
      // ── If 2FA is on, immediately sign out so the Supabase session ISN'T
      //    granted yet. Set a short-lived pre-auth cookie instead — the OTP
      //    verification step will re-establish the session. ──
      if (totp?.enabled) {
        await supabase.auth.signOut().catch(() => undefined);
        await setPreauthCookie(email);
        return NextResponse.json({
          ok: true,
          requires_otp: true,
          source: "supabase",
        });
      }
      return NextResponse.json({ ok: true, source: "supabase" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Legacy env-based auth
  if (!verifyCredentials(email, password)) {
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }
  if (totp?.enabled) {
    await setPreauthCookie(email);
    return NextResponse.json({
      ok: true,
      requires_otp: true,
      source: "env",
    });
  }
  await setSessionCookie(email);
  return NextResponse.json({ ok: true, source: "env" });
}
