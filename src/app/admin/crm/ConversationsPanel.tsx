"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FiRefreshCw,
  FiMessageSquare,
  FiArrowLeft,
  FiSearch,
  FiChevronRight,
  FiChevronDown,
  FiInbox,
  FiSend,
  FiBriefcase,
  FiCornerUpLeft,
  FiCornerUpRight,
  FiUsers,
  FiEdit3,
  FiZap,
  FiPaperclip,
  FiX,
} from "react-icons/fi";
import { type CachedThread, type ThreadMessage, timeAgo } from "./types";

type Props = {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
};

type ThreadListItem = CachedThread & {
  contact_name?: string | null;
  company_name?: string | null;
};

export default function ConversationsPanel({ onSuccess, onError }: Props) {
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedThread, setSelectedThread] = useState<CachedThread | null>(null);
  const [detail, setDetail] = useState<ThreadMessage[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [syncing, setSyncing] = useState(false);
  const [syncDays, setSyncDays] = useState(30);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/crm/threads?limit=500");
    const d = await r.json().catch(() => ({ threads: [] }));
    setThreads(d.threads ?? []);
    setLoading(false);
  }

  async function syncInbox(days: number) {
    setSyncing(true);
    try {
      const r = await fetch("/api/admin/crm/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync-inbox", days, limit: 200 }),
      });
      const d = await r.json();
      if (r.ok) {
        onSuccess(`Pulled ${d.synced} threads from last ${days} days (${d.skipped} already cached)`);
        await load();
      } else {
        onError(d.error || "Sync failed");
      }
    } catch {
      onError("Network error");
    }
    setSyncing(false);
  }

  useEffect(() => { load(); }, []);

  async function openThread(t: ThreadListItem) {
    setSelectedThread(t);
    if (t.cached_messages?.length) {
      setDetail(t.cached_messages);
      return;
    }
    setLoadingDetail(true);
    const r = await fetch(`/api/admin/crm/threads?threadId=${t.id}`);
    const d = await r.json().catch(() => ({}));
    setDetail(d.thread?.cached_messages ?? []);
    setLoadingDetail(false);
  }

  const filtered = useMemo(() => {
    let list = threads;
    if (directionFilter !== "all") {
      list = list.filter((t) => t.direction === directionFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          (t.subject?.toLowerCase().includes(q) ?? false) ||
          (t.snippet?.toLowerCase().includes(q) ?? false) ||
          t.participants.some((p) => p.toLowerCase().includes(q)) ||
          (t.company_name?.toLowerCase().includes(q) ?? false) ||
          (t.contact_name?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [threads, search, directionFilter]);

  const stats = useMemo(() => ({
    total: threads.length,
    inbound: threads.filter((t) => t.direction === "inbound").length,
    outbound: threads.filter((t) => t.direction === "outbound").length,
    totalMessages: threads.reduce((s, t) => s + t.message_count, 0),
  }), [threads]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FiRefreshCw size={20} className="animate-spin text-[#ff6b00]" />
      </div>
    );
  }

  if (selectedThread) {
    return (
      <ThreadDetail
        thread={selectedThread}
        messages={detail}
        loadingMessages={loadingDetail}
        onBack={() => { setSelectedThread(null); setDetail(null); }}
        onSuccess={onSuccess}
        onError={onError}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Threads" value={stats.total} />
        <Stat label="Inbound" value={stats.inbound} />
        <Stat label="Outbound" value={stats.outbound} />
        <Stat label="Messages" value={stats.totalMessages} />
      </div>

      {/* Search + filter + refresh */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by subject, participant, company..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)]"
          />
        </div>
        <div className="flex gap-1 bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-1">
          {(["all", "inbound", "outbound"] as const).map((dir) => (
            <button
              key={dir}
              onClick={() => setDirectionFilter(dir)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                directionFilter === dir
                  ? "bg-[#ff6b00] text-white"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
              }`}
            >
              {dir === "all" ? "All" : dir === "inbound" ? "Inbound" : "Outbound"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-1">
          {([
            { d: 1, label: "1d" },
            { d: 7, label: "7d" },
            { d: 30, label: "30d" },
            { d: 90, label: "90d" },
          ] as const).map(({ d, label }) => (
            <button
              key={d}
              onClick={() => setSyncDays(d)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                syncDays === d
                  ? "bg-[#ff6b00]/15 text-[#ff6b00]"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          disabled={syncing}
          onClick={() => syncInbox(syncDays)}
          className="px-4 py-2.5 rounded-xl bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00] disabled:opacity-50 flex items-center gap-2"
        >
          <FiRefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Pulling Gmail..." : "Sync Gmail Inbox"}
        </button>
        <button
          onClick={load}
          className="px-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm font-semibold text-[var(--admin-text-secondary)] hover:border-[#ff6b00] flex items-center gap-2"
        >
          <FiRefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Thread list - Gmail style */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--admin-text-muted)] text-sm">
          {threads.length === 0
            ? "No conversations synced yet. Select a time range and click \"Sync Gmail Inbox\" to pull all threads."
            : "No threads match your search."
          }
        </div>
      ) : (
        <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] divide-y divide-[var(--admin-border)] overflow-hidden">
          {filtered.map((t) => (
            <ThreadRow key={t.id} thread={t} onOpen={() => openThread(t)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadRow({ thread: t, onOpen }: { thread: ThreadListItem; onOpen: () => void }) {
  const isUnread = t.direction === "inbound";
  return (
    <div
      onClick={onOpen}
      className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--admin-surface-hover)] transition-colors cursor-pointer group"
    >
      {/* Direction icon */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isUnread ? "bg-blue-500/10" : "bg-emerald-500/10"
      }`}>
        {isUnread ? (
          <FiInbox size={14} className="text-blue-400" />
        ) : (
          <FiSend size={14} className="text-emerald-400" />
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Sender / participants */}
          <span className={`text-sm truncate max-w-[180px] ${isUnread ? "font-semibold text-[var(--admin-text)]" : "text-[var(--admin-text-secondary)]"}`}>
            {t.participants?.length > 0
              ? t.participants.slice(0, 2).map((p) => p.split("@")[0].split("<")[0].trim()).join(", ")
              : "Unknown"
            }
          </span>
          {t.participants?.length > 2 && (
            <span className="text-[10px] text-[var(--admin-text-muted)]">+{t.participants.length - 2}</span>
          )}
        </div>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className={`text-sm truncate ${isUnread ? "font-medium text-[var(--admin-text)]" : "text-[var(--admin-text-secondary)]"}`}>
            {t.subject || "(no subject)"}
          </span>
          <span className="text-xs text-[var(--admin-text-muted)] truncate hidden sm:inline">
            — {t.snippet?.slice(0, 80)}
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 shrink-0">
        {t.company_name && (
          <span className="hidden md:flex items-center gap-1 text-[10px] text-[var(--admin-text-muted)] px-2 py-0.5 rounded-full bg-[var(--admin-surface-hover)] border border-[var(--admin-border)]">
            <FiBriefcase size={10} />{t.company_name}
          </span>
        )}
        {t.intent && (
          <span className="hidden lg:inline text-[10px] text-purple-400">{t.intent}</span>
        )}
        {t.message_count > 1 && (
          <span className="text-[10px] text-[var(--admin-text-muted)] bg-[var(--admin-surface-hover)] px-1.5 py-0.5 rounded">
            {t.message_count}
          </span>
        )}
        <span className="text-[10px] text-[var(--admin-text-muted)] min-w-[50px] text-right">
          {timeAgo(t.last_message_at)}
        </span>
        <FiChevronRight size={12} className="text-[var(--admin-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

/* ── email helpers ── */
function extractEmail(s: string): string {
  const m = /<([^>]+)>/.exec(s || "");
  return (m ? m[1] : s || "").trim();
}
function senderName(s: string): string {
  const nm = (s || "").split("<")[0].trim().replace(/^"|"$/g, "");
  return nm || extractEmail(s) || "Unknown";
}
const SELF_HINTS = ["krishnaamarneni", "avgk26", "krishna.amarneni"];
function isSelf(email: string): boolean {
  const l = email.toLowerCase();
  return SELF_HINTS.some((h) => l.includes(h));
}
function pickReplyTo(m: ThreadMessage): string {
  const f = extractEmail(m.from);
  return isSelf(f) ? extractEmail(m.to) : f;
}
function replyAllRecipients(msgs: ThreadMessage[]): string {
  const set = new Set<string>();
  for (const m of msgs) {
    for (const field of [m.from, m.to, m.cc]) {
      if (!field) continue;
      for (const part of field.split(",")) {
        const e = extractEmail(part).toLowerCase();
        if (e && e.includes("@") && !isSelf(e)) set.add(e);
      }
    }
  }
  return Array.from(set).join(", ");
}
function quoteMessage(m: ThreadMessage): string {
  return `\n\n---------- Forwarded message ----------\nFrom: ${m.from}\nDate: ${m.date}\nSubject: ${m.subject}\n\n${m.bodyText || m.snippet || ""}`;
}

type ComposerMode = "reply" | "replyAll" | "forward" | "new";
const MODE_LABEL: Record<ComposerMode, string> = {
  reply: "Reply",
  replyAll: "Reply all",
  forward: "Forward",
  new: "New email",
};

function ThreadDetail({
  thread,
  messages,
  loadingMessages,
  onBack,
  onSuccess,
  onError,
}: {
  thread: ThreadListItem;
  messages: ThreadMessage[] | null;
  loadingMessages: boolean;
  onBack: () => void;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const msgs = useMemo(() => messages ?? [], [messages]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [composer, setComposer] = useState<{ mode: ComposerMode; to: string; subject: string; body: string } | null>(null);

  useEffect(() => {
    // Gmail-style: collapse all but the latest message on open.
    setExpanded(new Set(msgs.length ? [msgs.length - 1] : []));
    setComposer(null);
  }, [messages, msgs.length]);

  const threadContext = useMemo(
    () =>
      msgs
        .slice(-6)
        .map((m) => `From: ${m.from}\nDate: ${m.date}\nSubject: ${m.subject}\n\n${m.bodyText || m.snippet || ""}`)
        .join("\n\n----\n\n"),
    [msgs]
  );

  function toggle(i: number) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  function openComposer(mode: ComposerMode) {
    const last = msgs[msgs.length - 1];
    const baseSubj = (thread.subject || "").replace(/^(re|fwd):\s*/i, "").trim();
    let to = "";
    let subject = "";
    let body = "";
    if (mode === "reply") {
      to = last ? pickReplyTo(last) : "";
      subject = baseSubj ? `Re: ${baseSubj}` : "";
    } else if (mode === "replyAll") {
      to = replyAllRecipients(msgs);
      subject = baseSubj ? `Re: ${baseSubj}` : "";
    } else if (mode === "forward") {
      subject = baseSubj ? `Fwd: ${baseSubj}` : "";
      body = last ? quoteMessage(last) : "";
    }
    setComposer({ mode, to, subject, body });
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-[#ff6b00] font-semibold hover:underline"
      >
        <FiArrowLeft size={14} /> Back to threads
      </button>

      {/* Thread header */}
      <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-5">
        <h3 className="font-bold text-[var(--admin-text)] text-lg">{thread.subject || "(no subject)"}</h3>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className="text-xs text-[var(--admin-text-muted)]">{thread.message_count} messages</span>
          <span className="text-xs text-[var(--admin-text-muted)]">{timeAgo(thread.last_message_at)}</span>
          {thread.intent && (
            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px]">
              {thread.intent} ({Math.round((thread.intent_confidence ?? 0) * 100)}%)
            </span>
          )}
          {thread.company_name && (
            <span className="flex items-center gap-1 text-xs text-[var(--admin-text-muted)]">
              <FiBriefcase size={11} /> {thread.company_name}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      {loadingMessages ? (
        <div className="flex items-center justify-center py-8 text-[var(--admin-text-muted)] text-sm gap-2">
          <FiRefreshCw size={14} className="animate-spin" /> Loading messages...
        </div>
      ) : msgs.length > 0 ? (
        <div className="space-y-2">
          {msgs.map((m, i) => {
            const open = expanded.has(i);
            return (
              <div key={i} className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--admin-surface-hover)] transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    {senderName(m.from)[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--admin-text)] truncate">{senderName(m.from)}</span>
                      <span className="text-[10px] text-[var(--admin-text-muted)] shrink-0 ml-auto">
                        {m.date ? new Date(m.date).toLocaleString() : ""}
                      </span>
                    </div>
                    {open ? (
                      <p className="text-[10px] text-[var(--admin-text-muted)] truncate">To: {m.to}</p>
                    ) : (
                      <p className="text-xs text-[var(--admin-text-muted)] truncate">
                        {m.snippet || m.bodyText?.slice(0, 100) || ""}
                      </p>
                    )}
                  </div>
                  <FiChevronDown
                    size={14}
                    className={`text-[var(--admin-text-muted)] shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
                  />
                </button>
                {open && (
                  <div className="px-4 pb-4 pt-3 border-t border-[var(--admin-border)] text-sm text-[var(--admin-text-secondary)] whitespace-pre-wrap break-words leading-relaxed">
                    {m.bodyText || m.snippet || "(empty)"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--admin-text-muted)] text-sm">
          No message content cached. Sync this contact to pull messages.
        </div>
      )}

      {/* Reply action bar */}
      {!composer && (
        <div className="flex flex-wrap gap-2">
          <ActionBtn icon={<FiCornerUpLeft size={13} />} label="Reply" onClick={() => openComposer("reply")} primary disabled={msgs.length === 0} />
          <ActionBtn icon={<FiUsers size={13} />} label="Reply all" onClick={() => openComposer("replyAll")} disabled={msgs.length === 0} />
          <ActionBtn icon={<FiCornerUpRight size={13} />} label="Forward" onClick={() => openComposer("forward")} disabled={msgs.length === 0} />
          <ActionBtn icon={<FiEdit3 size={13} />} label="New email" onClick={() => openComposer("new")} />
        </div>
      )}

      {composer && (
        <Composer
          key={composer.mode}
          mode={composer.mode}
          initialTo={composer.to}
          initialSubject={composer.subject}
          initialBody={composer.body}
          threadContext={threadContext}
          onClose={() => setComposer(null)}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  primary,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 ${
        primary
          ? "bg-[#ff6b00] text-white hover:bg-[#e55d00]"
          : "bg-[var(--admin-surface)] border border-[var(--admin-border)] text-[var(--admin-text-secondary)] hover:border-[#ff6b00] hover:text-[#ff6b00]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Composer({
  mode,
  initialTo,
  initialSubject,
  initialBody,
  threadContext,
  onClose,
  onSuccess,
  onError,
}: {
  mode: ComposerMode;
  initialTo: string;
  initialSubject: string;
  initialBody: string;
  threadContext: string;
  onClose: () => void;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [hint, setHint] = useState("");
  const [attach, setAttach] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiBody, setAiBody] = useState(false);
  const [aiSubj, setAiSubj] = useState(false);

  async function call(payload: Record<string, unknown>) {
    const r = await fetch("/api/admin/crm/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: r.ok, json: await r.json().catch(() => ({})) };
  }

  async function writeBody() {
    setAiBody(true);
    try {
      const { ok, json } = await call({ action: "ai-body", context: threadContext, instruction: hint || undefined });
      if (ok && json.draft) setBody(json.draft);
      else onError(json.error || "Couldn't draft a reply");
    } catch {
      onError("Network error");
    }
    setAiBody(false);
  }

  async function writeSubject() {
    setAiSubj(true);
    try {
      const { ok, json } = await call({ action: "ai-subject", context: threadContext });
      if (ok && json.subject) setSubject(json.subject);
      else onError(json.error || "Couldn't suggest a subject");
    } catch {
      onError("Network error");
    }
    setAiSubj(false);
  }

  async function send() {
    if (!to.trim()) return onError("Add a recipient");
    if (!body.trim()) return onError("Write a message");
    setSending(true);
    try {
      const { ok, json } = await call({ action: "send", to, subject, body, attachResume: attach });
      if (ok && json.ok) {
        onSuccess(`Sent via ${json.provider}`);
        onClose();
      } else onError(json.error || "Send failed");
    } catch {
      onError("Network error");
    }
    setSending(false);
  }

  const inputCls =
    "w-full px-3 py-2 rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] focus:border-[#ff6b00] focus:outline-none text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)]";

  return (
    <div className="bg-[var(--admin-surface)] rounded-xl border border-[#ff6b00]/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#ff6b00]">{MODE_LABEL[mode]}</span>
        <button type="button" onClick={onClose} className="text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]">
          <FiX size={16} />
        </button>
      </div>

      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To (comma-separated)" className={inputCls} />

      <div className="flex gap-2">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={inputCls + " flex-1"} />
        <button
          type="button"
          onClick={writeSubject}
          disabled={aiSubj}
          title="Write subject with AI"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs font-medium text-purple-400 hover:bg-purple-500/20 disabled:opacity-50 shrink-0"
        >
          <FiZap size={12} />
          {aiSubj ? "…" : "AI subject"}
        </button>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={8}
        placeholder="Write your message, or use ‘Write with AI’…"
        className={inputCls + " resize-y leading-relaxed"}
      />

      {/* AI write toolbar */}
      <div className="flex gap-2">
        <input
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="Optional AI hint: ‘decline politely’, ‘ask for a call Tuesday’…"
          className={inputCls + " flex-1 text-xs"}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); writeBody(); } }}
        />
        <button
          type="button"
          onClick={writeBody}
          disabled={aiBody}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs font-medium text-purple-400 hover:bg-purple-500/20 disabled:opacity-50 shrink-0"
        >
          <FiZap size={12} />
          {aiBody ? "Writing…" : "Write with AI"}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="inline-flex items-center gap-1.5 text-xs text-[var(--admin-text-secondary)] cursor-pointer select-none">
          <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} className="accent-[#ff6b00]" />
          <FiPaperclip size={12} /> Attach resume
        </label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg text-xs text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]">
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ff6b00] text-white text-xs font-semibold hover:bg-[#e55d00] disabled:opacity-50"
          >
            <FiSend size={12} />
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] px-4 py-3">
      <p className="text-xl font-bold text-[var(--admin-text)]">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)] mt-0.5">{label}</p>
    </div>
  );
}
