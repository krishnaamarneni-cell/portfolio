import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

/** Scopes we request — read-only mailbox, send (for Morning Briefing), profile. */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
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
  url.searchParams.set("prompt", "consent select_account");
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
  to?: string;
  subject?: string;
  snippet?: string;
  date?: string;
};

/** Encode a string into base64url for Gmail's raw-message API. */
function toBase64Url(s: string): string {
  return Buffer.from(s, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export type EmailAttachment = { filename: string; content: Buffer; contentType: string };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const access = await getAccessToken();
  if (!access) return { ok: false, error: "Gmail not connected" };
  const row = await getStoredTokens();
  const from = row?.email || "me";
  const rand = Math.random().toString(36).slice(2);
  const textPart = opts.text || opts.html.replace(/<[^>]+>/g, "").trim();

  let mime: string;
  if (opts.attachments?.length) {
    // multipart/mixed: [ alternative(text+html), ...attachments ]
    const alt = `alt_${rand}`;
    const mixed = `mix_${rand}`;
    const lines: string[] = [
      `From: ${from}`,
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${mixed}"`,
      "",
      `--${mixed}`,
      `Content-Type: multipart/alternative; boundary="${alt}"`,
      "",
      `--${alt}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      textPart,
      "",
      `--${alt}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      opts.html,
      "",
      `--${alt}--`,
      "",
    ];
    for (const att of opts.attachments) {
      const b64 = att.content.toString("base64").replace(/(.{76})/g, "$1\r\n");
      lines.push(
        `--${mixed}`,
        `Content-Type: ${att.contentType}; name="${att.filename}"`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        "Content-Transfer-Encoding: base64",
        "",
        b64,
        "",
      );
    }
    lines.push(`--${mixed}--`, "");
    mime = lines.join("\r\n");
  } else {
    const boundary = `bnd_${rand}`;
    mime = [
      `From: ${from}`,
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      textPart,
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      opts.html,
      "",
      `--${boundary}--`,
      "",
    ].join("\r\n");
  }
  const raw = toBase64Url(mime);
  const r = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
      cache: "no-store",
    }
  );
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    return { ok: false, error: `Gmail send ${r.status}: ${body.slice(0, 200)}` };
  }
  const j = (await r.json()) as { id?: string };
  return { ok: true, id: j.id };
}

/* ─── Thread support for CRM ─── */

export type GmailThreadMessage = {
  id: string;
  from: string;
  to: string;
  cc?: string;
  date: string;
  subject: string;
  snippet: string;
  bodyText: string;
  bodyHtml: string;
};

export type GmailThread = {
  id: string;
  messages: GmailThreadMessage[];
  subject: string;
  snippet: string;
  messageCount: number;
  participants: string[];
  lastMessageAt: string;
};

function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf-8");
}

function extractBody(
  payload: Record<string, unknown>
): { text: string; html: string } {
  let text = "";
  let html = "";
  const mimeType = payload.mimeType as string | undefined;
  const body = payload.body as { data?: string; size?: number } | undefined;
  const parts = payload.parts as Record<string, unknown>[] | undefined;

  if (body?.data) {
    const decoded = decodeBase64Url(body.data);
    if (mimeType === "text/plain") text = decoded;
    else if (mimeType === "text/html") html = decoded;
  }
  if (parts) {
    for (const part of parts) {
      const sub = extractBody(part);
      if (sub.text && !text) text = sub.text;
      if (sub.html && !html) html = sub.html;
    }
  }
  return { text, html };
}

function extractEmails(header: string): string[] {
  const matches = header.match(/[\w.+-]+@[\w.-]+\.\w+/gi);
  return [...new Set(matches?.map((e) => e.toLowerCase()) ?? [])];
}

export async function getThread(threadId: string): Promise<GmailThread | null> {
  const access = await getAccessToken();
  if (!access) return null;
  const r = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
    { headers: { Authorization: `Bearer ${access}` }, cache: "no-store" }
  );
  if (!r.ok) return null;
  const data = await r.json();
  const rawMsgs = (data.messages ?? []) as Array<{
    id: string;
    snippet?: string;
    internalDate?: string;
    payload?: Record<string, unknown>;
  }>;

  const allParticipants = new Set<string>();
  const messages: GmailThreadMessage[] = [];

  for (const msg of rawMsgs) {
    const headers = (msg.payload?.headers ?? []) as Array<{
      name: string;
      value: string;
    }>;
    const get = (n: string) =>
      headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ??
      "";
    const from = get("From");
    const to = get("To");
    const cc = get("Cc");
    extractEmails(`${from} ${to} ${cc}`).forEach((e) =>
      allParticipants.add(e)
    );
    const { text, html } = msg.payload ? extractBody(msg.payload) : { text: "", html: "" };
    messages.push({
      id: msg.id,
      from,
      to,
      cc: cc || undefined,
      date: get("Date") || new Date(Number(msg.internalDate ?? 0)).toISOString(),
      subject: get("Subject"),
      snippet: msg.snippet ?? "",
      bodyText: text,
      bodyHtml: html,
    });
  }

  const lastMsg = messages[messages.length - 1];
  return {
    id: threadId,
    messages,
    subject: messages[0]?.subject ?? "",
    snippet: lastMsg?.snippet ?? "",
    messageCount: messages.length,
    participants: [...allParticipants],
    lastMessageAt: lastMsg?.date ?? "",
  };
}

