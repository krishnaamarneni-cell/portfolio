"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  FiInbox,
  FiSend,
  FiEdit3,
  FiRefreshCw,
  FiSearch,
  FiChevronLeft,
  FiMail,
  FiAlertCircle,
  FiCheck,
  FiUsers,
  FiExternalLink,
  FiUploadCloud,
  FiSlash,
  FiFilter,
  FiMessageSquare,
  FiArrowRight,
  FiClipboard,
  FiPlus,
  FiTrash2,
  FiEdit,
} from "react-icons/fi";

type EmailSubTab = "inbox" | "sent" | "compose" | "bulk" | "submissions";

type InboxMessage = {
  id: string;
  threadId: string;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  snippet?: string;
};

type ThreadMessage = {
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

type ThreadData = {
  id: string;
  messages: ThreadMessage[];
  subject: string;
  messageCount: number;
};

type Submission = {
  id: string;
  thread_id: string | null;
  recruiter_email: string;
  recruiter_name: string | null;
  staffing_company: string | null;
  client_company: string | null;
  job_title: string | null;
  location: string | null;
  rate: string | null;
  employment_type: string | null;
  status: string;
  notes: string | null;
  submitted_at: string;
  followed_up_at: string | null;
  contact_id: string | null;
  created_at: string;
  updated_at: string;
};

const TABS: Array<{ id: EmailSubTab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "inbox", label: "Inbox", icon: FiInbox },
  { id: "submissions", label: "Submissions", icon: FiClipboard },
  { id: "sent", label: "Sent", icon: FiSend },
  { id: "compose", label: "Compose", icon: FiEdit3 },
  { id: "bulk", label: "Bulk Send", icon: FiUsers },
];

export default function EmailTab({
  onSuccess,
  onError,
}: {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [tab, setTab] = useState<EmailSubTab>("inbox");

  return (
    <div className="space-y-6">
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                active
                  ? "bg-[#ff6b00] text-white shadow-md"
                  : "bg-[var(--admin-surface)] border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] hover:border-[#ff6b00]/30"
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: tab === "inbox" ? "block" : "none" }}>
        <InboxPanel onError={onError} onSuccess={onSuccess} />
      </div>
      <div style={{ display: tab === "submissions" ? "block" : "none" }}>
        <SubmissionsPanel onSuccess={onSuccess} onError={onError} />
      </div>
      <div style={{ display: tab === "sent" ? "block" : "none" }}>
        <SentPanel onError={onError} />
      </div>
      <div style={{ display: tab === "compose" ? "block" : "none" }}>
        <ComposePanel onSuccess={onSuccess} onError={onError} />
      </div>
      <div style={{ display: tab === "bulk" ? "block" : "none" }}>
        <BulkPanel onSuccess={onSuccess} onError={onError} />
      </div>
    </div>
  );
}

/* ───────── THREAD VIEW (shared) ───────── */

