/**
 * MCP access tokens — generated from the admin UI, stored in Supabase.
 *
 * Any agent connecting to /api/mcp must present a valid token.
 * Tokens can have names, optional expiry, and can be revoked.
 */
import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

export type McpToken = {
  id: string;
  name: string;
  /** The actual token value — only returned on creation. */
  token_hash: string;
  token_prefix: string; // first 8 chars for display
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

const TABLE = "mcp_tokens";

/** Generate a secure random token. */
function generateToken(): string {
  return `lucy_${crypto.randomBytes(32).toString("base64url")}`;
}

/** Hash a token for storage (we never store the raw token). */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createToken(name: string, expiresInDays?: number): Promise<{
  token: string; // raw token — shown once
  id: string;
  name: string;
  token_prefix: string;
  expires_at: string | null;
}> {
  const supabase = requireSupabaseAdmin();
  const raw = generateToken();
  const hash = hashToken(raw);
  const prefix = raw.slice(0, 12) + "...";
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
    : null;

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      name: name || "Unnamed",
      token_hash: hash,
      token_prefix: prefix,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return {
    token: raw,
    id: data.id,
    name: data.name,
    token_prefix: prefix,
    expires_at: expiresAt,
  };
}

export async function listTokens(): Promise<McpToken[]> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as McpToken[];
}

export async function deleteToken(id: string): Promise<void> {
  const supabase = requireSupabaseAdmin();
  await supabase.from(TABLE).delete().eq("id", id);
}

/** Validate a token from an incoming request. Returns true if valid. */
export async function validateToken(rawToken: string): Promise<boolean> {
  if (!rawToken) return false;

  // Also accept the env-var token as fallback.
  const envToken = process.env.MCP_ACCESS_TOKEN;
  if (envToken && rawToken === envToken) return true;

  const supabase = requireSupabaseAdmin();
  const hash = hashToken(rawToken);
  const { data } = await supabase
    .from(TABLE)
    .select("id, expires_at")
    .eq("token_hash", hash)
    .maybeSingle();

  if (!data) return false;

  // Check expiry.
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false;

  // Update last_used_at.
  await supabase
    .from(TABLE)
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return true;
}