export async function listRecentThreadIds(opts?: {
  maxResults?: number;
  newerThanDays?: number;
  query?: string;
}): Promise<{ threadIds: string[]; error?: string }> {
  const access = await getAccessToken();
  if (!access) return { threadIds: [], error: "Gmail not connected" };

  const days = opts?.newerThanDays ?? 30;
  const q = opts?.query || `newer_than:${days}d`;
  const max = opts?.maxResults ?? 200;

  const allThreads: string[] = [];
  let pageToken: string | undefined;

  while (allThreads.length < max) {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/threads");
    url.searchParams.set("q", q);
    url.searchParams.set("maxResults", String(Math.min(100, max - allThreads.length)));
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${access}` },
      cache: "no-store",
    });
    if (!r.ok) {
      if (allThreads.length === 0) return { threadIds: [], error: `Gmail ${r.status}` };
      break;
    }
    const j = (await r.json()) as {
      threads?: Array<{ id: string }>;
      nextPageToken?: string;
    };
    const page = j.threads ?? [];
    allThreads.push(...page.map((t) => t.id));
    pageToken = j.nextPageToken;
    if (!pageToken || page.length === 0) break;
  }

  return { threadIds: allThreads.slice(0, max) };
}

export async function listThreadsForContact(
  email: string,
  maxResults = 50
): Promise<{ threadIds: string[]; error?: string }> {
  const access = await getAccessToken();
  if (!access) return { threadIds: [], error: "Gmail not connected" };

  const query = `from:${email} OR to:${email}`;
  const listUrl = new URL(
    "https://gmail.googleapis.com/gmail/v1/users/me/threads"
  );
  listUrl.searchParams.set("q", query);
  listUrl.searchParams.set("maxResults", String(Math.min(maxResults, 100)));

  const r = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${access}` },
    cache: "no-store",
  });
  if (!r.ok) return { threadIds: [], error: `Gmail threads ${r.status}` };
  const j = (await r.json()) as {
    threads?: Array<{ id: string }>;
  };
  return { threadIds: (j.threads ?? []).map((t) => t.id) };
}

export async function listRecentMessages(opts: {
  query?: string;
  maxResults?: number;
}): Promise<{ messages: GmailMessageSummary[]; error?: string }> {
  const access = await getAccessToken();
  if (!access) return { messages: [], error: "Gmail not connected" };
  const max = Math.max(1, Math.min(500, opts.maxResults ?? 10));

  // Paginate through Gmail list API (max 100 per page).
  const allIds: Array<{ id: string; threadId: string }> = [];
  let pageToken: string | undefined;
  while (allIds.length < max) {
    const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    listUrl.searchParams.set("maxResults", String(Math.min(100, max - allIds.length)));
    if (opts.query) listUrl.searchParams.set("q", opts.query);
    if (pageToken) listUrl.searchParams.set("pageToken", pageToken);
    const r = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${access}` },
      cache: "no-store",
    });
    if (!r.ok) {
      if (allIds.length === 0) return { messages: [], error: `Gmail list ${r.status}` };
      break;
    }
    const j = (await r.json()) as {
      messages?: Array<{ id: string; threadId: string }>;
      nextPageToken?: string;
    };
    const page = j.messages ?? [];
    allIds.push(...page);
    pageToken = j.nextPageToken;
    if (!pageToken || page.length === 0) break;
  }

  const ids = allIds.slice(0, max);

  // Fetch each message metadata in parallel (batch 20 at a time to avoid rate limits).
  const summaries: GmailMessageSummary[] = [];
  const BATCH = 20;
  for (let start = 0; start < ids.length; start += BATCH) {
    const batch = ids.slice(start, start + BATCH);
    const results = await Promise.all(
      batch.map(async (m): Promise<GmailMessageSummary | null> => {
        const mr = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
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
          to: get("To"),
          subject: get("Subject"),
          date: get("Date"),
          snippet: md.snippet,
        };
      })
    );
    summaries.push(...results.filter((s): s is GmailMessageSummary => !!s));
  }
  return { messages: summaries };
}
