"use client";

import { useEffect, useState } from "react";
import {
  FiSave,
  FiTrash2,
  FiCheckCircle,
  FiAlertCircle,
  FiEdit2,
  FiPlus,
  FiMail,
  FiExternalLink,
  FiLogOut,
} from "react-icons/fi";
import type { Connector } from "@/lib/content-types";
import TwoFactorCard from "./TwoFactorCard";

type Props = {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
};

const inputClass =
  "w-full px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none text-sm text-white placeholder:text-[#555] transition-colors";

type Preset = {
  id: string;
  label: string;
  base_url: string;
  helpUrl: string;
  helpLabel: string;
  description: string;
};

const PRESETS: Record<string, Preset> = {
  wealthclaude: {
    id: "wealthclaude",
    label: "WealthClaude",
    base_url: "https://www.wealthclaude.com/api/mcp",
    helpUrl: "https://www.wealthclaude.com/settings/ai-access",
    helpLabel: "WealthClaude → AI Access → New token",
    description:
      "Read-only token from your WealthClaude account. With the MCP URL the chat can call specific tools (holdings, debts, dividends, budget) for detailed answers — same data your WealthClaude chatbot uses.",
  },
  buffer: {
    id: "buffer",
    label: "Buffer",
    base_url: "https://api.buffer.com/graphql",
    helpUrl: "https://buffer.com/developers/apps",
    helpLabel: "buffer.com/developers/apps",
    description:
      "Buffer access token. Lets the Social tab list your LinkedIn / X / Instagram channels and post via Buffer's queue.",
  },
};

const DEFAULT_DRAFT = {
  id: "wealthclaude",
  label: "WealthClaude",
  base_url: PRESETS.wealthclaude.base_url,
  bearer_token: "",
  enabled: true,
};

