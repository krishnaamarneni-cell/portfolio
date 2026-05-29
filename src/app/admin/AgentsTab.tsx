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
} from "react-icons/fi";
import { AGENT_MODELS, DEFAULT_AGENT_MODEL } from "@/lib/agents";

type AgentState = {
  markdown: string;
  runAt: number;
  context?: Record<string, unknown>;
};

type AgentKey = "news" | "jobs" | "opportunities";

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
  const [companiesText, setCompaniesText] = useState(
    "PepsiCo, Walmart, Anthropic, OpenAI, Stripe, Databricks"
  );
  const [targetRole, setTargetRole] = useState("");
  const [profile, setProfile] = useState<"software" | "sap" | "both">("both");
  const [location, setLocation] = useState("");

  useEffect(() => {
    setNewsState(loadCached("news"));
    setJobsState(loadCached("jobs"));
    setOppState(loadCached("opportunities"));
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
                Target companies (comma separated)
              </label>
              <input
                value={companiesText}
                onChange={(e) => setCompaniesText(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none text-xs text-white"
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
