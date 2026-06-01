"use client";

import { useEffect, useState } from "react";
import {
  FiZap,
  FiRefreshCw,
  FiTrendingUp,
  FiBriefcase,
  FiAlertTriangle,
  FiClock,
  FiCpu,
  FiTarget,
  FiMail,
  FiBarChart2,
} from "react-icons/fi";
import { AGENT_MODELS, DEFAULT_AGENT_MODEL } from "@/lib/agents";

type AgentState = {
  markdown: string;
  runAt: number;
  context?: Record<string, unknown>;
};

type AgentKey = "news" | "jobs" | "opportunities" | "inbox" | "screener";

const CACHE_PREFIX = "krishna_admin_agent_";

function loadCached(key: AgentKey): AgentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as AgentState;
  } catch {
    return null;
  }
}

function persistCached(key: AgentKey, state: AgentState) {
  try {
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(state));
  } catch {}
}

function relTime(ms: number) {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function AgentsTab({
  onError,
  onSuccess,
}: {
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}) {
  const [model, setModel] = useState<string>(DEFAULT_AGENT_MODEL);

  // Per-agent state
  const [newsState, setNewsState] = useState<AgentState | null>(null);
  const [newsBusy, setNewsBusy] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsFocus, setNewsFocus] = useState("");

  const [jobsState, setJobsState] = useState<AgentState | null>(null);
  const [jobsBusy, setJobsBusy] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);

  // Atlas Opportunities — Lucy-era agent for portfolio candidates.
  const [oppState, setOppState] = useState<AgentState | null>(null);
  const [oppBusy, setOppBusy] = useState(false);
  const [oppError, setOppError] = useState<string | null>(null);
  // Email Intelligence
  const [inboxState, setInboxState] = useState<AgentState | null>(null);
  const [inboxBusy, setInboxBusy] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [inboxDays, setInboxDays] = useState(3);
  type DraftReply = { to: string; name: string; subject: string; body: string; match: number };
  const [drafts, setDrafts] = useState<DraftReply[]>([]);
  const [editingDraft, setEditingDraft] = useState<number | null>(null);
  const [sendingDraft, setSendingDraft] = useState<number | null>(null);
  const [sentDrafts, setSentDrafts] = useState<Set<number>>(new Set());
  const [rewriting, setRewriting] = useState(false);
  const [customRewrite, setCustomRewrite] = useState("");

  // Stock Screener
  const [screenState, setScreenState] = useState<AgentState | null>(null);
  const [screenBusy, setScreenBusy] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [riskLevel, setRiskLevel] = useState(5);
  const [sectorFocus, setSectorFocus] = useState("");
  const [budget, setBudget] = useState("");

  // Empty by default = broad market scan (the agent now runs without
  // specific companies). User can paste a comma-separated list to narrow.
  const [companiesText, setCompaniesText] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [profile, setProfile] = useState<"software" | "sap" | "both">("both");
  const [location, setLocation] = useState("");

  const autoRefreshTriggered = useState(false)[1]; // prevent re-trigger
  const [autoRefreshDone, setAutoRefreshDone] = useState(false);

  useEffect(() => {
    const cachedNews = loadCached("news");
    const cachedJobs = loadCached("jobs");
    const cachedOpp = loadCached("opportunities");
    const cachedInbox = loadCached("inbox");
    const cachedScreen = loadCached("screener");
    setNewsState(cachedNews);
    setJobsState(cachedJobs);
    setOppState(cachedOpp);
    setInboxState(cachedInbox);
    setScreenState(cachedScreen);
    try {
      const saved = window.localStorage.getItem("krishna_admin_agent_model");
      if (saved) setModel(saved);
      const p = window.localStorage.getItem("krishna_admin_agent_profile");
      if (p === "software" || p === "sap" || p === "both") setProfile(p);
      const l = window.localStorage.getItem("krishna_admin_agent_location");
      if (l) setLocation(l);
      const c = window.localStorage.getItem("krishna_admin_agent_companies");
      if (c) setCompaniesText(c);
    } catch {}

    // ── Smart auto-refresh: run stale agents silently ──
    // If an agent hasn't run in 6+ hours, auto-run it in the background.
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const isStale = (s: AgentState | null) => !s || Date.now() - s.runAt > SIX_HOURS;
    // Use a small delay so the UI renders first, then agents start silently.
    const timer = setTimeout(() => {
      if (isStale(cachedNews)) runNews();
      if (isStale(cachedOpp)) runOpportunities();
      // Jobs + screener + inbox need user config, only auto-refresh if they've run before.
      if (cachedJobs && isStale(cachedJobs)) runJobs();
      if (cachedScreen && isStale(cachedScreen)) runScreener();
      // Inbox only if Gmail is connected (will fail gracefully if not).
      if (cachedInbox && isStale(cachedInbox)) runInbox();
      setAutoRefreshDone(true);
    }, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem("krishna_admin_agent_profile", profile);
      window.localStorage.setItem("krishna_admin_agent_location", location);
      window.localStorage.setItem("krishna_admin_agent_companies", companiesText);
    } catch {}
  }, [profile, location, companiesText]);
  useEffect(() => {
    try {
      window.localStorage.setItem("krishna_admin_agent_model", model);
    } catch {}
  }, [model]);

  async function runNews() {
    setNewsBusy(true);
    setNewsError(null);
    try {
      const r = await fetch("/api/admin/agents/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, extraQuery: newsFocus || undefined }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setNewsError(data.error || "News agent failed");
        onError(data.error || "News agent failed");
      } else {
        const next: AgentState = {
          markdown: data.markdown || "",
          runAt: Date.now(),
          context: data.context,
        };
        setNewsState(next);
        persistCached("news", next);
        onSuccess("News scout done");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setNewsError(msg);
      onError(msg);
    }
    setNewsBusy(false);
  }

  async function runJobs() {
    setJobsBusy(true);
    setJobsError(null);
    try {
      const companies = companiesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const r = await fetch("/api/admin/agents/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          companies,
          targetRole: targetRole || undefined,
          profile,
          location: location || undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setJobsError(data.error || "Jobs agent failed");
        onError(data.error || "Jobs agent failed");
      } else {
        const next: AgentState = {
          markdown: data.markdown || "",
          runAt: Date.now(),
          context: data.context,
        };
        setJobsState(next);
        persistCached("jobs", next);
        onSuccess("Jobs scout done");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setJobsError(msg);
      onError(msg);
    }
    setJobsBusy(false);
  }

  async function runOpportunities() {
    setOppBusy(true);
    setOppError(null);
    try {
      const r = await fetch("/api/admin/agents/atlas/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setOppError(data.error || "Atlas Opportunities failed");
        onError(data.error || "Atlas Opportunities failed");
      } else {
        const next: AgentState = {
          markdown: data.markdown || "",
          runAt: Date.now(),
          context: data.context,
        };
        setOppState(next);
        persistCached("opportunities", next);
        onSuccess("Opportunities scan done");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setOppError(msg);
      onError(msg);
    }
    setOppBusy(false);
  }

  async function runScreener() {
    setScreenBusy(true);
    setScreenError(null);
    try {
      const r = await fetch("/api/admin/agents/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          risk: riskLevel,
          sector: sectorFocus || undefined,
          budget: budget || undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setScreenError(data.error || "Screener failed");
        onError(data.error || "Screener failed");
      } else {
        const next: AgentState = {
          markdown: data.markdown || "",
          runAt: Date.now(),
          context: data.context,
        };
        setScreenState(next);
        persistCached("screener", next);
        onSuccess("Stock screener done");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setScreenError(msg);
      onError(msg);
    }
    setScreenBusy(false);
  }

  async function runInbox() {
    setInboxBusy(true);
    setInboxError(null);
    try {
      const r = await fetch("/api/admin/agents/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, days: inboxDays }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setInboxError(data.error || "Inbox agent failed");
        onError(data.error || "Inbox agent failed");
      } else {
        const next: AgentState = {
          markdown: data.markdown || "",
          runAt: Date.now(),
          context: data.context,
        };
        setInboxState(next);
        persistCached("inbox", next);
        // Capture draft replies
        if (Array.isArray(data.drafts) && data.drafts.length > 0) {
          setDrafts(data.drafts);
          setSentDrafts(new Set());
          setEditingDraft(null);
        }
        onSuccess(`Inbox scan done — ${data.drafts?.length || 0} draft replies`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setInboxError(msg);
      onError(msg);
    }
    setInboxBusy(false);
  }

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Agents</h2>
          <p className="text-xs text-[#666] mt-1">
            Autonomous scouts that go to the open web on demand. Backed by
            Groq's compound model with a built-in search tool.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#666]">
            Model
          </span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs text-[#ccc] focus:outline-none max-w-[260px]"
          >
            {AGENT_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* News scout */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
            <FiTrendingUp size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white">News scout</h3>
            <p className="text-[11px] text-[#666]">
              Stocks in your portfolio, job-market trends, new AI tools — last
              7 days.
            </p>
          </div>
          {newsState && (
            <span className="text-[10px] font-mono text-[#666] flex items-center gap-1">
              <FiClock size={10} />
              {relTime(newsState.runAt)}
            </span>
          )}
          <button
            type="button"
            onClick={runNews}
            disabled={newsBusy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-xs shadow-[0_4px_15px_rgba(255,107,0,0.35)] hover:scale-[1.03] disabled:opacity-60"
          >
            <FiZap size={12} />
            {newsBusy ? "Scouting…" : newsState ? "Re-run" : "Run"}
          </button>
        </div>

        <input
          value={newsFocus}
          onChange={(e) => setNewsFocus(e.target.value)}
          placeholder="Optional extra focus (e.g. 'agent frameworks', 'NVDA earnings', 'SAP layoffs')"
          className="w-full px-4 py-2 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none text-xs text-white placeholder:text-[#555]"
        />

        {newsError && (
          <ErrorBox
            msg={newsError}
            hint="If the model id is wrong, try switching to Llama 3.3 70B (no web) — it still summarises whatever context you've connected."
          />
        )}

        {newsState && !newsBusy ? (
          <div className="mt-2 rounded-xl bg-[#0a0a0a] border border-white/[0.05] p-5">
            <ContextChips context={newsState.context} />
            <Markdown text={newsState.markdown} />
          </div>
        ) : !newsState && !newsBusy && !newsError ? (
          <EmptyHint icon={FiTrendingUp} text="No run yet — hit Run." />
        ) : null}
      </div>

      {/* Email Intelligence */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-300 flex items-center justify-center">
            <FiMail size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white">Email Intelligence</h3>
            <p className="text-[11px] text-[#666]">
              Reads your inbox, categorizes every email, and flags job matches
              &gt;70% against your resume.
            </p>
          </div>
          {inboxState && (
            <span className="text-[10px] font-mono text-[#666] flex items-center gap-1">
              <FiClock size={10} />
              {relTime(inboxState.runAt)}
            </span>
          )}
          <button
            type="button"
            onClick={runInbox}
            disabled={inboxBusy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-bold text-xs shadow-[0_4px_15px_rgba(14,165,233,0.35)] hover:scale-[1.03] disabled:opacity-60"
          >
            <FiZap size={12} />
            {inboxBusy ? "Scanning..." : inboxState ? "Re-scan" : "Scan inbox"}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-[10px] font-mono uppercase tracking-widest text-[#666]">
            Scan last
          </label>
          <div className="flex gap-1.5">
            {[1, 3, 7].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setInboxDays(d)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  inboxDays === d
                    ? "bg-sky-500/15 border-sky-500/40 text-sky-300"
                    : "bg-white/[0.04] border-white/[0.08] text-[#999] hover:border-sky-500/30"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {inboxError && (
          <ErrorBox
            msg={inboxError}
            hint="Gmail must be connected under Settings. If you see 'Gmail not connected', click Connect Gmail and authorize read access."
          />
        )}

        {inboxState && !inboxBusy ? (
          <div className="mt-2 rounded-xl bg-[#0a0a0a] border border-white/[0.05] p-5">
            <ContextChips context={inboxState.context} />
            <Markdown text={inboxState.markdown} />
          </div>
        ) : !inboxState && !inboxBusy && !inboxError ? (
          <EmptyHint icon={FiMail} text="No scan yet — connect Gmail in Settings, then hit Scan." />
        ) : null}

        {/* Draft replies */}
        {drafts.length > 0 && !inboxBusy && (
          <div className="space-y-3">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-sky-400">
              Draft replies ({drafts.length}) — approve, edit, or discard
            </h4>
            {drafts.map((d, i) => {
              const sent = sentDrafts.has(i);
              const editing = editingDraft === i;
              const sending = sendingDraft === i;
              return (
                <div key={i} className={`rounded-xl border p-4 space-y-2 ${sent ? "border-emerald-500/20 bg-emerald-500/[0.03]" : "border-white/[0.06] bg-[#0f0f0f]"}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white">{d.name}</span>
                    <span className="text-[9px] text-[#666] font-mono">{d.to}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${d.match >= 70 ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.04] text-[#666]"}`}>
                      {d.match}%
                    </span>
                    {sent && <span className="text-[9px] font-bold text-emerald-400">SENT</span>}
                  </div>
                  <p className="text-[10px] text-[#888]">Subject: {d.subject}</p>

                  {editing ? (
                    <div className="space-y-2">
                      <input
                        value={d.subject}
                        onChange={(e) => {
                          const updated = [...drafts];
                          updated[i] = { ...d, subject: e.target.value };
                          setDrafts(updated);
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-sky-500/60"
                        placeholder="Subject"
                      />
                      <textarea
                        value={d.body}
                        onChange={(e) => {
                          const updated = [...drafts];
                          updated[i] = { ...d, body: e.target.value };
                          setDrafts(updated);
                        }}
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-sky-500/60 resize-y"
                      />

                      {/* AI rewrite toolbar */}
                      <div className="rounded-lg bg-[#1a1a1a] border border-white/[0.06] p-2.5 space-y-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] font-mono uppercase tracking-widest text-violet-400 mr-1">AI</span>
                          {(
                            [
                              { key: "elaborate", label: "Elaborate", icon: "+" },
                              { key: "shorter", label: "Shorter", icon: "-" },
                              { key: "friendly", label: "Friendly", icon: null },
                              { key: "professional", label: "Professional", icon: null },
                              { key: "confident", label: "Confident", icon: null },
                              { key: "casual", label: "Casual", icon: null },
                              { key: "grammar", label: "Fix Grammar", icon: null },
                            ] as const
                          ).map((btn) => (
                            <button
                              key={btn.key}
                              type="button"
                              disabled={rewriting}
                              onClick={async () => {
                                setRewriting(true);
                                try {
                                  const r = await fetch("/api/admin/rewrite", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      text: d.body,
                                      instruction: btn.key,
                                      context: `Recruiter: ${d.name}, Role: ${d.subject}`,
                                    }),
                                  });
                                  const j = await r.json();
                                  if (j.rewritten) {
                                    const updated = [...drafts];
                                    updated[i] = { ...d, body: j.rewritten };
                                    setDrafts(updated);
                                  }
                                } catch {}
                                setRewriting(false);
                              }}
                              className="px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20 text-[9px] font-bold text-violet-300 hover:bg-violet-500/20 disabled:opacity-40"
                            >
                              {btn.icon && <span className="mr-0.5">{btn.icon}</span>}
                              {btn.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            value={customRewrite}
                            onChange={(e) => setCustomRewrite(e.target.value)}
                            placeholder="Custom: 'add SAP Ariba experience' or 'mention Coca-Cola project'"
                            className="flex-1 px-2.5 py-1.5 rounded-md bg-[#0a0a0a] border border-white/[0.06] text-[10px] text-white placeholder:text-[#555] focus:outline-none focus:border-violet-500/40"
                            onKeyDown={async (e) => {
                              if (e.key === "Enter" && customRewrite.trim()) {
                                setRewriting(true);
                                try {
                                  const r = await fetch("/api/admin/rewrite", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      text: d.body,
                                      instruction: customRewrite,
                                      context: `Recruiter: ${d.name}, Role: ${d.subject}`,
                                    }),
                                  });
                                  const j = await r.json();
                                  if (j.rewritten) {
                                    const updated = [...drafts];
                                    updated[i] = { ...d, body: j.rewritten };
                                    setDrafts(updated);
                                    setCustomRewrite("");
                                  }
                                } catch {}
                                setRewriting(false);
                              }
                            }}
                          />
                          <button
                            type="button"
                            disabled={rewriting || !customRewrite.trim()}
                            onClick={async () => {
                              if (!customRewrite.trim()) return;
                              setRewriting(true);
                              try {
                                const r = await fetch("/api/admin/rewrite", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    text: d.body,
                                    instruction: customRewrite,
                                    context: `Recruiter: ${d.name}, Role: ${d.subject}`,
                                  }),
                                });
                                const j = await r.json();
                                if (j.rewritten) {
                                  const updated = [...drafts];
                                  updated[i] = { ...d, body: j.rewritten };
                                  setDrafts(updated);
                                  setCustomRewrite("");
                                }
                              } catch {}
                              setRewriting(false);
                            }}
                            className="px-3 py-1.5 rounded-md bg-violet-500/15 border border-violet-500/30 text-[9px] font-bold text-violet-300 hover:bg-violet-500/25 disabled:opacity-40"
                          >
                            {rewriting ? "..." : "Rewrite"}
                          </button>
                        </div>
                        {rewriting && (
                          <p className="text-[9px] text-violet-400/60 animate-pulse">Rewriting with AI...</p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingDraft(null)}
                          className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-[10px] font-bold text-sky-300"
                        >
                          Done editing
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#ccc] leading-relaxed whitespace-pre-wrap">{d.body}</p>
                  )}

                  {!sent && !editing && (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        disabled={sending}
                        onClick={async () => {
                          setSendingDraft(i);
                          try {
                            const r = await fetch("/api/admin/contacts/email", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                contactId: "draft",
                                to: d.to,
                                recruiterName: d.name,
                                customMessage: d.body,
                              }),
                            });
                            const j = await r.json();
                            if (j.ok) {
                              setSentDrafts((prev) => new Set([...prev, i]));
                              onSuccess(`Sent to ${d.name}`);
                            } else {
                              onError(j.error || "Send failed");
                            }
                          } catch {
                            onError("Network error");
                          }
                          setSendingDraft(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                      >
                        {sending ? "Sending..." : "Approve & Send"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDraft(i)}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[10px] font-bold text-[#999] hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDrafts(drafts.filter((_, j) => j !== i));
                        }}
                        className="px-3 py-1.5 rounded-lg text-[10px] text-[#555] hover:text-red-400"
                      >
                        Discard
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Jobs scout */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center">
            <FiBriefcase size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white">Jobs scout</h3>
            <p className="text-[11px] text-[#666]">
              Active openings at target companies that match your experience.
            </p>
          </div>
          {jobsState && (
            <span className="text-[10px] font-mono text-[#666] flex items-center gap-1">
              <FiClock size={10} />
              {relTime(jobsState.runAt)}
            </span>
          )}
          <button
            type="button"
            onClick={runJobs}
            disabled={jobsBusy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-xs shadow-[0_4px_15px_rgba(255,107,0,0.35)] hover:scale-[1.03] disabled:opacity-60"
          >
            <FiZap size={12} />
            {jobsBusy ? "Scouting…" : jobsState ? "Re-run" : "Run"}
          </button>
        </div>

        <div className="space-y-3">
          {/* Profile picker — Software / SAP / Both */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[#666]">
              Background to match against
            </label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "software", label: "Software / AI" },
                  { key: "sap", label: "SAP / Enterprise" },
                  { key: "both", label: "Both" },
                ] as const
              ).map((opt) => {
                const on = profile === opt.key;
                return (
                  <button
                    type="button"
                    key={opt.key}
                    onClick={() => setProfile(opt.key)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      on
                        ? "bg-[#ff6b00]/15 border-[#ff6b00]/40 text-[#ff8c38]"
                        : "bg-white/[0.04] border-white/[0.08] text-[#999] hover:border-[#ff6b00]/30"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-[#666] mb-1.5">
                Target companies <span className="text-[#444]">(optional)</span>
              </label>
              <input
                value={companiesText}
                onChange={(e) => setCompaniesText(e.target.value)}
                placeholder="leave blank for a broad market scan"
                className="w-full px-4 py-2 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none text-xs text-white placeholder:text-[#555]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-[#666] mb-1.5">
                Location (Remote, NJ, Chicago…)
              </label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="leave blank for anywhere"
                className="w-full px-4 py-2 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none text-xs text-white placeholder:text-[#555]"
              />
            </div>
          </div>
          <input
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder='Optional: describe the role you want ("Senior AI Engineer, remote, US")'
            className="w-full px-4 py-2 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none text-xs text-white placeholder:text-[#555]"
          />
        </div>

        {jobsError && (
          <ErrorBox
            msg={jobsError}
            hint="Add TAVILY_API_KEY (free at tavily.com, 1000/mo) or BRAVE_API_KEY (free at api.search.brave.com, 2000/mo) to Vercel env so the agent has real search results to cite from."
          />
        )}

        {jobsState && !jobsBusy ? (
          <div className="mt-2 rounded-xl bg-[#0a0a0a] border border-white/[0.05] p-5">
            <ContextChips context={jobsState.context} />
            <Markdown text={jobsState.markdown} />
          </div>
        ) : !jobsState && !jobsBusy && !jobsError ? (
          <EmptyHint icon={FiBriefcase} text="No run yet — set companies and hit Run." />
        ) : null}
      </div>

      {/* Atlas Opportunities — Lucy-era portfolio scout */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-xl bg-fuchsia-500/15 text-fuchsia-300 flex items-center justify-center">
            <FiTarget size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white">Atlas — Opportunities</h3>
            <p className="text-[11px] text-[#666]">
              Buffett-scored picks that fill your portfolio gaps. HIGH ·
              WATCH · MAYBE tiering, sector-gap analysis at the bottom.
            </p>
          </div>
          {oppState && (
            <span className="text-[10px] font-mono text-[#666] flex items-center gap-1">
              <FiClock size={10} />
              {relTime(oppState.runAt)}
            </span>
          )}
          <button
            type="button"
            onClick={runOpportunities}
            disabled={oppBusy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white font-bold text-xs shadow-[0_4px_15px_rgba(217,70,239,0.35)] hover:scale-[1.03] disabled:opacity-60"
          >
            <FiZap size={12} />
            {oppBusy ? "Scanning…" : oppState ? "Re-run" : "Scan"}
          </button>
        </div>

        {oppError && (
          <ErrorBox
            msg={oppError}
            hint="Atlas needs a search provider (Tavily / Brave / SearXNG / DDG fallback). Holdings are pulled from any MCP connector exposing get_holdings — wire WealthClaude under Settings for sharper picks."
          />
        )}

        {oppState && !oppBusy ? (
          <div className="mt-2 rounded-xl bg-[#0a0a0a] border border-white/[0.05] p-5">
            <ContextChips context={oppState.context} />
            <Markdown text={oppState.markdown} />
          </div>
        ) : !oppState && !oppBusy && !oppError ? (
          <EmptyHint icon={FiTarget} text="No scan yet — hit Scan." />
        ) : null}
      </div>

      {/* Stock Screener */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center">
            <FiBarChart2 size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white">Stock Screener</h3>
            <p className="text-[11px] text-[#666]">
              Set your risk tolerance, scan the whole market, find opportunities that match.
            </p>
          </div>
          {screenState && (
            <span className="text-[10px] font-mono text-[#666] flex items-center gap-1">
              <FiClock size={10} />
              {relTime(screenState.runAt)}
            </span>
          )}
          <button
            type="button"
            onClick={runScreener}
            disabled={screenBusy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs shadow-[0_4px_15px_rgba(245,158,11,0.35)] hover:scale-[1.03] disabled:opacity-60"
          >
            <FiZap size={12} />
            {screenBusy ? "Scanning..." : screenState ? "Re-scan" : "Scan market"}
          </button>
        </div>

        {/* Risk slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono uppercase tracking-widest text-[#666]">
              Risk tolerance
            </label>
            <span className="text-xs font-bold" style={{
              color: riskLevel <= 3 ? "#22c55e" : riskLevel <= 6 ? "#f59e0b" : "#ef4444"
            }}>
              {riskLevel}/10 — {
                riskLevel <= 2 ? "Conservative" :
                riskLevel <= 4 ? "Moderate" :
                riskLevel <= 6 ? "Growth" :
                riskLevel <= 8 ? "Aggressive" : "Max Risk"
              }
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-emerald-400 font-mono">Safe</span>
            <input
              type="range"
              min={1}
              max={10}
              value={riskLevel}
              onChange={(e) => setRiskLevel(Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #22c55e, #f59e0b ${50}%, #ef4444)`,
              }}
            />
            <span className="text-[9px] text-red-400 font-mono">YOLO</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[#666] mb-1.5">
              Sector focus <span className="text-[#444]">(optional)</span>
            </label>
            <input
              value={sectorFocus}
              onChange={(e) => setSectorFocus(e.target.value)}
              placeholder="e.g. tech, healthcare, energy, AI"
              className="w-full px-4 py-2 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:border-amber-500/60 focus:outline-none text-xs text-white placeholder:text-[#555]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[#666] mb-1.5">
              Budget <span className="text-[#444]">(optional)</span>
            </label>
            <input
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. $5,000 or $10k-50k"
              className="w-full px-4 py-2 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:border-amber-500/60 focus:outline-none text-xs text-white placeholder:text-[#555]"
            />
          </div>
        </div>

        {screenError && (
          <ErrorBox msg={screenError} hint="Needs a search provider (DDG/Tavily/Brave). Holdings pulled from WealthClaude MCP to avoid duplicate recommendations." />
        )}

        {screenState && !screenBusy ? (
          <div className="mt-2 rounded-xl bg-[#0a0a0a] border border-white/[0.05] p-5">
            <ContextChips context={screenState.context} />
            <Markdown text={screenState.markdown} />
          </div>
        ) : !screenState && !screenBusy && !screenError ? (
          <EmptyHint icon={FiBarChart2} text="Set your risk level and hit Scan market." />
        ) : null}
      </div>

      {/* Footer help */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] text-[#888] leading-relaxed flex items-start gap-2">
        <FiCpu size={12} className="mt-0.5 shrink-0" />
        <p>
          Both scouts now do a REAL web search (Tavily or Brave) before the
          agent writes anything, then strictly limit the model to URLs that
          appeared in the search results — so no more hallucinated 404 Apply
          links. The News scout pulls live ticker symbols from any
          WealthClaude-style MCP connector you've enabled. The Jobs scout
          searches per company using your chosen profile + location. Results
          are cached in this browser.
        </p>
      </div>
    </section>
  );
}

function ErrorBox({ msg, hint }: { msg: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-300/90 flex items-start gap-2">
      <FiAlertTriangle size={12} className="mt-0.5 shrink-0" />
      <div>
        <p className="break-all">
          <strong className="font-semibold">Agent error:</strong> {msg}
        </p>
        {hint && <p className="mt-1 text-amber-300/70">{hint}</p>}
      </div>
    </div>
  );
}

function EmptyHint({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-[#555]">
      <Icon size={12} />
      <span>{text}</span>
    </div>
  );
}

function ContextChips({
  context,
}: {
  context?: Record<string, unknown>;
}) {
  if (!context) return null;
  const chips: string[] = [];
  if (Array.isArray(context.symbols) && context.symbols.length > 0) {
    chips.push(`${context.symbols.length} tickers`);
  }
  if (context.symbolSource) chips.push(`via ${context.symbolSource}`);
  if (Array.isArray(context.companies) && context.companies.length > 0) {
    chips.push(`${context.companies.length} companies`);
  }
  if (typeof context.provider === "string") {
    chips.push(`search: ${context.provider}`);
  }
  if (typeof context.emailCount === "number") {
    chips.push(`${context.emailCount} emails`);
  }
  if (typeof context.days === "number") {
    chips.push(`last ${context.days}d`);
  }
  if (typeof context.contactsSaved === "number" && context.contactsSaved > 0) {
    chips.push(`${context.contactsSaved} contacts saved`);
  }
  if (typeof context.indeedJobsFound === "number") {
    chips.push(`${context.indeedJobsFound} indeed listings`);
  }
  if (typeof context.risk === "number") {
    chips.push(`risk: ${context.risk}/10`);
  }
  if (typeof context.riskLabel === "string") {
    chips.push(context.riskLabel);
  }
  if (typeof context.sector === "string" && context.sector) {
    chips.push(`sector: ${context.sector}`);
  }
  if (typeof context.budget === "string" && context.budget) {
    chips.push(`budget: ${context.budget}`);
  }
  if (typeof context.profile === "string") {
    chips.push(`profile: ${context.profile}`);
  }
  if (typeof context.location === "string" && context.location) {
    chips.push(`loc: ${context.location}`);
  }
  if (typeof context.model === "string") {
    const requested = typeof context.modelRequested === "string"
      ? context.modelRequested
      : null;
    chips.push(
      requested && requested !== context.model
        ? `${context.model} (fell back from ${requested})`
        : context.model
    );
  }
  // Show how many real search hits each company landed so the user can sanity-
  // check why a company has no results.
  if (context.hitsByCompany && typeof context.hitsByCompany === "object") {
    const entries = Object.entries(
      context.hitsByCompany as Record<string, number>
    );
    const empty = entries.filter(([, n]) => n === 0).map(([k]) => k);
    if (empty.length > 0) chips.push(`no hits: ${empty.join(", ")}`);
  }
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {chips.map((c, i) => (
        <span
          key={i}
          className="text-[9px] font-mono uppercase tracking-widest px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[#888]"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

/** Lightweight Markdown renderer — H2/H3, bullets, bold, links. No deps. */
function Markdown({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  const flushList = () => {
    if (listBuffer.length === 0) return;
    out.push(
      <ul
        key={out.length}
        className="list-disc pl-5 my-3 space-y-1 text-[13px] text-[#ddd]"
      >
        {listBuffer.map((b, i) => (
          <li key={i}>{renderInline(b)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (/^\s*[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^\s*[-*]\s+/, ""));
      continue;
    }
    flushList();
    if (/^##\s+/.test(line)) {
      out.push(
        <h2
          key={out.length}
          className="text-base font-bold text-white mt-5 first:mt-0 mb-2 border-t border-white/[0.06] pt-4 first:border-0 first:pt-0"
        >
          {renderInline(line.replace(/^##\s+/, ""))}
        </h2>
      );
    } else if (/^###\s+/.test(line)) {
      out.push(
        <h3
          key={out.length}
          className="text-sm font-semibold text-white mt-3 mb-1"
        >
          {renderInline(line.replace(/^###\s+/, ""))}
        </h3>
      );
    } else if (line.trim() === "") {
      // collapse whitespace, list flush already happened
    } else {
      out.push(
        <p key={out.length} className="text-[13px] text-[#ddd] my-2 leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
  }
  flushList();
  return <div className="space-y-0">{out}</div>;
}

function renderInline(s: string): React.ReactNode {
  // Pull links + bold out into a token list.
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < s.length) {
    // [text](url)
    const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(s.slice(i));
    // **bold**
    const boldMatch = /\*\*([^*]+)\*\*/.exec(s.slice(i));
    let nextIdx = s.length;
    let kind: "link" | "bold" | null = null;
    if (linkMatch && linkMatch.index < nextIdx) {
      nextIdx = linkMatch.index;
      kind = "link";
    }
    if (boldMatch && boldMatch.index < nextIdx) {
      nextIdx = boldMatch.index;
      kind = "bold";
    }
    if (nextIdx > 0) {
      nodes.push(s.slice(i, i + nextIdx));
    }
    if (kind === "link" && linkMatch) {
      nodes.push(
        <a
          key={key++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#ff8c38] hover:underline"
        >
          {linkMatch[1]}
        </a>
      );
      i += nextIdx + linkMatch[0].length;
    } else if (kind === "bold" && boldMatch) {
      nodes.push(
        <strong key={key++} className="font-semibold text-white">
          {boldMatch[1]}
        </strong>
      );
      i += nextIdx + boldMatch[0].length;
    } else {
      i = s.length;
    }
  }
  return <>{nodes}</>;
}
