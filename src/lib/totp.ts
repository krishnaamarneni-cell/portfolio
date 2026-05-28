import "server-only";
import { authenticator } from "otplib";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { sha256 } from "@/lib/auth";

const PREAUTH_COOKIE = "ka_admin_preauth";
const PREAUTH_TTL_SECONDS = 5 * 60; // 5 minutes to enter the code
const BACKUP_CODE_COUNT = 10;
const ISSUER = "Krishna Admin";

// otplib's defaults are RFC 6238 standard (30s, 6 digits, SHA1).
// Bump the window so a code from the previous step (~30s ago) still works
// — covers small clock drift between server and phone.
authenticator.options = { window: 1, step: 30, digits: 6 };

/* ─── Settings row (just the TOTP slice) ─── */

export type TotpStatus = {
  enabled: boolean;
  hasSecret: boolean;
  backupCodesRemaining: number;
  setupAt: string | null;
};

type AdminRow = {
  totp_enabled: boolean;
  totp_secret: string | null;
  totp_backup_codes_hashed: string[];
  totp_setup_at: string | null;
};

async function loadAdminRow(): Promise<AdminRow> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from("admin_settings")
    .select(
      "totp_enabled, totp_secret, totp_backup_codes_hashed, totp_setup_at"
    )
    .eq("id", "singleton")
    .maybeSingle();
  if (!data) {
    // Lazy create.
    await supabase.from("admin_settings").upsert({ id: "singleton" });
    return {
      totp_enabled: false,
      totp_secret: null,
      totp_backup_codes_hashed: [],
      totp_setup_at: null,
    };
  }
  return data as AdminRow;
}

export async function getTotpStatus(): Promise<TotpStatus> {
  const row = await loadAdminRow();
  return {
    enabled: row.totp_enabled,
    hasSecret: !!row.totp_secret,
    backupCodesRemaining: row.totp_backup_codes_hashed.length,
    setupAt: row.totp_setup_at,
  };
}

/* ─── Setup: generate secret + provisioning URI ─── */

export type SetupResult = {
  secret: string;
  /** otpauth:// URI for the QR code. */
  uri: string;
};

/** Generate a fresh secret and store it (pending enable). Replaces any prior
 *  pending secret. Does NOT enable 2FA — that requires verifying the first
 *  code via enableTotp(). */
export async function startTotpSetup(accountLabel: string): Promise<SetupResult> {
  const secret = authenticator.generateSecret();
  const supabase = requireSupabaseAdmin();
  await supabase
    .from("admin_settings")
    .upsert({
      id: "singleton",
      totp_secret: secret,
      // Keep enabled flag as-is so an in-progress re-setup doesn't lock you
      // out of an already-working 2FA.
    });
  const uri = authenticator.keyuri(accountLabel, ISSUER, secret);
  return { secret, uri };
}

/** Verify the user's first code against the pending secret. If valid:
 *   - flips totp_enabled = true
 *   - generates + stores hashed backup codes
 *   - returns the plaintext backup codes (last time they're visible). */
export async function enableTotp(code: string): Promise<
  | { ok: true; backupCodes: string[] }
  | { ok: false; error: string }
> {
  const row = await loadAdminRow();
  if (!row.totp_secret) {
    return { ok: false, error: "No pending TOTP secret — start setup again." };
  }
  if (!authenticator.check(code.replace(/\s+/g, ""), row.totp_secret)) {
    return { ok: false, error: "Code didn't match. Try again." };
  }
  const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
    randomBytes(5).toString("hex").toUpperCase()
  );
  const hashed = backupCodes.map((c) => sha256(c));
  const supabase = requireSupabaseAdmin();
  await supabase
    .from("admin_settings")
    .upsert({
      id: "singleton",
      totp_enabled: true,
      totp_backup_codes_hashed: hashed,
      totp_setup_at: new Date().toISOString(),
    });
  return { ok: true, backupCodes };
}

/** Disable 2FA. Requires a current valid code to prevent locked-out attacker
 *  from disabling it after stealing a session. */
export async function disableTotp(code: string): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const row = await loadAdminRow();
  if (!row.totp_enabled) return { ok: true };
  if (!row.totp_secret) return { ok: false, error: "Secret missing." };
  if (!isCodeValid(code, row.totp_secret, row.totp_backup_codes_hashed)) {
    return { ok: false, error: "Code didn't match." };
  }
  const supabase = requireSupabaseAdmin();
  await supabase
    .from("admin_settings")
    .upsert({
      id: "singleton",
      totp_enabled: false,
      totp_secret: null,
      totp_backup_codes_hashed: [],
      totp_setup_at: null,
    });
  return { ok: true };
}

/* ─── Verification during login ─── */

function isCodeValid(
  code: string,
  secret: string,
  backupHashes: string[]
): boolean {
  const cleaned = code.replace(/\s+/g, "").toUpperCase();
  // 6-digit TOTP path.
  if (/^\d{6}$/.test(cleaned)) {
    return authenticator.check(cleaned, secret);
  }
  // Backup-code path. Compare via timing-safe sha256 lookup.
  const candidate = sha256(cleaned);
  for (const h of backupHashes) {
    if (
      h.length === candidate.length &&
      timingSafeEqual(Buffer.from(h), Buffer.from(candidate))
    ) {
      return true;
    }
  }
  return false;
}

/** Consume a backup code if used (remove it from the stored list). */
async function consumeBackupCodeIfMatched(
  code: string,
  backupHashes: string[]
): Promise<boolean> {
  const cleaned = code.replace(/\s+/g, "").toUpperCase();
  if (!/^[0-9A-F]{10}$/.test(cleaned)) return false;
  const candidate = sha256(cleaned);
  const remaining = backupHashes.filter((h) => h !== candidate);
  if (remaining.length === backupHashes.length) return false;
  const supabase = requireSupabaseAdmin();
  await supabase
    .from("admin_settings")
    .upsert({
      id: "singleton",
      totp_backup_codes_hashed: remaining,
    });
  return true;
}

export async function verifyLoginCode(code: string): Promise<
  | { ok: true; usedBackup: boolean }
  | { ok: false; error: string }
> {
  const row = await loadAdminRow();
  if (!row.totp_enabled || !row.totp_secret) {
    return { ok: false, error: "2FA not enabled" };
  }
  const cleaned = code.replace(/\s+/g, "").toUpperCase();
  // Try TOTP first.
  if (/^\d{6}$/.test(cleaned) && authenticator.check(cleaned, row.totp_secret)) {
    return { ok: true, usedBackup: false };
  }
  // Then backup codes.
  const used = await consumeBackupCodeIfMatched(cleaned, row.totp_backup_codes_hashed);
  if (used) return { ok: true, usedBackup: true };
  return { ok: false, error: "Code didn't match." };
}

/* ─── Pre-auth cookie (set after password OK, before OTP) ─── */

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET missing");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

export async function setPreauthCookie(email: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + PREAUTH_TTL_SECONDS;
  const payload = `${email.toLowerCase()}|${exp}`;
  const sig = sign(payload);
  const token = `${Buffer.from(payload).toString("base64url")}.${sig}`;
  const store = await cookies();
  store.set(PREAUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PREAUTH_TTL_SECONDS,
  });
}

export async function readPreauthCookie(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(PREAUTH_COOKIE)?.value;
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
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [email, expStr] = payload.split("|");
  if (!email || !expStr) return null;
  if (Math.floor(Date.now() / 1000) > Number(expStr)) return null;
  return email;
}

export async function clearPreauthCookie(): Promise<void> {
  const store = await cookies();
  store.delete(PREAUTH_COOKIE);
}
