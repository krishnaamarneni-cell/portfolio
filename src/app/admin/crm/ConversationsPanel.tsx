"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FiRefreshCw,
  FiMessageSquare,
  FiArrowLeft,
  FiSearch,
  FiChevronRight,
  FiInbox,
  FiSend,
  FiBriefcase,
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

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/crm/threads?limit=100");
    const d = await r.json().catch(() => ({ threads: [] }));
    setThreads(d.threads ?? []);
    setLoading(false);
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
        <button
          disabled={syncing}
          onClick={async () => {
            setSyncing(true);
            try {
              const r = await fetch("/api/admin/crm/threads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "sync-all", limit: 100 }),
              });
              const d = await r.json();
              if (r.ok) {
                onSuccess(`Synced ${d.threadsSynced} threads from ${d.contactsProcessed} contacts`);
                await load();
              } else {
                onError(d.error || "Sync failed");
              }
            } catch {
              onError("Network error");
            }
            setSyncing(false);
          }}
          className="px-4 py-2.5 rounded-xl bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00] disabled:opacity-50 flex items-center gap-2"
        >
          <FiRefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing..." : "Sync All Contacts"}
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
            ? "No conversations synced yet. Click \"Sync All Contacts\" above to pull Gmail threads for all contacts."
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

function ThreadDetail({
  thread,
  messages,
  loadingMessages,
  onBack,
}: {
  thread: ThreadListItem;
  messages: ThreadMessage[] | null;
  loadingMessages: boolean;
  onBack: () => void;
}) {
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
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
            thread.direction === "inbound"
              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          }`}>
            {thread.direction}
          </span>
          {thread.company_name && (
            <span className="flex items-center gap-1 text-xs text-[var(--admin-text-muted)]">
              <FiBriefcase size={11} /> {thread.company_name}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--admin-text-muted)] mt-2">
          Participants: {thread.participants?.join(", ") ?? "unknown"}
        </p>
      </div>

      {/* Messages */}
      {loadingMessages ? (
        <div className="flex items-center justify-center py-8 text-[var(--admin-text-muted)] text-sm gap-2">
          <FiRefreshCw size={14} className="animate-spin" /> Loading messages...
        </div>
      ) : messages && messages.length > 0 ? (
        <div className="space-y-3">
          {messages.map((m, i) => (
            <div key={i} className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                  {(m.from || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--admin-text)] truncate">{m.from}</p>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--admin-text-muted)]">
                    <span>{m.date ? new Date(m.date).toLocaleString() : ""}</span>
                    {m.to && <span className="truncate">To: {m.to}</span>}
                  </div>
                </div>
              </div>
              {m.subject && m.subject !== thread.subject && (
                <p className="text-xs text-[var(--admin-text-muted)] mb-2 italic">Re: {m.subject}</p>
              )}
              <div className="text-sm text-[var(--admin-text-secondary)] whitespace-pre-wrap break-words leading-relaxed">
                {m.bodyText || m.snippet || "(empty)"}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--admin-text-muted)] text-sm">
          No message content cached. Sync this contact to pull messages.
        </div>
      )}
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
