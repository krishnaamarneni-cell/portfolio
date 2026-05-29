import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  type GenerateRegistrationOptionsOpts,
  type GenerateAuthenticationOptionsOpts,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { requireSupabaseAdmin } from "@/lib/supabase";

/* ─────────────── RP / origin config ─────────────── */

function siteOrigin(): string {
  const v =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://krishnaamarneni.com");
  return v.replace(/\/$/, "");
}

function rpId(): string {
  // WebAuthn needs the bare hostname (no scheme, no port). Localhost is fine.
  try {
    const u = new URL(siteOrigin());
    return u.hostname;
  } catch {
    return "krishnaamarneni.com";
  }
}

const RP_NAME = "Krishna Admin";

/* ─────────────── Challenge cookie (signed, short-lived) ─────────────── */

const CHALLENGE_COOKIE = "ka_webauthn_challenge";
const CHALLENGE_TTL_SECONDS = 5 * 60;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET missing");
  return s;
}
function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

async function setChallengeCookie(challenge: string, flow: "register" | "login"): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SECONDS;
  const payload = `${flow}|${challenge}|${exp}`;
  const value = `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
  const store = await cookies();
  store.set(CHALLENGE_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CHALLENGE_TTL_SECONDS,
  });
}
async function readChallengeCookie(
  expectedFlow: "register" | "login"
): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(CHALLENGE_COOKIE)?.value;
  if (!raw) return null;
  const [b64, sig] = raw.split(".");
  if (!b64 || !sig) return null;
  let payload: string;
  try {
    payload = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = sign(payload);
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  const [flow, challenge, expStr] = payload.split("|");
  if (flow !== expectedFlow) return null;
  if (!challenge) return null;
  if (Math.floor(Date.now() / 1000) > Number(expStr)) return null;
  return challenge;
}
export async function clearChallengeCookie(): Promise<void> {
  const store = await cookies();
  store.delete(CHALLENGE_COOKIE);
}

/* ─────────────── Credentials store ─────────────── */

export type WebAuthnCredentialRow = {
  id: string;
  public_key: string;
  counter: number;
  device_label: string | null;
  transports: string[];
  created_at: string;
  last_used_at: string | null;
};

export async function listCredentials(): Promise<WebAuthnCredentialRow[]> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from("webauthn_credentials")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as WebAuthnCredentialRow[];
}

export async function deleteCredential(id: string): Promise<void> {
  const supabase = requireSupabaseAdmin();
  await supabase.from("webauthn_credentials").delete().eq("id", id);
}

/* ─────────────── Registration ─────────────── */

export async function startRegistration(email: string): Promise<unknown> {
  // Stack the existing credential IDs so the OS doesn't enroll the same authenticator twice.
  const existing = await listCredentials();
  const opts: GenerateRegistrationOptionsOpts = {
    rpName: RP_NAME,
    rpID: rpId(),
    userName: email,
    userDisplayName: email,
    attestationType: "none",
    authenticatorSelection: {
      // "platform" = Face ID / Touch ID / Windows Hello (not USB security keys).
      authenticatorAttachment: "platform",
      residentKey: "preferred",
      userVerification: "required",
    },
    excludeCredentials: existing.map((c) => ({
      id: c.id,
      transports: (c.transports as Array<
        "ble" | "internal" | "nfc" | "usb" | "cable" | "hybrid"
      >),
    })),
  };
  const options = await generateRegistrationOptions(opts);
  await setChallengeCookie(options.challenge, "register");
  return options;
}

export async function finishRegistration(
  response: RegistrationResponseJSON,
  label?: string
): Promise<{ ok: boolean; error?: string }> {
  const expectedChallenge = await readChallengeCookie("register");
  if (!expectedChallenge) {
    return { ok: false, error: "Challenge expired — start again." };
  }
  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: siteOrigin(),
      expectedRPID: rpId(),
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Verification failed",
    };
  }
  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false, error: "Verification failed" };
  }
  const info = verification.registrationInfo;
  // simplewebauthn v11+ uses `credential` nested under registrationInfo.
  const cred = (info as unknown as {
    credential: { id: string; publicKey: Uint8Array; counter: number };
  }).credential;
  const supabase = requireSupabaseAdmin();
  await supabase.from("webauthn_credentials").upsert({
    id: cred.id,
    public_key: Buffer.from(cred.publicKey).toString("base64"),
    counter: cred.counter,
    device_label: label ?? null,
    transports: response.response.transports ?? [],
    created_at: new Date().toISOString(),
  });
  await clearChallengeCookie();
  return { ok: true };
}

/* ─────────────── Authentication ─────────────── */

export async function startAuthentication(): Promise<unknown> {
  const credentials = await listCredentials();
  if (credentials.length === 0) {
    throw new Error("No Face Lock enrolled — set one up in Settings first.");
  }
  const opts: GenerateAuthenticationOptionsOpts = {
    rpID: rpId(),
    userVerification: "required",
    allowCredentials: credentials.map((c) => ({
      id: c.id,
      transports: (c.transports as Array<
        "ble" | "internal" | "nfc" | "usb" | "cable" | "hybrid"
      >),
    })),
  };
  const options = await generateAuthenticationOptions(opts);
  await setChallengeCookie(options.challenge, "login");
  return options;
}

export async function finishAuthentication(
  response: AuthenticationResponseJSON
): Promise<{ ok: boolean; error?: string }> {
  const expectedChallenge = await readChallengeCookie("login");
  if (!expectedChallenge) {
    return { ok: false, error: "Challenge expired — start again." };
  }
  const supabase = requireSupabaseAdmin();
  const { data: cred } = await supabase
    .from("webauthn_credentials")
    .select("*")
    .eq("id", response.id)
    .maybeSingle();
  if (!cred) return { ok: false, error: "Credential not recognised" };
  let verification: VerifiedAuthenticationResponse;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: siteOrigin(),
      expectedRPID: rpId(),
      credential: {
        id: cred.id,
        publicKey: Buffer.from(cred.public_key, "base64"),
        counter: cred.counter,
        transports: cred.transports,
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Verification failed",
    };
  }
  if (!verification.verified) return { ok: false, error: "Verification failed" };
  // Bump counter + last-used to defend against cloned authenticators.
  await supabase
    .from("webauthn_credentials")
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", cred.id);
  await clearChallengeCookie();
  return { ok: true };
}

export async function hasAnyCredential(): Promise<boolean> {
  const supabase = requireSupabaseAdmin();
  const { count } = await supabase
    .from("webauthn_credentials")
    .select("*", { count: "exact", head: true });
  return (count ?? 0) > 0;
}
