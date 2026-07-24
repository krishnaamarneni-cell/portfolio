"use client";

import { useEffect, useRef, useState } from "react";
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
  FiChevronDown,
  FiChevronUp,
  FiMessageSquare,
  FiSend,
  FiEye,
  FiBookmark,
} from "react-icons/fi";
import { AGENT_MODELS, DEFAULT_AGENT_MODEL } from "@/lib/agents";

/** A job exactly as the source feed returned it — never parsed out of the
 *  model's markdown, so the apply URL is always the real one. */
export type JobListing = {
  title: string;
  company: string | null;
  location: string | null;
  url: string;
  description: string;
  source: string;
  cached: boolean;
};

type AgentState = {
  markdown: string;
  runAt: number;
  context?: Record<string, unknown>;
  listings?: JobListing[];
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
  const [draftAttachResume, setDraftAttachResume] = useState(true);
  const [deepScanning, setDeepScanning] = useState(false);
  const [deepScanResult, setDeepScanResult] = useState<string | null>(null);

  // Stock Screener
  const [screenState, setScreenState] = useState<AgentState | null>(null);
  const [screenBusy, setScreenBusy] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);

  // Social Observer — learns your content style, suggests post ideas
  const [obsMarkdown, setObsMarkdown] = useState<string>("");
  const [obsIdeas, setObsIdeas] = useState<{ topic: string; note: string }[]>([]);
  const [obsRunAt, setObsRunAt] = useState<number | null>(null);
  const [obsBusy, setObsBusy] = useState(false);
  const [obsError, setObsError] = useState<string | null>(null);
  const [savedIdeas, setSavedIdeas] = useState<Set<number>>(new Set());
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

  // Collapsed state for agent cards — persisted in localStorage
  const COLLAPSE_KEY = "krishna_admin_agent_collapsed";
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(COLLAPSE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const toggleCollapsed = (id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  // Default all cards to collapsed on first visit (no key in localStorage yet)
  const isCollapsed = (id: string) => collapsed[id] ?? true;
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLAPSE_KEY);
      if (!raw) {
        const defaults: Record<string, boolean> = { news: true, inbox: true, jobs: true, opportunities: true, screener: true };
        window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(defaults));
        setCollapsed(defaults);
      }
    } catch {}
  }, []);

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
          listings: Array.isArray(data.listings) ? (data.listings as JobListing[]) : [],
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

  async function runObserver() {
    setObsBusy(true);
    setObsError(null);
    try {
      const r = await fetch("/api/admin/agents/observer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setObsError(data.error || "Observer failed");
        onError(data.error || "Observer failed");
      } else {
        setObsMarkdown(data.markdown || "");
        setObsIdeas(Array.isArray(data.ideas) ? data.ideas : []);
        setObsRunAt(Date.now());
        setSavedIdeas(new Set());
        onSuccess("Social Observer done");
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : "Network error";
      setObsError(m);
      onError(m);
    }
    setObsBusy(false);
  }

  async function saveIdea(idx: number, topic: string, note: string, source = "observer") {
    try {
      const r = await fetch("/api/admin/social/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", topic, note, source }),
      });
      if (r.ok) {
        setSavedIdeas((s) => new Set([...s, idx]));
        onSuccess("Saved to Social → Ideas");
      } else onError("Could not save idea");
    } catch {
      onError("Network error");
    }
  }

  /* ── Reusable collapsible agent card wrapper ── */

  return (
    <section className="space-y-4">
      {/* Compact header with floating model pill */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">Agents</h2>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
          <FiCpu size={11} className="text-[#666]" />
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-transparent text-[11px] text-[#ccc] focus:outline-none cursor-pointer max-w-[220px]"
          >
            {AGENT_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── News scout ── */}
      <AgentCard
        id="news"
        open={!isCollapsed("news")}
        onToggle={() => toggleCollapsed("news")}
        title="News scout"
        subtitle="Stocks in your portfolio, job-market trends, new AI tools — last 7 days."
        icon={FiTrendingUp}
        iconBg="bg-emerald-500/15"
        iconColor="text-emerald-300"
        accentColor="border-l-emerald-500"
        busy={newsBusy}
        hasResults={!!newsState}
        lastRunAt={newsState?.runAt}
        runLabel="Run"
        busyLabel="Scouting..."
        reRunLabel="Re-run"
        buttonGradient="bg-gradient-to-r from-[#ff6b00] to-[#ff8c38]"
        buttonTextColor="text-black"
        buttonShadow="shadow-[0_4px_15px_rgba(255,107,0,0.35)]"
        onRun={runNews}
      >
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
      </AgentCard>

      {/* ── Email Intelligence ── */}
      <AgentCard
        id="inbox"
        open={!isCollapsed("inbox")}
        onToggle={() => toggleCollapsed("inbox")}
        title="Email Intelligence"
        subtitle="Reads your inbox, categorizes every email, and flags job matches >70% against your resume."
        icon={FiMail}
        iconBg="bg-sky-500/15"
        iconColor="text-sky-300"
        accentColor="border-l-sky-500"
        busy={inboxBusy}
        hasResults={!!inboxState}
        lastRunAt={inboxState?.runAt}
        runLabel="Scan inbox"
        busyLabel="Scanning..."
        reRunLabel="Re-scan"
        buttonGradient="bg-gradient-to-r from-sky-500 to-cyan-500"
        buttonTextColor="text-white"
        buttonShadow="shadow-[0_4px_15px_rgba(14,165,233,0.35)]"
        onRun={runInbox}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-[10px] font-mono uppercase tracking-widest text-[#666]">
            Scan last
          </label>
          <div className="flex gap-1.5">
            {([
              { d: 1, label: "1d" },
              { d: 3, label: "3d" },
              { d: 7, label: "7d" },
              { d: 30, label: "30d" },
              { d: 90, label: "3mo" },
              { d: 365, label: "1yr" },
            ]).map(({ d, label }) => (
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
                {label}
              </button>
            ))}
          </div>
          <div className="border-l border-white/[0.06] h-5 mx-1" />
          <button
            type="button"
            disabled={deepScanning}
            onClick={async () => {
              setDeepScanning(true);
              setDeepScanResult(null);
              try {
                const r = await fetch("/api/admin/agents/inbox/deep-scan", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ maxEmails: 500 }),
                });
                const j = await r.json();
                if (j.ok) {
                  setDeepScanResult(`Scanned ${j.scanned} emails, found ${j.jobEmails} job-related, extracted ${j.uniqueContacts} unique contacts, saved ${j.saved} new.`);
                  onSuccess(`Deep scan: ${j.saved} contacts saved`);
                } else {
                  setDeepScanResult(`Error: ${j.error}`);
                  onError(j.error || "Deep scan failed");
                }
              } catch (err) {
                onError("Network error");
              }
              setDeepScanning(false);
            }}
            className="px-3 py-1.5 rounded-full text-xs border bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {deepScanning ? "Scanning all..." : "Deep Scan (all emails)"}
          </button>
        </div>
        {deepScanResult && (
          <p className="text-[10px] text-amber-300/80 bg-amber-500/[0.04] border border-amber-500/20 rounded-lg px-3 py-2">
            {deepScanResult}
          </p>
        )}

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

                      {/* Resume + signature controls */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-1.5 text-[10px] text-[#999] cursor-pointer">
                          <input type="checkbox" checked={draftAttachResume} onChange={(e) => setDraftAttachResume(e.target.checked)}
                            className="rounded border-white/20" />
                          <FiTarget size={10} /> Attach resume
                        </label>
                        <span className="text-[9px] text-[#555]">Signature: Krishna Amarneni · krishnaamarneni.com</span>
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
                    <div className="space-y-2">
                      <p className="text-xs text-[#ccc] leading-relaxed whitespace-pre-wrap">{d.body}</p>
                      <div className="border-t border-white/[0.04] pt-2 text-[10px] text-[#555]">
                        <p>Krishna Amarneni</p>
                        <p className="text-[#ff8c38]">krishnaamarneni.com</p>
                        {draftAttachResume && (
                          <p className="flex items-center gap-1 mt-1 text-[#666]">
                            <FiTarget size={9} /> Krishna_Amarneni_Resume.docx
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {!sent && !editing && (
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <label className="flex items-center gap-1 text-[9px] text-[#666] cursor-pointer">
                        <input type="checkbox" checked={draftAttachResume} onChange={(e) => setDraftAttachResume(e.target.checked)}
                          className="rounded border-white/20" />
                        Resume
                      </label>
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
                                customSubject: d.subject,
                                attachResume: draftAttachResume,
                              }),
                            });
                            const j = await r.json();
                            if (j.ok) {
                              setSentDrafts((prev) => new Set([...prev, i]));
                              onSuccess(`Sent to ${d.name}${j.resumeAttached ? " (with resume)" : ""}`);
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
      </AgentCard>

      {/* ── Jobs scout ── */}
      <AgentCard
        id="jobs"
        open={!isCollapsed("jobs")}
        onToggle={() => toggleCollapsed("jobs")}
        title="Jobs scout"
        subtitle="Active openings at target companies that match your experience."
        icon={FiBriefcase}
        iconBg="bg-indigo-500/15"
        iconColor="text-indigo-300"
        accentColor="border-l-indigo-500"
        busy={jobsBusy}
        hasResults={!!jobsState}
        lastRunAt={jobsState?.runAt}
        runLabel="Run"
        busyLabel="Scouting..."
        reRunLabel="Re-run"
        buttonGradient="bg-gradient-to-r from-[#ff6b00] to-[#ff8c38]"
        buttonTextColor="text-black"
        buttonShadow="shadow-[0_4px_15px_rgba(255,107,0,0.35)]"
        onRun={runJobs}
      >
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
                Location / country
              </label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="USA, India, Netherlands, Remote, NJ… (blank = anywhere)"
                className="w-full px-4 py-2 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none text-xs text-white placeholder:text-[#555]"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {["USA", "India", "Netherlands", "Remote", "Anywhere"].map((c) => {
                  const active =
                    location.trim().toLowerCase() === c.toLowerCase() ||
                    (c === "Anywhere" && !location.trim());
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setLocation(c === "Anywhere" ? "" : c)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                        active
                          ? "bg-[#ff6b00] text-black"
                          : "bg-white/[0.05] text-[#999] hover:text-white"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
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
            <PrepareKitList
              listings={jobsState.listings ?? []}
              onSuccess={onSuccess}
              onError={onError}
            />
          </div>
        ) : !jobsState && !jobsBusy && !jobsError ? (
          <EmptyHint icon={FiBriefcase} text="No run yet — set companies and hit Run." />
        ) : null}
      </AgentCard>

      {/* ── Atlas Opportunities ── */}
      <AgentCard
        id="opportunities"
        open={!isCollapsed("opportunities")}
        onToggle={() => toggleCollapsed("opportunities")}
        title="Atlas — Opportunities"
        subtitle="Buffett-scored picks that fill your portfolio gaps. HIGH / WATCH / MAYBE tiering, sector-gap analysis."
        icon={FiTarget}
        iconBg="bg-fuchsia-500/15"
        iconColor="text-fuchsia-300"
        accentColor="border-l-fuchsia-500"
        busy={oppBusy}
        hasResults={!!oppState}
        lastRunAt={oppState?.runAt}
        runLabel="Scan"
        busyLabel="Scanning..."
        reRunLabel="Re-run"
        buttonGradient="bg-gradient-to-r from-fuchsia-500 to-pink-500"
        buttonTextColor="text-white"
        buttonShadow="shadow-[0_4px_15px_rgba(217,70,239,0.35)]"
        onRun={runOpportunities}
      >
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
      </AgentCard>

      {/* ── Stock Screener ── */}
      <AgentCard
        id="screener"
        open={!isCollapsed("screener")}
        onToggle={() => toggleCollapsed("screener")}
        title="Stock Screener"
        subtitle="Set your risk tolerance, scan the whole market, find opportunities that match."
        icon={FiBarChart2}
        iconBg="bg-amber-500/15"
        iconColor="text-amber-300"
        accentColor="border-l-amber-500"
        busy={screenBusy}
        hasResults={!!screenState}
        lastRunAt={screenState?.runAt}
        runLabel="Scan market"
        busyLabel="Scanning..."
        reRunLabel="Re-scan"
        buttonGradient="bg-gradient-to-r from-amber-500 to-orange-500"
        buttonTextColor="text-black"
        buttonShadow="shadow-[0_4px_15px_rgba(245,158,11,0.35)]"
        onRun={runScreener}
      >
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
      </AgentCard>

      {/* ── Social Observer ── */}
      <AgentCard
        id="observer"
        open={!isCollapsed("observer")}
        onToggle={() => toggleCollapsed("observer")}
        title="Social Observer"
        subtitle="Remembers what you post, learns your voice, and suggests post ideas in your style — save the good ones to Social → Ideas."
        icon={FiEye}
        iconBg="bg-emerald-500/15"
        iconColor="text-emerald-300"
        accentColor="border-l-emerald-500"
        busy={obsBusy}
        hasResults={!!obsRunAt}
        lastRunAt={obsRunAt ?? undefined}
        runLabel="Observe"
        busyLabel="Reading your posts..."
        reRunLabel="Re-run"
        buttonGradient="bg-gradient-to-r from-emerald-500 to-teal-500"
        buttonTextColor="text-white"
        buttonShadow="shadow-[0_4px_15px_rgba(16,185,129,0.35)]"
        onRun={runObserver}
      >
        {obsError && (
          <ErrorBox
            msg={obsError}
            hint="Connect Buffer for real post history; it still works without it, using your profile."
          />
        )}
        {obsRunAt && !obsBusy ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#0a0a0a] border border-white/[0.05] p-5">
              <Markdown text={obsMarkdown} />
            </div>
            {obsIdeas.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
                  Suggested post ideas — save the good ones
                </h4>
                {obsIdeas.map((idea, i) => {
                  const saved = savedIdeas.has(i);
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-white/[0.06] bg-[#0f0f0f] p-3 flex items-start gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white">{idea.topic}</p>
                        {idea.note && <p className="text-[11px] text-[#888] mt-0.5">{idea.note}</p>}
                      </div>
                      <button
                        type="button"
                        disabled={saved}
                        onClick={() => saveIdea(i, idea.topic, idea.note, "observer")}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border ${
                          saved
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                            : "bg-white/[0.04] border-white/[0.08] text-[#ccc] hover:border-emerald-500/40 hover:text-emerald-300"
                        }`}
                      >
                        <FiBookmark size={10} />
                        {saved ? "Saved" : "Save idea"}
                      </button>
                    </div>
                  );
                })}
                <p className="text-[10px] text-[#555]">Saved ideas show up in Social → Ideas, ready to draft.</p>
              </div>
            )}
          </div>
        ) : !obsRunAt && !obsBusy && !obsError ? (
          <EmptyHint icon={FiEye} text="No run yet — hit Observe to learn your content style." />
        ) : null}
      </AgentCard>

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

      {/* ── Unified agent chat ── */}
      <UnifiedAgentChat
        model={model}
        onSuccess={onSuccess}
        onError={onError}
        reports={{
          news: newsState?.markdown,
          inbox: inboxState?.markdown,
          jobs: jobsState?.markdown,
          opportunities: oppState?.markdown,
          screener: screenState?.markdown,
        }}
      />
    </section>
  );
}

/* ── Unified chat: pick one agent or talk to all at once ── */
const CHAT_AGENTS: { key: string; label: string; report: string }[] = [
  { key: "all", label: "All agents", report: "" },
  { key: "news", label: "News", report: "News scout" },
  { key: "inbox", label: "Email", report: "Email Intelligence" },
  { key: "jobs", label: "Jobs", report: "Jobs scout" },
  { key: "opportunities", label: "Atlas", report: "Atlas — Opportunities" },
  { key: "screener", label: "Screener", report: "Stock Screener" },
];

function UnifiedAgentChat({
  model,
  reports,
  onSuccess,
  onError,
}: {
  model: string;
  reports: Record<string, string | undefined>;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [agent, setAgent] = useState("all");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string; who: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  /** For "all", stitch every agent's latest report together (labelled); for a
   *  single agent, just that report. */
  function reportFor(key: string): string {
    if (key !== "all") return (reports[key] || "").slice(0, 8000);
    const parts: string[] = [];
    for (const a of CHAT_AGENTS) {
      if (a.key === "all") continue;
      const r = reports[a.key];
      if (r && r.trim()) parts.push(`## ${a.report} report\n${r.slice(0, 2200)}`);
    }
    return parts.join("\n\n").slice(0, 9000);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const label = CHAT_AGENTS.find((a) => a.key === agent)?.label ?? agent;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const next = [...history, { role: "user" as const, content: text }];
    setMessages((m) => [...m, { role: "user", content: text, who: label }]);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/admin/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentKey: agent,
          messages: next,
          report: reportFor(agent) || undefined,
          model,
        }),
      });
      const j = await r.json().catch(() => ({}));
      setMessages((m) => [
        ...m,
        { role: "assistant", content: j.reply || `⚠️ ${j.error || "No response"}`, who: label },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "⚠️ Network error", who: label }]);
    }
    setBusy(false);
  }

  async function saveLastAsIdea() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    try {
      const r = await fetch("/api/admin/social/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          topic: lastUser.content.slice(0, 300),
          note: `via ${lastUser.who} chat`,
          source: "chat",
        }),
      });
      if (r.ok) onSuccess("Saved to Social → Ideas");
      else onError("Could not save idea");
    } catch {
      onError("Network error");
    }
  }

  const hasUserMsg = messages.some((m) => m.role === "user");

  return (
    <div className="rounded-2xl bg-[#0a0a0a] border border-white/[0.06] p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <FiMessageSquare size={13} className="text-emerald-300" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#888]">Chat with your agents</span>
        {hasUserMsg && (
          <button
            type="button"
            onClick={saveLastAsIdea}
            className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] text-[#999] hover:border-emerald-500/40 hover:text-emerald-300"
          >
            <FiBookmark size={10} /> Save as post idea
          </button>
        )}
      </div>

      {/* Agent picker */}
      <div className="flex flex-wrap gap-1.5">
        {CHAT_AGENTS.map((a) => {
          const on = agent === a.key;
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => setAgent(a.key)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                on
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-white/[0.04] border-white/[0.08] text-[#999] hover:border-emerald-500/30"
              }`}
            >
              {a.label}
            </button>
          );
        })}
      </div>

      {messages.length > 0 && (
        <div ref={scrollRef} className="max-h-96 overflow-y-auto space-y-2 pr-1">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-white/[0.08] text-white"
                    : "bg-white/[0.03] border border-white/[0.05] text-[#ddd]"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="text-[9px] font-mono uppercase tracking-widest text-emerald-400/70 mb-1">
                    {m.who}
                  </div>
                )}
                {m.role === "assistant" ? (
                  <Markdown text={m.content} />
                ) : (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-xl px-3 py-2 text-[11px] text-[#666] bg-white/[0.03] border border-white/[0.05] animate-pulse">
                {CHAT_AGENTS.find((a) => a.key === agent)?.label} thinking…
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
          placeholder={
            agent === "all"
              ? "Ask all your agents — e.g. 'what should I focus on this week?'"
              : `Ask ${CHAT_AGENTS.find((a) => a.key === agent)?.label}…`
          }
          className="flex-1 px-3 py-2.5 rounded-xl bg-[#1a1a1a] border border-white/[0.08] focus:border-emerald-500/40 focus:outline-none text-xs text-white placeholder:text-[#555]"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || !input.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-40"
        >
          <FiSend size={12} />
          Send
        </button>
      </div>
      <p className="text-[10px] text-[#555]">
        Grounded in each agent&apos;s latest report. Run a scan first for sharper, data-backed answers.
      </p>
    </div>
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
  if (typeof context.ideasSaved === "number" && context.ideasSaved > 0) {
    chips.push(`💡 ${context.ideasSaved} → Ideas`);
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

/**
 * Per-job "Prepare kit" actions under the Jobs scout results.
 *
 * Uses the structured listings the route returned (straight from the feeds),
 * NOT the model's markdown — so the URL sent to the kit is always the real
 * posting link.
 */
function PrepareKitList({
  listings,
  onSuccess,
  onError,
}: {
  listings: JobListing[];
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);

  if (listings.length === 0) return null;

  async function prepare(j: JobListing) {
    const key = j.url;
    setBusy(key);
    try {
      const r = await fetch("/api/admin/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          job: {
            jobTitle: j.title,
            company: j.company,
            location: j.location,
            jobUrl: j.url,
            jobDescription: j.description,
            source: j.source,
          },
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not prepare the kit");
      setDone((m) => ({ ...m, [key]: d.kit?.matchPct ?? 0 }));
      onSuccess(`Kit ready (${d.kit?.matchPct ?? 0}% match) — open the Applications tab to review.`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not prepare the kit");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/[0.06]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-[11px] font-semibold text-[#999] hover:text-white"
      >
        {open ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
        Prepare an application kit ({listings.length} listings)
      </button>

      {open && (
        <div className="mt-3 space-y-1.5 max-h-[360px] overflow-y-auto">
          {listings.map((j) => {
            const pct = done[j.url];
            return (
              <div
                key={j.url}
                className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] border border-white/[0.05] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-[12px] text-white truncate">{j.title}</p>
                  <p className="text-[10px] text-[#777] truncate">
                    {[j.company, j.location, j.source].filter(Boolean).join(" · ")}
                    {j.cached && " · cached, may be filled"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={j.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[#777] hover:text-[#ff6b00]"
                  >
                    Open
                  </a>
                  {pct != null ? (
                    <span className="text-[10px] font-bold text-emerald-400 px-2 py-1">
                      {pct}% · in Applications
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => prepare(j)}
                      disabled={busy === j.url}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 text-[10px] font-semibold hover:bg-indigo-500/25 disabled:opacity-50"
                    >
                      <FiZap size={10} />
                      {busy === j.url ? "Preparing…" : "Prepare kit"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Collapsible agent panel.
 *
 * MUST stay at module scope. It used to be declared inside AgentsTab, which
 * gave it a new function identity on every render — React then treated it as
 * a different component type, unmounted the subtree and rebuilt the DOM, so
 * any focused <input> inside lost focus after each keystroke.
 */
function AgentCard({
  id,
  title,
  subtitle,
  icon: Icon,
  iconBg,
  iconColor,
  accentColor,
  busy,
  hasResults,
  lastRunAt,
  runLabel,
  busyLabel,
  reRunLabel,
  buttonGradient,
  buttonTextColor,
  buttonShadow,
  onRun,
  children,
  open,
  onToggle,
}: {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number }>;
  iconBg: string;
  iconColor: string;
  accentColor: string;
  busy: boolean;
  hasResults: boolean;
  lastRunAt?: number;
  runLabel: string;
  busyLabel: string;
  reRunLabel: string;
  buttonGradient: string;
  buttonTextColor: string;
  buttonShadow: string;
  onRun: () => void;
  children: React.ReactNode;
  /** Hoisted out of the parent: passing these in (rather than closing over
   *  parent state) keeps this component's identity stable across renders. */
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border bg-[#1a1a1a] overflow-hidden transition-all duration-200 border-l-2 ${accentColor} ${
        busy
          ? "border-white/[0.15] animate-pulse"
          : "border-white/[0.06]"
      }`}
    >
      {/* Header — always visible */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className={`w-8 h-8 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}>
          <Icon size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-sm leading-tight">{title}</h3>
            {!open && (
              <span className="text-[11px] text-[#555] truncate hidden sm:inline">{subtitle}</span>
            )}
          </div>
        </div>
        {lastRunAt && (
          <span className="text-[10px] font-mono text-[#555] flex items-center gap-1 shrink-0">
            <FiClock size={10} />
            {relTime(lastRunAt)}
          </span>
        )}
        <span className={`w-2 h-2 rounded-full shrink-0 ${hasResults ? "bg-emerald-400" : "bg-[#333]"}`} />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRun(); }}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full ${buttonGradient} ${buttonTextColor} font-bold text-[11px] ${buttonShadow} hover:scale-[1.03] disabled:opacity-60 shrink-0 transition-transform`}
        >
          <FiZap size={11} />
          {busy ? busyLabel : hasResults ? reRunLabel : runLabel}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="text-[#555] hover:text-white transition-colors shrink-0 p-0.5"
        >
          {open ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
        </button>
      </div>
      {/* Expanded content */}
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/[0.04]">
          <p className="text-[11px] text-[#666] pt-3">{subtitle}</p>
          {children}
        </div>
      )}
    </div>
  );
}
