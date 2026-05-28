import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

/** Scopes we request — read-only mailbox + profile (email address). */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

export type GmailTokenRow = {
  id: string;
  email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
  updated_at: string;
};

export function getOAuthEnv(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const explicitRedirect = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";
  const base = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
  const redirectUri = explicitRedirect || `${base}/api/admin/gmail/callback`;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

export function buildAuthUrl(state: string): string | null {
  const env = getOAuthEnv();
  if (!env) return null;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("redirect_uri", env.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
}> {
  const env = getOAuthEnv();
  if (!env) return { error: "Google OAuth env not configured" };
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.clientId,
      client_secret: env.clientSecret,
      redirect_uri: env.redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!r.ok || j.error) {
    return { error: j.error_description || j.error || `Google ${r.status}` };
  }
  return j;
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
}> {
  const env = getOAuthEnv();
  if (!env) return { error: "Google OAuth env not configured" };
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!r.ok || j.error) {
    return { error: j.error_description || j.error || `Google ${r.status}` };
  }
  return j;
}

export async function saveTokens(input: {
  email?: string;
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}): Promise<void> {
  const supabase = requireSupabaseAdmin();
  const expiresAt = input.expires_in
    ? new Date(Date.now() + input.expires_in * 1000).toISOString()
    : null;
  await supabase.from("gmail_tokens").upsert({
    id: "singleton",
    email: input.email ?? null,
    access_token: input.access_token,
    refresh_token: input.refresh_token ?? null,
    expires_at: expiresAt,
    scope: input.scope ?? null,
    updated_at: new Date().toISOString(),
  });
}

export async function getStoredTokens(): Promise<GmailTokenRow | null> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from("gmail_tokens")
    .select("*")
    .eq("id", "singleton")
    .maybeSingle();
  return (data as GmailTokenRow | null) ?? null;
}

export async function deleteStoredTokens(): Promise<void> {
  const supabase = requireSupabaseAdmin();
  await supabase.from("gmail_tokens").delete().eq("id", "singleton");
}

/** Returns a valid access token, refreshing if expired. */
export async function getAccessToken(): Promise<string | null> {
  const row = await getStoredTokens();
  if (!row?.access_token) return null;
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  // Refresh 60s before expiry.
  if (expiresAt > Date.now() + 60_000) return row.access_token;
  if (!row.refresh_token) return row.access_token; // best effort
  const refreshed = await refreshAccessToken(row.refresh_token);
  if (refreshed.error || !refreshed.access_token) return null;
  await saveTokens({
    email: row.email ?? undefined,
    access_token: refreshed.access_token,
    refresh_token: row.refresh_token,
    expires_in: refreshed.expires_in,
    scope: refreshed.scope ?? row.scope ?? undefined,
  });
  return refreshed.access_token;
}

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  from?: string;
  subject?: string;
  snippet?: string;
  date?: string;
};

export async function listRecentMessages(opts: {
  query?: string;
  maxResults?: number;
}): Promise<{ messages: GmailMessageSummary[]; error?: string }> {
  const access = await getAccessToken();
  if (!access) return { messages: [], error: "Gmail not connected" };
  const max = Math.max(1, Math.min(50, opts.maxResults ?? 10));
  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("maxResults", String(max));
  if (opts.query) listUrl.searchParams.set("q", opts.query);
  const r = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${access}` },
    cache: "no-store",
  });
  if (!r.ok) {
    return { messages: [], error: `Gmail list ${r.status}` };
  }
  const j = (await r.json()) as {
    messages?: Array<{ id: string; threadId: string }>;
  };
  const ids = (j.messages ?? []).slice(0, max);
  // Fetch each message metadata in parallel.
  const summaries = await Promise.all(
    ids.map(async (m): Promise<GmailMessageSummary | null> => {
      const mr = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${access}` }, cache: "no-store" }
      );
      if (!mr.ok) return null;
      const md = (await mr.json()) as {
        id: string;
        threadId: string;
        snippet?: string;
        payload?: { headers?: Array<{ name: string; value: string }> };
      };
      const headers = md.payload?.headers ?? [];
      const get = (n: string) =>
        headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value;
      return {
        id: md.id,
        threadId: md.threadId,
        from: get("From"),
        subject: get("Subject"),
        date: get("Date"),
        snippet: md.snippet,
      };
    })
  );
  return { messages: summaries.filter((s): s is GmailMessageSummary => !!s) };
}