function ThreadView({ thread }: { thread: ThreadData }) {
  return (
    <div className="bg-[var(--admin-surface)] rounded-2xl border border-[var(--admin-border)] overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--admin-border)]">
        <h3 className="font-bold text-[var(--admin-text)]">{thread.subject || "(no subject)"}</h3>
        <p className="text-xs text-[var(--admin-text-muted)] mt-1">{thread.messageCount} message{thread.messageCount !== 1 ? "s" : ""}</p>
      </div>
      <div className="divide-y divide-[var(--admin-border)]">
        {thread.messages.map((msg) => (
          <div key={msg.id} className="px-6 py-4">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--admin-text)] truncate">{msg.from}</p>
                <p className="text-xs text-[var(--admin-text-muted)]">To: {msg.to}</p>
              </div>
              <span className="text-xs text-[var(--admin-text-muted)] whitespace-nowrap shrink-0">
                {formatDate(msg.date)}
              </span>
            </div>
            {msg.bodyHtml ? (
              <div
                className="text-sm text-[var(--admin-text-secondary)] leading-relaxed prose prose-sm max-w-none [&_a]:text-[#ff6b00] overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
              />
            ) : (
              <p className="text-sm text-[var(--admin-text-secondary)] whitespace-pre-wrap leading-relaxed">{msg.bodyText}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── helpers for inbox ───────── */

const SELF_HINTS = ["krishnaamarneni", "avgk26", "krishna.amarneni", "jobs@krishnaamarneni"];
function isSelf(addr?: string): boolean {
  if (!addr) return false;
  const l = addr.toLowerCase();
  return SELF_HINTS.some((h) => l.includes(h));
}

const RTR_PATTERNS = [
  /\brtr\b/i,
  /right.to.represent/i,
  /authorize.*represent/i,
  /represent.*candidate/i,
  /confirm.*rate/i,
  /rate.*confirm/i,
];
function isRTR(msg: InboxMessage): boolean {
  const text = `${msg.subject || ""} ${msg.snippet || ""}`;
  return RTR_PATTERNS.some((p) => p.test(text));
}

type GroupedThread = {
  threadId: string;
  subject: string;
  latestDate: string;
  snippet: string;
  messages: InboxMessage[];
  messageCount: number;
  direction: "inbound" | "outbound";
  hasReplies: boolean;
  isRTR: boolean;
  participants: string[];
};

function groupByThread(messages: InboxMessage[]): GroupedThread[] {
  const map = new Map<string, InboxMessage[]>();
  for (const m of messages) {
    const list = map.get(m.threadId) || [];
    list.push(m);
    map.set(m.threadId, list);
  }
  const threads: GroupedThread[] = [];
  for (const [threadId, msgs] of map) {
    msgs.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    const latest = msgs[0];
    const first = msgs[msgs.length - 1];
    const direction = isSelf(first.from) ? "outbound" : "inbound";
    const allParticipants = new Set<string>();
    for (const m of msgs) {
      if (m.from) allParticipants.add(m.from);
      if (m.to) allParticipants.add(m.to);
    }
    threads.push({
      threadId,
      subject: latest.subject || first.subject || "(no subject)",
      latestDate: latest.date || "",
      snippet: latest.snippet || "",
      messages: msgs,
      messageCount: msgs.length,
      direction,
      hasReplies: msgs.length > 1,
      isRTR: msgs.some(isRTR),
      participants: [...allParticipants],
    });
  }
  threads.sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());
  return threads;
}

/* ───────── INBOX ───────── */

function InboxPanel({ onError, onSuccess }: { onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const [rawMessages, setRawMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirFilter, setDirFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [dateRange, setDateRange] = useState(60);
  const [typeFilter, setTypeFilter] = useState<"all" | "replies" | "rtr">("all");

  const RTR_GMAIL_QUERY = '{rtr OR "right to represent" OR "authorize us to represent" OR "rate confirmation" OR "confirm your rate"}';

  const buildQuery = useCallback((days: number, dir: "all" | "inbound" | "outbound", type: "all" | "replies" | "rtr", q?: string) => {
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - days);
    const afterStr = `${afterDate.getFullYear()}/${afterDate.getMonth() + 1}/${afterDate.getDate()}`;
    const parts = [`after:${afterStr}`];
    if (dir === "inbound") parts.push("-from:me");
    if (dir === "outbound") parts.push("from:me");
    if (type === "rtr") parts.push(RTR_GMAIL_QUERY);
    if (q) parts.push(q);
    return parts.join(" ");
  }, []);

  const load = useCallback(async (days: number, dir: "all" | "inbound" | "outbound", type: "all" | "replies" | "rtr", q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("q", buildQuery(days, dir, type, q));
      params.set("max", type === "rtr" ? "300" : "200");
      const txt = await fetch(`/api/admin/email/inbox?${params}`).then((r) => r.text());
      try {
        const data = JSON.parse(txt);
        if (data.error) setError(data.error);
        else setRawMessages(data.messages ?? []);
      } catch {
        setError("Invalid response from server");
      }
    } catch {
      setError("Failed to load inbox");
    }
    setLoading(false);
  }, [buildQuery]);

  useEffect(() => { load(dateRange, dirFilter, typeFilter); }, [load, dateRange, dirFilter, typeFilter]);

  const grouped = useMemo(() => groupByThread(rawMessages), [rawMessages]);

  const filtered = useMemo(() => {
    let list = grouped;
    if (typeFilter === "replies") list = list.filter((t) => t.hasReplies);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        t.subject.toLowerCase().includes(q) ||
        t.snippet.toLowerCase().includes(q) ||
        t.participants.some((p) => p.toLowerCase().includes(q))
      );
    }
    return list;
  }, [grouped, typeFilter, search]);

  const stats = useMemo(() => ({
    threads: grouped.length,
    inbound: grouped.filter((t) => t.direction === "inbound").length,
    outbound: grouped.filter((t) => t.direction === "outbound").length,
    messages: rawMessages.length,
    replies: grouped.filter((t) => t.hasReplies).length,
    rtr: grouped.filter((t) => t.isRTR).length,
  }), [grouped, rawMessages]);

  async function openThread(threadId: string) {
    setThreadLoading(true);
    try {
      const txt = await fetch(`/api/admin/email/inbox?threadId=${threadId}`).then((r) => r.text());
      try {
        const data = JSON.parse(txt);
        if (data.thread) setThread(data.thread);
        else onError("Could not load thread");
      } catch { onError("Invalid thread response"); }
    } catch { onError("Failed to load thread"); }
    setThreadLoading(false);
  }

  if (thread) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setThread(null)}
            className="inline-flex items-center gap-2 text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
          >
            <FiChevronLeft size={14} /> Back to Inbox
          </button>
          <TrackSubmissionButton thread={thread} onSuccess={onSuccess} onError={onError} />
        </div>
        <ThreadView thread={thread} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { label: "Threads", value: stats.threads },
          { label: "Inbound", value: stats.inbound },
          { label: "Outbound", value: stats.outbound },
          { label: "Messages", value: stats.messages },
        ] as const).map((s) => (
          <div key={s.label} className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] px-4 py-3">
            <p className="text-xl font-bold text-[var(--admin-text)]">{s.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters + Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(dateRange, dirFilter, typeFilter, search); }}
            placeholder="Search by subject, sender, company..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)]"
          />
        </div>

        {/* Direction filter */}
        <div className="flex gap-1 bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-1">
          {(["all", "inbound", "outbound"] as const).map((dir) => (
            <button
              key={dir}
              onClick={() => setDirFilter(dir)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                dirFilter === dir
                  ? "bg-[#ff6b00] text-white"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
              }`}
            >
              {dir === "all" ? "All" : dir === "inbound" ? "Inbound" : "Outbound"}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1 bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-1">
          {([
            { d: 7, label: "7d" },
            { d: 30, label: "30d" },
            { d: 60, label: "60d" },
            { d: 90, label: "90d" },
            { d: 180, label: "180d" },
          ] as const).map(({ d, label }) => (
            <button
              key={d}
              onClick={() => setDateRange(d)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                dateRange === d
                  ? "bg-[#ff6b00]/15 text-[#ff6b00]"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sync Gmail */}
        <button
          disabled={loading}
          onClick={() => load(dateRange, dirFilter, typeFilter, search)}
          className="px-4 py-2.5 rounded-xl bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00] disabled:opacity-50 flex items-center gap-2"
        >
          <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {loading ? "Pulling Gmail..." : "Sync Gmail Inbox"}
        </button>

        <button
          onClick={() => load(dateRange, dirFilter, typeFilter, search)}
          className="px-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm font-semibold text-[var(--admin-text-secondary)] hover:border-[#ff6b00] flex items-center gap-2"
        >
          <FiRefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Type filters */}
      <div className="flex gap-2 flex-wrap">
        {([
          { id: "all" as const, label: "All Threads", count: grouped.length },
          { id: "replies" as const, label: "Has Replies", count: stats.replies },
          { id: "rtr" as const, label: "RTR / Submitted", count: stats.rtr },
        ]).map((f) => (
          <button
            key={f.id}
            onClick={() => setTypeFilter(f.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              typeFilter === f.id
                ? "bg-[#ff6b00]/15 border-[#ff6b00]/40 text-[#ff8c38]"
                : "bg-[var(--admin-surface)] border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:border-[#ff6b00]/30 hover:text-[var(--admin-text)]"
            }`}
          >
            {f.id === "replies" && <FiMessageSquare size={11} />}
            {f.id === "rtr" && <FiArrowRight size={11} />}
            {f.id === "all" && <FiFilter size={11} />}
            {f.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              typeFilter === f.id ? "bg-[#ff6b00]/20" : "bg-[var(--admin-surface-hover)]"
            }`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <FiAlertCircle size={16} />
          {error}
        </div>
      )}

      {loading && rawMessages.length === 0 ? (
        <div className="text-center py-16 text-[var(--admin-text-muted)] text-sm">
          <FiRefreshCw size={20} className="animate-spin mx-auto mb-3" />
          Loading inbox...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--admin-text-muted)] text-sm">
          <FiInbox size={28} className="mx-auto mb-3 opacity-40" />
          {rawMessages.length === 0 ? "Gmail might not be connected. Click Sync Gmail Inbox." : "No threads match your filters."}
        </div>
      ) : (
        <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] divide-y divide-[var(--admin-border)] overflow-hidden">
          {filtered.map((t) => (
            <button
              key={t.threadId}
              onClick={() => openThread(t.threadId)}
              disabled={threadLoading}
              className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-[var(--admin-surface-hover)] transition-colors group"
            >
              {/* Direction icon */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                t.direction === "inbound" ? "bg-blue-500/10" : "bg-emerald-500/10"
              }`}>
                {t.direction === "inbound" ? (
                  <FiInbox size={14} className="text-blue-400" />
                ) : (
                  <FiSend size={14} className="text-emerald-400" />
                )}
              </div>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm truncate max-w-[200px] ${
                    t.direction === "inbound" ? "font-semibold text-[var(--admin-text)]" : "text-[var(--admin-text-secondary)]"
                  }`}>
                    {t.participants
                      .filter((p) => !isSelf(p))
                      .slice(0, 2)
                      .map((p) => extractName(p))
                      .join(", ") || extractName(t.messages[0]?.from)}
                  </span>
                  {t.participants.filter((p) => !isSelf(p)).length > 2 && (
                    <span className="text-[10px] text-[var(--admin-text-muted)]">+{t.participants.filter((p) => !isSelf(p)).length - 2}</span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className={`text-sm truncate ${
                    t.direction === "inbound" ? "font-medium text-[var(--admin-text)]" : "text-[var(--admin-text-secondary)]"
                  }`}>
                    {t.subject}
                  </span>
                  <span className="text-xs text-[var(--admin-text-muted)] truncate hidden sm:inline">
                    — {t.snippet.slice(0, 80)}
                  </span>
                </div>
              </div>

              {/* Meta badges */}
              <div className="flex items-center gap-2 shrink-0">
                {t.isRTR && (
                  <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                    RTR
                  </span>
                )}
                {t.messageCount > 1 && (
                  <span className="text-[10px] text-[var(--admin-text-muted)] bg-[var(--admin-surface-hover)] px-1.5 py-0.5 rounded font-medium">
                    {t.messageCount}
                  </span>
                )}
                <span className="text-[10px] text-[var(--admin-text-muted)] min-w-[50px] text-right">
                  {formatDate(t.latestDate)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── SENT ───────── */

function SentPanel({ onError }: { onError: (m: string) => void }) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("q", q ? `in:sent ${q}` : "in:sent");
      params.set("max", "40");
      const txt = await fetch(`/api/admin/email/inbox?${params}`).then((r) => r.text());
      try {
        const data = JSON.parse(txt);
        setMessages(data.messages ?? []);
      } catch { /* */ }
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openThread(threadId: string) {
    setThreadLoading(true);
    try {
      const txt = await fetch(`/api/admin/email/inbox?threadId=${threadId}`).then((r) => r.text());
      try {
        const data = JSON.parse(txt);
        if (data.thread) setThread(data.thread);
        else onError("Could not load thread");
      } catch { onError("Invalid thread response"); }
    } catch { onError("Failed to load thread"); }
    setThreadLoading(false);
  }

  if (thread) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setThread(null)}
          className="inline-flex items-center gap-2 text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
        >
          <FiChevronLeft size={14} /> Back to Sent
        </button>
        <ThreadView thread={thread} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(query); }}
            placeholder="Search sent emails..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none placeholder:text-[var(--admin-text-muted)]"
          />
        </div>
        <button
          onClick={() => load(query)}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] hover:border-[#ff6b00]/30 disabled:opacity-50"
        >
          <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading && messages.length === 0 ? (
        <div className="text-center py-16 text-[var(--admin-text-muted)] text-sm">
          <FiRefreshCw size={20} className="animate-spin mx-auto mb-3" />
          Loading sent emails...
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-16 text-[var(--admin-text-muted)] text-sm">
          <FiSend size={28} className="mx-auto mb-3 opacity-40" />
          No sent emails found.
        </div>
      ) : (
        <div className="bg-[var(--admin-surface)] rounded-2xl border border-[var(--admin-border)] overflow-hidden">
          <div className="divide-y divide-[var(--admin-border)]">
            {messages.map((msg) => (
              <button
                key={msg.id}
                onClick={() => openThread(msg.threadId)}
                disabled={threadLoading}
                className="w-full text-left px-5 py-3.5 hover:bg-[var(--admin-surface-hover)] transition-colors flex items-start gap-4"
              >
                <FiSend size={15} className="text-[var(--admin-text-muted)] mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--admin-text)] truncate">To: {extractName(msg.to) || extractName(msg.from)}</p>
                    <span className="text-[11px] text-[var(--admin-text-muted)] whitespace-nowrap shrink-0">{formatDate(msg.date)}</span>
                  </div>
                  <p className="text-sm text-[var(--admin-text-secondary)] truncate">{msg.subject || "(no subject)"}</p>
                  <p className="text-xs text-[var(--admin-text-muted)] truncate mt-0.5">{msg.snippet}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── COMPOSE ───────── */

function ComposePanel({
  onSuccess,
  onError,
}: {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [provider, setProvider] = useState<"auto" | "resend">("auto");
  const [aiLoading, setAiLoading] = useState<"subject" | "message" | null>(null);

  async function aiRewrite(field: "subject" | "message") {
    setAiLoading(field);
    try {
      const r = await fetch("/api/admin/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ai-rewrite",
          field,
          to: to.trim(),
          currentSubject: subject,
          currentMessage: message,
        }),
      });
      const d = await r.json();
      if (d.subject && field === "subject") setSubject(d.subject);
      if (d.message && field === "message") setMessage(d.message);
    } catch {
      onError("AI rewrite failed");
    }
    setAiLoading(null);
  }

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !message.trim()) {
      onError("To, Subject, and Message are all required");
      return;
    }
    setSending(true);
    try {
      const txt = await fetch("/api/admin/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          message: message.trim(),
          provider: provider === "resend" ? "resend" : undefined,
        }),
      }).then((r) => r.text());
      try {
        const data = JSON.parse(txt);
        if (data.ok) {
          onSuccess(`Email sent via ${data.provider || "auto"}`);
          setTo("");
          setSubject("");
          setMessage("");
        } else {
          onError(data.error || "Send failed");
        }
      } catch {
        onError("Invalid response from server");
      }
    } catch {
      onError("Network error");
    }
    setSending(false);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-[var(--admin-surface)] rounded-2xl border border-[var(--admin-border)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--admin-border)] flex items-center gap-2">
          <FiEdit3 size={16} className="text-[#ff6b00]" />
          <h3 className="font-bold text-[var(--admin-text)]">New Email</h3>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">To</label>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none placeholder:text-[var(--admin-text-muted)]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Subject</label>
              <button
                onClick={() => aiRewrite("subject")}
                disabled={!!aiLoading || !message.trim()}
                className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 disabled:opacity-50 flex items-center gap-1"
              >
                {aiLoading === "subject" ? <FiRefreshCw size={10} className="animate-spin" /> : <span>&#10022;</span>}
                {aiLoading === "subject" ? "Writing..." : "Rewrite with AI"}
              </button>
            </div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none placeholder:text-[var(--admin-text-muted)]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Message</label>
              <button
                onClick={() => aiRewrite("message")}
                disabled={!!aiLoading || (!subject.trim() && !message.trim())}
                className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 disabled:opacity-50 flex items-center gap-1"
              >
                {aiLoading === "message" ? <FiRefreshCw size={10} className="animate-spin" /> : <span>&#10022;</span>}
                {aiLoading === "message" ? "Writing..." : "Rewrite with AI"}
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your email..."
              rows={10}
              className="w-full px-4 py-3 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none placeholder:text-[var(--admin-text-muted)] resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Send via</label>
            <div className="flex gap-2">
              {(["auto", "resend"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    provider === p
                      ? "bg-[#ff6b00]/15 border-[#ff6b00]/40 text-[#ff8c38]"
                      : "bg-[var(--admin-surface-hover)] border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:border-[#ff6b00]/30"
                  }`}
                >
                  {p === "auto" ? "Auto (Gmail first)" : "Resend (@krishnaamarneni.com)"}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleSend}
              disabled={sending || !to.trim() || !subject.trim() || !message.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#ff6b00] text-white font-semibold text-sm shadow-md hover:bg-[#e55d00] disabled:opacity-50 transition-colors"
            >
              {sending ? <FiRefreshCw size={14} className="animate-spin" /> : <FiSend size={14} />}
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── BULK SEND ───────── */

function BulkPanel({
  onSuccess,
  onError,
}: {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [contacts, setContacts] = useState<Array<{
    id: string;
    name: string;
    email: string;
    company: string | null;
    do_not_contact: boolean;
    excluded_from_bulk: boolean;
    bounced: boolean;
    times_contacted: number;
    contact_type: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [roleSeeking, setRoleSeeking] = useState("");
  const [attachResume, setAttachResume] = useState(true);
  const [resumeInfo, setResumeInfo] = useState<{ url: string; name: string } | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const resumeUploadRef = useRef<HTMLInputElement>(null);
  const [generating, setGenerating] = useState<"both" | "subject" | "message" | null>(null);
  const [sending, setSending] = useState(false);
  const [sendVia, setSendVia] = useState<"auto" | "resend">("auto");

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const txt = await fetch("/api/admin/contacts?limit=2000").then((r) => r.text());
      try {
        const data = JSON.parse(txt);
        setContacts(data.contacts ?? []);
      } catch { /* */ }
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  useEffect(() => {
    fetch("/api/admin/resume")
      .then((r) => r.json())
      .then((j) => { if (j.url) setResumeInfo({ url: j.url, name: j.name || "Resume" }); })
      .catch(() => {});
  }, []);

  async function uploadResume(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingResume(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/admin/resume", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) onError(j.error || "Upload failed");
      else {
        setResumeInfo({ url: j.url, name: j.name || file.name });
        onSuccess("Resume updated");
      }
    } catch { onError("Upload failed"); }
    setUploadingResume(false);
    if (resumeUploadRef.current) resumeUploadRef.current.value = "";
  }

  const eligible = contacts.filter(
    (c) => !c.do_not_contact && !c.excluded_from_bulk && !c.bounced
  );
  const excluded = contacts.filter(
    (c) => c.do_not_contact || c.excluded_from_bulk || c.bounced
  );

  const contactContext = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    const companySet = new Set<string>();
    for (const c of eligible) {
      typeCounts[c.contact_type] = (typeCounts[c.contact_type] || 0) + 1;
      if (c.company) companySet.add(c.company);
    }
    return {
      types: Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([t]) => t),
      companies: [...companySet].slice(0, 10),
    };
  }, [eligible]);

  async function generateDraft(field: "both" | "subject" | "message", roleOverride?: string) {
    setGenerating(field);
    try {
      const r = await fetch("/api/admin/contacts/email/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-draft",
          field,
          count: eligible.length,
          contactTypes: contactContext.types,
          companies: contactContext.companies,
          currentSubject: subject,
          currentMessage: message,
          roleSeeking: (roleOverride ?? roleSeeking) || undefined,
        }),
      });
      const d = await r.json();
      if (d.subject !== undefined && field !== "message") setSubject(d.subject);
      if (d.message !== undefined && field !== "subject") setMessage(d.message);
    } catch {
      onError("AI generation failed");
    }
    setGenerating(null);
  }

  useEffect(() => {
    if (eligible.length > 0 && !subject && !message) generateDraft("both");
  }, [eligible.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    if (!subject.trim() || !message.trim()) {
      onError("Subject and message are required");
      return;
    }
    if (eligible.length === 0) {
      onError("No eligible contacts to send to");
      return;
    }
    setSending(true);
    try {
      const r = await fetch("/api/admin/contacts/email/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactIds: eligible.map((c) => c.id),
          subject: subject.trim(),
          message: message.trim(),
          attachResume,
          roleSeeking,
          sendVia,
        }),
      });
      const d = await r.json();
      if (d.started) {
        const skipMsg = d.skipped ? ` (${d.skipped} skipped)` : "";
        onSuccess(
          `Sending to ${d.total} contact${d.total !== 1 ? "s" : ""} in the background${skipMsg}. Track progress in the Sent tab.`
        );
      } else if (d.error) {
        onError(d.error);
      }
    } catch {
      onError("Network error");
    }
    setSending(false);
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-[var(--admin-text-muted)] text-sm">
        <FiRefreshCw size={20} className="animate-spin mx-auto mb-3" />
        Loading contacts...
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex gap-3">
        <div className="flex-1 bg-emerald-500/10 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-emerald-500">{eligible.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-emerald-400">Will receive</p>
        </div>
        {excluded.length > 0 && (
          <div className="flex-1 bg-red-500/10 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-red-500">{excluded.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-red-400">Excluded</p>
          </div>
        )}
      </div>

      {excluded.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
          <FiSlash size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-500">
            <p className="font-semibold">These contacts will NOT receive email:</p>
            {excluded.slice(0, 5).map((c) => (
              <p key={c.id} className="mt-0.5">
                {c.name || c.email} — {c.do_not_contact ? "Do Not Contact" : c.bounced ? "Bounced" : "Excluded from bulk"}
              </p>
            ))}
            {excluded.length > 5 && <p className="mt-0.5">...and {excluded.length - 5} more</p>}
          </div>
        </div>
      )}

      {/* Role seeking */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">
          Role you&apos;re seeking
        </label>
        <div className="flex gap-2">
          <input
            value={roleSeeking}
            onChange={(e) => setRoleSeeking(e.target.value)}
            placeholder="e.g. SAP S/4HANA Consultant, AI/ML Engineer, Supply Chain Analyst"
            onKeyDown={(e) => { if (e.key === "Enter") generateDraft("both"); }}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none placeholder:text-[var(--admin-text-muted)]"
          />
          <button
            onClick={() => generateDraft("both")}
            disabled={!!generating}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-xs font-semibold text-purple-300 hover:bg-purple-500/25 disabled:opacity-50"
          >
            {generating === "both" ? <FiRefreshCw size={11} className="animate-spin" /> : <span>&#10022;</span>}
            {generating === "both" ? "Writing..." : "Generate"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            "SAP MM/SD Consultant",
            "SAP S/4HANA Consultant",
            "AI/ML Engineer",
            "Business Systems Analyst",
            "Supply Chain Analyst",
          ].map((r) => {
            const active = roleSeeking.trim().toLowerCase() === r.toLowerCase();
            return (
              <button
                key={r}
                type="button"
                disabled={!!generating}
                onClick={() => { setRoleSeeking(r); generateDraft("both", r); }}
                className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors disabled:opacity-50 ${
                  active
                    ? "bg-[#ff6b00]/15 border-[#ff6b00]/40 text-[#ff8c38]"
                    : "bg-[var(--admin-surface-hover)] border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:border-[#ff6b00]/40 hover:text-[#ff8c38]"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-[var(--admin-text-muted)]">
          Pick a role above (or type one) — the email will target that specific role, not both. You can still edit below.
        </p>
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Subject</label>
          <button
            onClick={() => generateDraft("subject")}
            disabled={!!generating}
            className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 disabled:opacity-50 flex items-center gap-1"
          >
            {generating === "subject" ? <FiRefreshCw size={10} className="animate-spin" /> : <span>&#10022;</span>}
            {generating === "subject" ? "Generating..." : "Rewrite with AI"}
          </button>
        </div>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={generating === "both" ? "AI is generating..." : "Email subject"}
          className="w-full px-4 py-2.5 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none placeholder:text-[var(--admin-text-muted)]"
        />
      </div>

      {/* Message */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Message</label>
          <button
            onClick={() => generateDraft("message")}
            disabled={!!generating}
            className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 disabled:opacity-50 flex items-center gap-1"
          >
            {generating === "message" ? <FiRefreshCw size={10} className="animate-spin" /> : <span>&#10022;</span>}
            {generating === "message" ? "Generating..." : "Rewrite with AI"}
          </button>
        </div>
        <div className="relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            placeholder={generating === "both" ? "AI is generating your email..." : "Write your email message... (greeting and signature are added automatically)"}
            className="w-full px-4 py-2.5 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none resize-none placeholder:text-[var(--admin-text-muted)]"
          />
          {generating === "both" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[var(--admin-input-bg)]/80">
              <div className="flex items-center gap-2 text-sm text-purple-400">
                <FiRefreshCw size={14} className="animate-spin" />
                AI is writing your email...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resume attach */}
      <label className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)] cursor-pointer">
        <input
          type="checkbox"
          checked={attachResume}
          onChange={(e) => setAttachResume(e.target.checked)}
          className="rounded border-[var(--admin-border)] text-[#ff6b00] focus:ring-[#ff6b00]"
        />
        Attach resume file (PDF/DOCX)
      </label>

      {attachResume && (
        <div className="rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)] font-semibold">
                Resume that will be attached
              </p>
              <p className="text-xs text-[var(--admin-text)] truncate">
                {resumeInfo?.name || "Krishna_Amarneni_Resume.docx (default)"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {resumeInfo?.url && (
                <a
                  href={resumeInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#ff6b00] hover:underline inline-flex items-center gap-1"
                >
                  <FiExternalLink size={12} /> View
                </a>
              )}
              <button
                type="button"
                onClick={() => resumeUploadRef.current?.click()}
                disabled={uploadingResume}
                className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)] hover:border-[#ff6b00] hover:text-[#ff6b00] disabled:opacity-50"
              >
                <FiUploadCloud size={12} /> {uploadingResume ? "Uploading..." : "Upload new"}
              </button>
              <input
                ref={resumeUploadRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={uploadResume}
              />
            </div>
          </div>
          <p className="text-[10px] text-[var(--admin-text-muted)]">
            Click <span className="text-[var(--admin-text-secondary)]">View</span> to check the exact file, or{" "}
            <span className="text-[var(--admin-text-secondary)]">Upload new</span> to replace it before sending —
            this file is attached to every email.
          </p>
        </div>
      )}

      {/* Send via */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Send via</label>
        <div className="flex gap-2">
          {(["auto", "resend"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSendVia(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                sendVia === v
                  ? "bg-[#ff6b00]/15 border-[#ff6b00]/40 text-[#ff8c38]"
                  : "bg-[var(--admin-surface-hover)] border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:border-[#ff6b00]/30"
              }`}
            >
              {v === "auto" ? "Auto (Gmail first)" : "Resend (@krishnaamarneni.com)"}
            </button>
          ))}
        </div>
      </div>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={sending || eligible.length === 0 || !subject.trim() || !message.trim()}
        className="w-full py-3 rounded-xl bg-[#ff6b00] text-white font-semibold hover:bg-[#e55d00] disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {sending ? (
          <><FiRefreshCw size={14} className="animate-spin" /> Sending...</>
        ) : (
          <><FiSend size={14} /> Send to {eligible.length} contact{eligible.length !== 1 ? "s" : ""}</>
        )}
      </button>
    </div>
  );
}

/* ───────── TRACK SUBMISSION BUTTON ───────── */

function TrackSubmissionButton({
  thread,
  onSuccess,
  onError,
}: {
  thread: ThreadData;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const firstMsg = thread.messages[0];
      const recruiterMsg = thread.messages.find((m) => !isSelf(m.from)) || firstMsg;
      const recruiterEmail = recruiterMsg.from.match(/<([^>]+)>/)?.[1] || recruiterMsg.from.split("<")[0].trim();
      const recruiterName = recruiterMsg.from.split("<")[0].replace(/"/g, "").trim() || null;

      const extractRes = await fetch("/api/admin/email/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract",
          subject: thread.subject,
          snippet: recruiterMsg.snippet,
          body: recruiterMsg.bodyText,
        }),
      });
      const extracted = await extractRes.json();

      const r = await fetch("/api/admin/email/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: thread.id,
          recruiter_email: recruiterEmail,
          recruiter_name: extracted.recruiter_name || recruiterName,
          staffing_company: extracted.staffing_company,
          client_company: extracted.client_company,
          job_title: extracted.job_title || thread.subject.replace(/^(re|fwd|rtr)[:\s]*/i, "").trim(),
          location: extracted.location,
          rate: extracted.rate,
          employment_type: extracted.employment_type,
          status: "submitted",
        }),
      });
      const d = await r.json();
      if (d.ok) onSuccess("Submission tracked! View in Submissions tab.");
      else onError(d.error || "Failed to save");
    } catch {
      onError("Failed to save submission");
    }
    setSaving(false);
  }

  return (
    <button
      onClick={save}
      disabled={saving}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-sm font-semibold text-purple-300 hover:bg-purple-500/25 disabled:opacity-50"
    >
      {saving ? <FiRefreshCw size={14} className="animate-spin" /> : <FiClipboard size={14} />}
      {saving ? "Extracting..." : "Track Submission"}
    </button>
  );
}

/* ───────── SUBMISSIONS PANEL ───────── */

const STATUS_OPTIONS = [
  { value: "submitted", label: "Submitted", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  { value: "interviewing", label: "Interviewing", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { value: "offered", label: "Offered", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { value: "accepted", label: "Accepted", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { value: "rejected", label: "Rejected", color: "text-red-400 bg-red-500/10 border-red-500/20" },
  { value: "declined", label: "Declined", color: "text-red-400 bg-red-500/10 border-red-500/20" },
  { value: "no_response", label: "No Response", color: "text-gray-400 bg-gray-500/10 border-gray-500/20" },
] as const;

function statusStyle(status: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.color || "text-gray-400 bg-gray-500/10 border-gray-500/20";
}

function SubmissionsPanel({ onSuccess, onError }: { onSuccess: (m: string) => void; onError: (m: string) => void }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [tableNeeded, setTableNeeded] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Submission | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/email/submissions");
      const d = await r.json();
      setSubmissions(d.submissions ?? []);
      if (d.tableNeeded) setTableNeeded(true);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function scanRTR() {
    setScanning(true);
    try {
      const r = await fetch("/api/admin/email/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan-rtr", days: 180 }),
      });
      const d = await r.json();
      if (d.ok) {
        onSuccess(`Scanned ${d.scanned} RTR threads: ${d.created} new, ${d.skipped} already tracked`);
        await load();
      } else {
        onError(d.error || "Scan failed");
      }
    } catch {
      onError("RTR scan failed");
    }
    setScanning(false);
  }

  async function updateStatus(id: string, status: string) {
    const r = await fetch("/api/admin/email/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, status }),
    });
    const d = await r.json();
    if (d.ok) {
      setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    } else {
      onError(d.error || "Update failed");
    }
  }

  async function markFollowedUp(id: string) {
    const now = new Date().toISOString();
    const r = await fetch("/api/admin/email/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, followed_up_at: now }),
    });
    const d = await r.json();
    if (d.ok) {
      setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, followed_up_at: now } : s)));
      onSuccess("Marked as followed up");
    }
  }

  async function deleteSubmission(id: string) {
    const r = await fetch("/api/admin/email/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    const d = await r.json();
    if (d.ok) {
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      onSuccess("Submission removed");
    }
  }

  async function saveEdit(sub: Submission) {
    const r = await fetch("/api/admin/email/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        id: sub.id,
        recruiter_name: sub.recruiter_name,
        staffing_company: sub.staffing_company,
        client_company: sub.client_company,
        job_title: sub.job_title,
        location: sub.location,
        rate: sub.rate,
        employment_type: sub.employment_type,
        status: sub.status,
        notes: sub.notes,
      }),
    });
    const d = await r.json();
    if (d.ok) {
      setSubmissions((prev) => prev.map((s) => (s.id === sub.id ? sub : s)));
      setEditing(null);
      onSuccess("Submission updated");
    } else {
      onError(d.error || "Update failed");
    }
  }

  const filtered = useMemo(() => {
    let list = submissions;
    if (statusFilter !== "all") list = list.filter((s) => s.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        (s.recruiter_name?.toLowerCase().includes(q) ?? false) ||
        s.recruiter_email.toLowerCase().includes(q) ||
        (s.client_company?.toLowerCase().includes(q) ?? false) ||
        (s.staffing_company?.toLowerCase().includes(q) ?? false) ||
        (s.job_title?.toLowerCase().includes(q) ?? false) ||
        (s.location?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [submissions, statusFilter, search]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of submissions) counts[s.status] = (counts[s.status] || 0) + 1;
    return counts;
  }, [submissions]);

  if (editing) {
    return <EditSubmissionForm sub={editing} onSave={saveEdit} onCancel={() => setEditing(null)} />;
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] px-4 py-3">
          <p className="text-xl font-bold text-[var(--admin-text)]">{submissions.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)] mt-0.5">Total</p>
        </div>
        <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] px-4 py-3">
          <p className="text-xl font-bold text-blue-400">{stats["submitted"] || 0}</p>
          <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)] mt-0.5">Submitted</p>
        </div>
        <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] px-4 py-3">
          <p className="text-xl font-bold text-amber-400">{stats["interviewing"] || 0}</p>
          <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)] mt-0.5">Interviewing</p>
        </div>
        <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] px-4 py-3">
          <p className="text-xl font-bold text-gray-400">{stats["no_response"] || 0}</p>
          <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)] mt-0.5">No Response</p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by recruiter, company, role, location..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)]"
          />
        </div>
        <div className="flex gap-1 bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-1 overflow-x-auto">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === "all" ? "bg-[#ff6b00] text-white" : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
            }`}
          >
            All
          </button>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === s.value ? "bg-[#ff6b00] text-white" : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
              }`}
            >
              {s.label} {stats[s.value] ? `(${stats[s.value]})` : ""}
            </button>
          ))}
        </div>
        <button
          onClick={scanRTR}
          disabled={scanning || loading}
          className="px-4 py-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-sm font-semibold text-purple-300 hover:bg-purple-500/25 disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          <FiUploadCloud size={14} className={scanning ? "animate-spin" : ""} />
          {scanning ? "Scanning Gmail..." : "Scan RTR Emails"}
        </button>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm font-semibold text-[var(--admin-text-secondary)] hover:border-[#ff6b00] flex items-center gap-2 shrink-0"
        >
          <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {tableNeeded ? (
        <div className="text-center py-16 text-[var(--admin-text-muted)] text-sm space-y-2">
          <FiAlertCircle size={28} className="mx-auto mb-3 text-amber-400" />
          <p className="font-semibold text-amber-400">Migration needed</p>
          <p>Run <code className="bg-[var(--admin-surface-hover)] px-2 py-0.5 rounded text-xs">supabase/rtr_submissions.sql</code> in the Supabase SQL Editor to enable submissions tracking.</p>
        </div>
      ) : loading && submissions.length === 0 ? (
        <div className="text-center py-16 text-[var(--admin-text-muted)] text-sm">
          <FiRefreshCw size={20} className="animate-spin mx-auto mb-3" />
          Loading submissions...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--admin-text-muted)] text-sm">
          <FiClipboard size={28} className="mx-auto mb-3 opacity-40" />
          {submissions.length === 0
            ? "No submissions tracked yet. Open an RTR email in Inbox and click \"Track Submission\"."
            : "No submissions match your filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((sub) => (
            <div
              key={sub.id}
              className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-[var(--admin-text)] truncate">
                    {sub.job_title || "Untitled Role"}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {sub.client_company && (
                      <span className="text-xs text-[var(--admin-text-secondary)]">
                        Client: <span className="font-medium text-[var(--admin-text)]">{sub.client_company}</span>
                      </span>
                    )}
                    {sub.staffing_company && (
                      <span className="text-xs text-[var(--admin-text-muted)]">via {sub.staffing_company}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={sub.status}
                    onChange={(e) => updateStatus(sub.id, e.target.value)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium border cursor-pointer appearance-none pr-6 bg-[length:12px] bg-[right_4px_center] bg-no-repeat ${statusStyle(sub.status)}`}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%239ca3af' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")` }}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--admin-text-muted)]">
                {sub.recruiter_name && <span>Recruiter: {sub.recruiter_name}</span>}
                <span>{sub.recruiter_email}</span>
                {sub.location && <span>{sub.location}</span>}
                {sub.rate && <span className="font-medium text-emerald-400">{sub.rate}</span>}
                {sub.employment_type && <span className="font-medium">{sub.employment_type}</span>}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--admin-border)]">
                <div className="flex items-center gap-3 text-[10px] text-[var(--admin-text-muted)]">
                  <span>Submitted {formatDate(sub.submitted_at)}</span>
                  {sub.followed_up_at && (
                    <span className="text-emerald-400">Followed up {formatDate(sub.followed_up_at)}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!sub.followed_up_at && (
                    <button
                      onClick={() => markFollowedUp(sub.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[#ff6b00]/10 text-[#ff6b00] border border-[#ff6b00]/20 hover:bg-[#ff6b00]/20"
                    >
                      <FiCheck size={10} /> Followed Up
                    </button>
                  )}
                  <button
                    onClick={() => setEditing(sub)}
                    className="p-1.5 rounded-lg text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] hover:bg-[var(--admin-surface-hover)]"
                    title="Edit"
                  >
                    <FiEdit size={12} />
                  </button>
                  <button
                    onClick={() => deleteSubmission(sub.id)}
                    className="p-1.5 rounded-lg text-[var(--admin-text-muted)] hover:text-red-400 hover:bg-red-500/10"
                    title="Delete"
                  >
                    <FiTrash2 size={12} />
                  </button>
                </div>
              </div>

              {sub.notes && (
                <p className="text-xs text-[var(--admin-text-muted)] italic">{sub.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditSubmissionForm({
  sub,
  onSave,
  onCancel,
}: {
  sub: Submission;
  onSave: (s: Submission) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(sub);
  const set = (key: keyof Submission, val: string | null) => setForm((f) => ({ ...f, [key]: val }));
  const inputCls = "w-full px-3 py-2 rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] focus:border-[#ff6b00] focus:outline-none text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)]";

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <button onClick={onCancel} className="inline-flex items-center gap-2 text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]">
        <FiChevronLeft size={14} /> Back
      </button>
      <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-5 space-y-4">
        <h3 className="font-bold text-[var(--admin-text)]">Edit Submission</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Job Title</label>
            <input value={form.job_title || ""} onChange={(e) => set("job_title", e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Client Company</label>
            <input value={form.client_company || ""} onChange={(e) => set("client_company", e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Staffing Company</label>
            <input value={form.staffing_company || ""} onChange={(e) => set("staffing_company", e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Recruiter Name</label>
            <input value={form.recruiter_name || ""} onChange={(e) => set("recruiter_name", e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Location</label>
            <input value={form.location || ""} onChange={(e) => set("location", e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Rate</label>
            <input value={form.rate || ""} onChange={(e) => set("rate", e.target.value)} placeholder="$45/hr" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Employment Type</label>
            <select value={form.employment_type || ""} onChange={(e) => set("employment_type", e.target.value)} className={inputCls}>
              <option value="">Select</option>
              <option value="W2">W2</option>
              <option value="C2C">C2C</option>
              <option value="1099">1099</option>
              <option value="Full-Time">Full-Time</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Status</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Notes</label>
          <textarea
            value={form.notes || ""}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            placeholder="Add notes..."
            className={inputCls + " resize-y"}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]">Cancel</button>
          <button onClick={() => onSave(form)} className="px-4 py-2 rounded-lg bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00]">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Helpers ───────── */

function extractName(from?: string): string {
  if (!from) return "(unknown)";
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return from.split("@")[0] || from;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}
