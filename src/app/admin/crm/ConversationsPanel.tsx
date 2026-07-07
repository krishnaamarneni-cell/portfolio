"use client";

import { useState, useEffect } from "react";
import {
  FiRefreshCw,
  FiMessageSquare,
  FiArrowLeft,
  FiSearch,
  FiUser,
} from "react-icons/fi";
import { type CachedThread, type ThreadMessage, timeAgo } from "./types";

type Props = {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
};

export default function ConversationsPanel({ onSuccess, onError }: Props) {
  const [threads, setThreads] = useState<CachedThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedThread, setSelectedThread] = useState<CachedThread | null>(null);
  const [detail, setDetail] = useState<ThreadMessage[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/crm/threads");
    const d = await r.json().catch(() => ({ threads: [] }));
    setThreads(d.threads ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function openThread(t: CachedThread) {
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

  const filtered = search
    ? threads.filter(
        (t) =>
          (t.subject?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
          (t.snippet?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
          t.participants.some((p) => p.toLowerCase().includes(search.toLowerCase()))
      )
    : threads;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FiRefreshCw size={20} className="animate-spin text-[#ff6b00]" />
      </div>
    );
  }

  if (selectedThread) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setSelectedThread(null); setDetail(null); }}
          className="flex items-center gap-2 text-sm text-[#ff6b00] font-semibold hover:underline"
        >
          <FiArrowLeft size={14} /> Back to threads
        </button>

        <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-5">
          <h3 className="font-bold text-[var(--admin-text)]">{selectedThread.subject || "(no subject)"}</h3>
          <div className="flex items-center gap-3 mt-2 text-xs text-[#999]">
            <span>{selectedThread.message_count} messages</span>
            <span>{timeAgo(selectedThread.last_message_at)}</span>
            {selectedThread.intent && (
              <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200 text-[10px]">
                {selectedThread.intent} ({Math.round((selectedThread.intent_confidence ?? 0) * 100)}%)
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              selectedThread.direction === "inbound"
                ? "bg-blue-50 text-blue-600 border border-blue-200"
                : "bg-emerald-50 text-emerald-600 border border-emerald-200"
            }`}>
              {selectedThread.direction}
            </span>
          </div>
          <p className="text-xs text-[#bbb] mt-1">
            Participants: {selectedThread.participants.join(", ")}
          </p>
        </div>

        {loadingDetail ? (
          <div className="text-center py-8 text-[#999] text-sm">Loading messages...</div>
        ) : detail && detail.length > 0 ? (
          <div className="space-y-3">
            {detail.map((m, i) => (
              <div key={i} className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center text-white text-[10px] font-bold">
                    {(m.from || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--admin-text)] truncate">{m.from}</p>
                    <p className="text-[10px] text-[#bbb]">{m.date ? new Date(m.date).toLocaleString() : ""}</p>
                  </div>
                </div>
                <div className="text-sm text-[var(--admin-text-muted)] whitespace-pre-wrap break-words leading-relaxed">
                  {m.bodyText || m.snippet || "(empty)"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[#999] text-sm">No message content cached. Sync this contact to pull messages.</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <FiSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bbb]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none text-[var(--admin-text)] placeholder:text-[#ccc]"
          />
        </div>
        <button
          onClick={load}
          className="px-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm font-semibold text-[var(--admin-text-muted)] hover:border-[#ff6b00] flex items-center gap-2"
        >
          <FiRefreshCw size={14} /> Refresh
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[#999] text-sm">
          No conversations synced yet. Open a contact and click &ldquo;Sync Gmail&rdquo; to pull threads.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <div
              key={t.id}
              onClick={() => openThread(t)}
              className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4 hover:shadow-sm transition-shadow cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <FiMessageSquare
                  size={16}
                  className={`shrink-0 mt-0.5 ${t.direction === "inbound" ? "text-blue-500" : "text-emerald-500"}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--admin-text)] truncate">{t.subject || "(no subject)"}</p>
                  <p className="text-xs text-[#888] mt-0.5 line-clamp-2">{t.snippet}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-[#bbb]">
                    <span className="flex items-center gap-1"><FiUser size={10} />{t.participants.length} participants</span>
                    <span>{t.message_count} msgs</span>
                    {t.intent && <span className="text-purple-500">{t.intent}</span>}
                    <span className="ml-auto">{timeAgo(t.last_message_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
