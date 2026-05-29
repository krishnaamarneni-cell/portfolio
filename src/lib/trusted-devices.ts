import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { sha256 } from "@/lib/auth";

const COOKIE_NAME = "ka_trusted_device";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET missing");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export type TrustedDevice = {
  id: string;
  token_hashed: string;
  device_label: string | null;
  ip: string | null;
  user_agent: string | null;
  last_used_at: string;
  created_at: string;
  expires_at: string;
};

/** Generate a new device token, store it (hashed), and set the cookie.
 *  Returns the row so the UI can confirm what was trusted. */
export async function trustThisDevice(opts: {
  label?: string;
  ip?: string;
  userAgent?: string;
}): Promise<TrustedDevice> {
  const supabase = requireSupabaseAdmin();
  const token = randomBytes(32).toString("base64url");
  const tokenHashed = sha256(token);
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
  const { data, error } = await supabase
    .from("trusted_devices")
    .insert({
      token_hashed: tokenHashed,
      device_label: opts.label ?? null,
      ip: opts.ip ?? null,
      user_agent: opts.userAgent ?? null,
      expires_at: expiresAt,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  // Cookie value is signed so we can spot tampering before we hit the DB.
  const payload = `${token}|${expiresAt}`;
  const sig = sign(payload);
  const cookieValue = `${Buffer.from(payload).toString("base64url")}.${sig}`;
  const store = await cookies();
  store.set(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
  return data as TrustedDevice;
}

/** If the cookie is present, signed correctly, not expired, and matches a
 *  non-expired row in the DB, returns true (skip 2FA for this login). */
export async function isDeviceTrusted(): Promise<boolean> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const [b64, sig] = raw.split(".");
  if (!b64 || !sig) return false;
  let payload: string;
  try {
    payload = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const expected = sign(payload);
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return false;
  }
  const [token, expiresAtStr] = payload.split("|");
  if (!token || !expiresAtStr) return false;
  if (new Date(expiresAtStr).getTime() < Date.now()) return false;

  const supabase = requireSupabaseAdmin();
  const tokenHashed = sha256(token);
  const { data } = await supabase
    .from("trusted_devices")
    .select("id, expires_at")
    .eq("token_hashed", tokenHashed)
    .maybeSingle();
  if (!data) return false;
  if (new Date(data.expires_at).getTime() < Date.now()) return false;
  // Bump last_used_at so the user can see freshness.
  await supabase
    .from("trusted_devices")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return true;
}

export async function listTrustedDevices(): Promise<TrustedDevice[]> {
  const supabase = requireSupabaseAdmin();
  // Prune anything that's clearly expired so the list stays clean.
  await supabase.from("trusted_devices").delete().lt("expires_at", new Date().toISOString());
  const { data } = await supabase
    .from("trusted_devices")
    .select("*")
    .order("last_used_at", { ascending: false });
  return (data ?? []) as TrustedDevice[];
}

export async function revokeTrustedDevice(id: string): Promise<void> {
  const supabase = requireSupabaseAdmin();
  await supabase.from("trusted_devices").delete().eq("id", id);
}

export async function revokeAllTrustedDevices(): Promise<void> {
  const supabase = requireSupabaseAdmin();
  await supabase.from("trusted_devices").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

export async function clearTrustedDeviceCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
