import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import {
  createSupabaseServerClient,
  isSupabaseAuthConfigured,
} from "./supabase-ssr";

const COOKIE_NAME = "ka_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

function adminEmail(): string {
  return (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
}

/**
 * Returns true if Supabase Auth should be the primary auth backend.
 * When false, the legacy env-based password hash is used.
 */
export function useSupabaseAuth(): boolean {
  return isSupabaseAuthConfigured();
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET is missing or too short — set a random 32+ char value in .env.local."
    );
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function verifyCredentials(email: string, password: string): boolean {
  const expectedEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const expectedHash = (process.env.ADMIN_PASSWORD_HASH ?? "").trim().toLowerCase();
  if (!expectedEmail || !expectedHash) return false;
  if (email.trim().toLowerCase() !== expectedEmail) return false;
  const actualHash = sha256(password);
  return safeEqual(actualHash, expectedHash);
}

export function buildSessionToken(email: string): { token: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${email.toLowerCase()}|${exp}`;
  const sig = sign(payload);
  const token = `${Buffer.from(payload).toString("base64url")}.${sig}`;
  return { token, maxAge: SESSION_TTL_SECONDS };
}

export function parseSessionToken(token: string | undefined | null): {
  email: string;
} | null {
  if (!token) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  let payload: string;
  try {
    payload = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = sign(payload);
  if (!safeEqual(sig, expected)) return null;
  const [email, expStr] = payload.split("|");
  const exp = Number(expStr);
  if (!email || !exp || Number.isNaN(exp)) return null;
  if (Math.floor(Date.now() / 1000) > exp) return null;
  return { email };
}

export async function getSession(): Promise<{ email: string } | null> {
  // Try Supabase Auth first if configured.
  if (useSupabaseAuth()) {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        const expected = adminEmail();
        // If ADMIN_EMAIL is set, only that user is the admin. Otherwise any
        // authenticated Supabase user counts (single-tenant deployments).
        if (!expected || user.email.toLowerCase() === expected) {
          return { email: user.email };
        }
      }
    } catch {
      // fall through to legacy
    }
  }
  // Legacy HMAC cookie fallback (works when Supabase isn't configured).
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  return parseSessionToken(raw);
}

export async function setSessionCookie(email: string): Promise<void> {
  const { token, maxAge } = buildSessionToken(email);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function requireSession(): Promise<{ email: string }> {
  const session = await getSession();
  if (!session) {
    throw new AuthError("Unauthorized");
  }
  return session;
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
