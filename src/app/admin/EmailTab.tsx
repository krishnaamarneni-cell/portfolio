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
} from "react-icons/fi";

type EmailSubTab = "inbox" | "sent" | "compose" | "bulk";

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

const TABS: Array<{ id: EmailSubTab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "inbox", label: "Inbox", icon: FiInbox },
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

      {tab === "inbox" ? (
        <InboxPanel onError={onError} />
      ) : tab === "sent" ? (
        <SentPanel onError={onError} />
      ) : tab === "compose" ? (
        <ComposePanel onSuccess={onSuccess} onError={onError} />
      ) : (
        <BulkPanel onSuccess={onSuccess} onError={onError} />
      )}
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
  /right to represent/i,
  /profile.*submit/i,
  /submit.*profile/i,
  /submission.*confirm/i,
  /candidate.*submit/i,
  /submit.*candidate/i,
  /submit.*client/i,
  /presented.*to.*client/i,
  /forwarded.*to.*hiring/i,
  /application.*submitted/i,
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

function InboxPanel({ onError }: { onError: (m: string) => void }) {
  const [rawMessages, setRawMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirFilter, setDirFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [dateRange, setDateRange] = useState(30);
  const [typeFilter, setTypeFilter] = useState<"all" | "replies" | "rtr">("all");

  const load = useCallback(async (days: number, q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const afterDate = new Date();
      afterDate.setDate(afterDate.getDate() - days);
      const afterStr = `${afterDate.getFullYear()}/${afterDate.getMonth() + 1}/${afterDate.getDate()}`;
      const queryParts = [`after:${afterStr}`];
      if (q) queryParts.push(q);
      params.set("q", queryParts.join(" "));
      params.set("max", "100");
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
  }, []);

  useEffect(() => { load(dateRange); }, [load, dateRange]);

  const grouped = useMemo(() => groupByThread(rawMessages), [rawMessages]);

  const filtered = useMemo(() => {
    let list = grouped;
    if (dirFilter !== "all") list = list.filter((t) => t.direction === dirFilter);
    if (typeFilter === "replies") list = list.filter((t) => t.hasReplies);
    if (typeFilter === "rtr") list = list.filter((t) => t.isRTR);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        t.subject.toLowerCase().includes(q) ||
        t.snippet.toLowerCase().includes(q) ||
        t.participants.some((p) => p.toLowerCase().includes(q))
      );
    }
    return list;
  }, [grouped, dirFilter, typeFilter, search]);

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
        <button
          onClick={() => setThread(null)}
          className="inline-flex items-center gap-2 text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
        >
          <FiChevronLeft size={14} /> Back to Inbox
        </button>
        <ThreadView thread={thread} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {([
          { label: "Threads", value: stats.threads },
          { label: "Inbound", value: stats.inbound },
          { label: "Outbound", value: stats.outbound },
          { label: "Messages", value: stats.messages },
          { label: "Has Replies", value: stats.replies },
          { label: "RTR / Submitted", value: stats.rtr },
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
            onKeyDown={(e) => { if (e.key === "Enter") load(dateRange, search); }}
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
            { d: 1, label: "1d" },
            { d: 7, label: "7d" },
            { d: 30, label: "30d" },
            { d: 90, label: "90d" },
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
          onClick={() => load(dateRange, search)}
          className="px-4 py-2.5 rounded-xl bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00] disabled:opacity-50 flex items-center gap-2"
        >
          <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {loading ? "Pulling Gmail..." : "Sync Gmail Inbox"}
        </button>

        <button
          onClick={() => load(dateRange, search)}
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