export default function ConnectorsEditor({ onSuccess, onError }: Props) {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ ...DEFAULT_DRAFT });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/connectors")
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && Array.isArray(data.connectors)) {
          setConnectors(data.connectors);
          const existing = data.connectors.find(
            (c: Connector) => c.id === "wealthclaude"
          );
          if (existing) {
            setDraft({
              id: existing.id,
              label: existing.label,
              base_url: existing.base_url,
              bearer_token: existing.bearer_token ?? "",
              enabled: existing.enabled,
            });
          }
          // Auto-expand the form only when the user has nothing saved yet.
          setExpanded(data.connectors.length === 0);
        } else if (data.error) {
          onError(data.error);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onError]);

  async function refresh() {
    const r = await fetch("/api/admin/connectors");
    const d = await r.json();
    if (Array.isArray(d.connectors)) setConnectors(d.connectors);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.id || !draft.base_url) {
      onError("ID and base URL are required");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      onError(data.error || "Save failed");
      return;
    }
    onSuccess("Connector saved");
    await refresh();
    setExpanded(false);
  }

  async function remove(id: string) {
    if (!confirm(`Delete connector "${id}"?`)) return;
    const res = await fetch(`/api/admin/connectors/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      onError(data.error || "Delete failed");
      return;
    }
    onSuccess("Connector deleted");
    await refresh();
    if (id === draft.id) setDraft({ ...DEFAULT_DRAFT });
  }

  async function testConnector(id: string) {
    setTesting(id);
    setTestResult((prev) => ({ ...prev, [id]: { ok: false, message: "Testing…" } }));
    const res = await fetch(`/api/admin/chat/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ probeConnector: id }),
    });
    const data = await res.json().catch(() => ({}));
    setTesting(null);
    setTestResult((prev) => ({
      ...prev,
      [id]: {
        ok: !!data.ok,
        message: data.ok
          ? `OK — ${(data.summary || "Connection successful").slice(0, 80)}`
          : data.error || "Connection failed",
      },
    }));
  }

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-xl font-bold">Connectors</h2>
        <p className="text-xs text-[#666] mt-1">
          Plug external read-only APIs (like WealthClaude) into the admin so
          the Chat tab can pull live data into its answers.
        </p>
      </div>

      {/* 2FA — top of the page so it's never missed */}
      <TwoFactorCard onSuccess={onSuccess} onError={onError} />

      {/* Gmail — handled separately because it uses OAuth, not a static bearer token */}
      <div className="mt-6">
        <GmailCard onSuccess={onSuccess} onError={onError} />
      </div>

      {/* Existing connectors */}
      {loading ? (
        <p className="text-[#666] text-sm">Loading…</p>
      ) : connectors.length > 0 ? (
        <div className="space-y-3 mb-8">
          {connectors.map((c) => {
            const r = testResult[c.id];
            return (
              <div
                key={c.id}
                className="rounded-2xl bg-[#1a1a1a] border border-white/[0.06] p-5 flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-white">{c.label}</h3>
                    <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/[0.04] text-[#999] border border-white/10 uppercase font-mono">
                      {c.id}
                    </span>
                    {c.enabled ? (
                      <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                        Enabled
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/[0.04] text-[#999] border border-white/10 uppercase">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#666] font-mono truncate">
                    {c.base_url}
                  </p>
                  <p className="text-[10px] text-[#555] mt-1">
                    {c.bearer_token ? "🔐 Token set" : "⚠ No token"}
                  </p>
                  {r && (
                    <p
                      className={`text-xs mt-2 inline-flex items-center gap-1.5 ${
                        r.ok ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {r.ok ? <FiCheckCircle size={11} /> : <FiAlertCircle size={11} />}
                      {r.message}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => testConnector(c.id)}
                    disabled={testing === c.id}
                    className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs hover:border-[#ff6b00]/40 hover:text-[#ff6b00] transition-colors disabled:opacity-60"
                  >
                    {testing === c.id ? "Testing…" : "Test"}
                  </button>
                  <button
                    onClick={() => {
                      setDraft({
                        id: c.id,
                        label: c.label,
                        base_url: c.base_url,
                        bearer_token: c.bearer_token ?? "",
                        enabled: c.enabled,
                      });
                      setExpanded(true);
                    }}
                    className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] hover:border-[#ff6b00]/40 hover:text-[#ff6b00] flex items-center justify-center transition-colors"
                    title="Edit"
                  >
                    <FiEdit2 size={13} />
                  </button>
                  <button
                    onClick={() => remove(c.id)}
                    className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] hover:border-red-500/40 hover:text-red-400 flex items-center justify-center transition-colors"
                    title="Delete"
                  >
                    <FiTrash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Collapsed state: just an Add button */}
      {!expanded ? (
        <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02]">
          <p className="text-xs text-[#888]">
            {connectors.length > 0
              ? "Edit a connector above, or add another below."
              : "No connectors yet — pick a preset to get started."}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {Object.values(PRESETS).map((p) => {
              const existing = connectors.find((c) => c.id === p.id);
              if (existing) return null;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setDraft({
                      id: p.id,
                      label: p.label,
                      base_url: p.base_url,
                      bearer_token: "",
                      enabled: true,
                    });
                    setExpanded(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-semibold text-xs shadow-[0_4px_15px_rgba(255,107,0,0.35)] hover:scale-[1.03] transition-transform"
                >
                  <FiPlus size={12} />
                  Add {p.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
      {/* Preset picker */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#666] mr-1">
          Preset
        </span>
        {Object.values(PRESETS).map((p) => {
          const isActive = draft.id === p.id;
          const existing = connectors.find((c) => c.id === p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                setDraft({
                  id: p.id,
                  label: p.label,
                  base_url: existing?.base_url ?? p.base_url,
                  bearer_token: existing?.bearer_token ?? "",
                  enabled: existing?.enabled ?? true,
                })
              }
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? "bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black shadow-[0_4px_15px_rgba(255,107,0,0.35)]"
                  : "bg-white/[0.04] border border-white/[0.06] text-[#999] hover:border-[#ff6b00]/30 hover:text-white"
              }`}
            >
              {p.label}
              {existing && (
                <span
                  className={`text-[9px] font-mono ${isActive ? "text-black/70" : "text-emerald-400"}`}
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Preset-specific help */}
      {PRESETS[draft.id] && (
        <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs leading-relaxed text-[#bbb]">
          <p>{PRESETS[draft.id].description}</p>
          <p className="mt-2 text-[#888]">
            Get a token at{" "}
            <a
              href={PRESETS[draft.id].helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#ff8c38] hover:underline"
            >
              {PRESETS[draft.id].helpLabel}
            </a>
            .
            {draft.id === "buffer" && (
              <>
                {" "}
                On Buffer&apos;s developer page click <strong>Create New App</strong>{" "}
                → fill any name → open the app → copy the{" "}
                <strong>Access Token</strong>. Paste it below. We talk to
                Buffer&apos;s new GraphQL API at{" "}
                <code className="text-[#ff8c38]">api.buffer.com/graphql</code>{" "}
                — the URL field below is just for show; only the token matters.
              </>
            )}
          </p>
        </div>
      )}

      {/* Add / edit form */}
      <form
        onSubmit={save}
        className="rounded-2xl border border-[#ff6b00]/20 bg-gradient-to-br from-[#ff6b00]/[0.05] to-transparent p-5 space-y-4"
      >
        <p className="text-xs font-mono tracking-[0.15em] uppercase text-[#ff8c38]">
          {connectors.find((c) => c.id === draft.id) ? "Edit" : "Add"} {draft.label || draft.id} connector
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-mono tracking-[0.15em] uppercase text-[#888] mb-2">
              ID
            </label>
            <input
              value={draft.id}
              onChange={(e) => setDraft({ ...draft, id: e.target.value })}
              className={inputClass}
              placeholder="wealthclaude"
            />
          </div>
          <div>
            <label className="block text-xs font-mono tracking-[0.15em] uppercase text-[#888] mb-2">
              Label
            </label>
            <input
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              className={inputClass}
              placeholder="WealthClaude"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono tracking-[0.15em] uppercase text-[#888] mb-2">
            Endpoint URL
          </label>
          <input
            type="url"
            value={draft.base_url}
            onChange={(e) => setDraft({ ...draft, base_url: e.target.value })}
            className={inputClass}
            placeholder="https://www.wealthclaude.com/api/agent/me"
          />
          <p className="text-[10px] text-[#555] mt-1.5">
            {draft.id === "buffer" ? (
              <>
                Leave this as the Buffer profiles URL — the Social tab uses
                hard-coded Buffer endpoints, only the token below actually
                matters for Buffer.
              </>
            ) : (
              <>
                For WealthClaude use the{" "}
                <strong className="text-[#ff8c38]">MCP endpoint</strong> —{" "}
                <code className="text-[#ff8c38]">
                  https://www.wealthclaude.com/api/mcp
                </code>
                . The chat will discover the available tools (holdings,
                debts, dividends, budget, full snapshot) and call them on
                demand instead of dumping a partial snapshot. If you paste
                the plain REST URL (<code>/api/agent/me</code>) it still
                works as a fallback context.
              </>
            )}
          </p>
        </div>

        <div>
          <label className="block text-xs font-mono tracking-[0.15em] uppercase text-[#888] mb-2">
            Bearer token (read-only)
          </label>
          <input
            type="password"
            value={draft.bearer_token}
            onChange={(e) => setDraft({ ...draft, bearer_token: e.target.value })}
            className={inputClass}
            placeholder="Paste the read-only token from WealthClaude → AI Access"
            autoComplete="new-password"
          />
          <p className="text-[10px] text-[#555] mt-1.5">
            {draft.id === "buffer" ? (
              <>
                Long token starting with <code>1/</code> from your Buffer app
                page (Create app → open it → copy Access Token).
              </>
            ) : (
              <>
                Generate this in WealthClaude → AI Access → New token.
              </>
            )}{" "}
            Stored server-side; never exposed to the public site.
          </p>
        </div>

        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            className="w-4 h-4 accent-[#ff6b00]"
          />
          <span>
            <strong className="text-white">Enabled</strong>{" "}
            <span className="text-[#888]">— when off, the chat ignores this connector.</span>
          </span>
        </label>

        <div className="flex items-center justify-end gap-3 pt-1">
          {connectors.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="px-4 py-2 rounded-full border border-white/10 text-sm text-[#999] hover:bg-white/[0.04] hover:text-white"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_4px_20px_rgba(255,107,0,0.4)] hover:scale-[1.02] disabled:opacity-60"
          >
            {saving ? "Saving…" : (
              <>
                <FiSave size={14} />
                Save connector
              </>
            )}
          </button>
        </div>
      </form>
        </>
      )}
    </section>
  );
}

/* ─────────────────────────── Gmail OAuth card ─────────────────────────── */

type GmailStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  expiresAt: string | null;
  redirectUri: string | null;
};

function GmailCard({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    fetch("/api/admin/gmail/status")
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then(({ data }) => {
        setStatus(data as GmailStatus);
        setLoading(false);
      });

    // Surface the redirect-back result from Google so the user sees what happened.
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("gmail") === "connected") {
        onSuccess(
          `Gmail connected${params.get("gmail_email") ? ` as ${params.get("gmail_email")}` : ""}`
        );
        const url = new URL(window.location.href);
        url.searchParams.delete("gmail");
        url.searchParams.delete("gmail_email");
        window.history.replaceState({}, "", url.toString());
      } else if (params.get("gmail_error")) {
        onError(`Gmail: ${params.get("gmail_error")}`);
        const url = new URL(window.location.href);
        url.searchParams.delete("gmail_error");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [onSuccess, onError]);

  async function disconnect() {
    if (!confirm("Disconnect Gmail?")) return;
    const r = await fetch("/api/admin/gmail/status", { method: "DELETE" });
    if (r.ok) {
      onSuccess("Gmail disconnected");
      setStatus((s) => (s ? { ...s, connected: false, email: null, expiresAt: null } : s));
    } else {
      onError("Failed to disconnect Gmail");
    }
  }

  function connect() {
    window.location.href = "/api/admin/gmail/auth";
  }

  if (loading) return null;

  return (
    <div className="mb-6 rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-5">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-red-500/15 text-red-300 flex items-center justify-center shrink-0">
          <FiMail size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white">Gmail</h3>
            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/[0.04] text-[#999] border border-white/10 uppercase font-mono">
              OAuth
            </span>
            {status?.connected && (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                Connected
              </span>
            )}
            {!status?.configured && (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase">
                Needs setup
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#888] mt-1">
            Read-only access to your inbox so the Chat tab and News scout can
            cite newsletter content + recruiter emails.
          </p>
          {status?.connected && status.email && (
            <p className="text-[10px] text-[#666] font-mono mt-1">
              {status.email}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status?.configured && !status.connected && (
            <button
              type="button"
              onClick={connect}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black text-xs font-bold shadow-[0_4px_15px_rgba(255,107,0,0.35)] hover:scale-[1.03]"
            >
              <FiExternalLink size={11} />
              Connect Gmail
            </button>
          )}
          {status?.connected && (
            <button
              type="button"
              onClick={disconnect}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs hover:border-red-500/40 hover:text-red-400"
            >
              <FiLogOut size={11} />
              Disconnect
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowSetup((s) => !s)}
            className="text-[10px] uppercase tracking-widest text-[#888] hover:text-white px-2 py-1"
          >
            {showSetup ? "Hide setup" : "Setup"}
          </button>
        </div>
      </div>

      {showSetup && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] text-[12px] text-[#bbb] space-y-2 leading-relaxed">
          <p className="font-semibold text-white">First-time setup (one-time):</p>
          <ol className="list-decimal pl-5 space-y-1 text-[#bbb]">
            <li>
              Go to{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#ff8c38] hover:underline"
              >
                Google Cloud Console → Credentials
              </a>
              , create an <strong>OAuth client ID</strong> of type{" "}
              <em>Web application</em>.
            </li>
            <li>
              Add this exact <strong>Authorized redirect URI</strong>:
              <code className="block mt-1 p-2 rounded bg-[#0a0a0a] text-[#ff8c38] font-mono break-all">
                {status?.redirectUri ||
                  "(set GOOGLE_OAUTH_CLIENT_ID + run schema.sql first, then refresh this page)"}
              </code>
            </li>
            <li>
              Enable the <strong>Gmail API</strong> for the project at{" "}
              <a
                href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#ff8c38] hover:underline"
              >
                APIs &amp; Services → Library
              </a>
              .
            </li>
            <li>
              Paste the client ID + secret into Vercel env (and{" "}
              <code>.env.local</code>) as{" "}
              <code className="text-[#ff8c38]">GOOGLE_OAUTH_CLIENT_ID</code> and{" "}
              <code className="text-[#ff8c38]">GOOGLE_OAUTH_CLIENT_SECRET</code>.
            </li>
            <li>
              Run the latest <code className="text-[#ff8c38]">supabase/schema.sql</code> so the
              new <code>gmail_tokens</code> table exists.
            </li>
            <li>Redeploy, refresh this page, click <strong>Connect Gmail</strong>.</li>
          </ol>
          <p className="text-[10px] text-[#666] mt-3">
            Scopes requested: <code>gmail.readonly</code> + email. Token is
            stored in Supabase (service-role only), refreshed automatically.
          </p>
        </div>
      )}
    </div>
  );
}

