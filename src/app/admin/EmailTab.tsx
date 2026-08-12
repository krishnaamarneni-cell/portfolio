"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "react-icons/fi";

type EmailSubTab = "inbox" | "sent" | "compose" | "bulk";

type InboxMessage = {
  id: string;
  threadId: string;
  from?: string;
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

type SentRecord = {
  id: string;
  email: string;
  name: string | null;
  subject: string;
  sent_at: string;
  campaign: string | null;
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
        <SentPanel />
      ) : tab === "compose" ? (
        <ComposePanel onSuccess={onSuccess} onError={onError} />
      ) : (
        <BulkPanel onSuccess={onSuccess} onError={onError} />
      )}
    </div>
  );
}

/* ───────── INBOX ───────── */

function InboxPanel({ onError }: { onError: (m: string) => void }) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("max", "40");
      const txt = await fetch(`/api/admin/email/inbox?${params}`).then((r) => r.text());
      try {
        const data = JSON.parse(txt);
        if (data.error) setError(data.error);
        else setMessages(data.messages ?? []);
      } catch {
        setError("Invalid response from server");
      }
    } catch {
      setError("Failed to load inbox");
    }
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
      } catch {
        onError("Invalid thread response");
      }
    } catch {
      onError("Failed to load thread");
    }
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
            placeholder="Search email (e.g. from:recruiter subject:interview)"
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

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <FiAlertCircle size={16} />
          {error}
        </div>
      )}

      {loading && messages.length === 0 ? (
        <div className="text-center py-16 text-[var(--admin-text-muted)] text-sm">
          <FiRefreshCw size={20} className="animate-spin mx-auto mb-3" />
          Loading inbox...
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-16 text-[var(--admin-text-muted)] text-sm">
          <FiInbox size={28} className="mx-auto mb-3 opacity-40" />
          {error ? "Gmail might not be connected." : "No messages found."}
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
                <FiMail size={15} className="text-[var(--admin-text-muted)] mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--admin-text)] truncate">{extractName(msg.from)}</p>
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

/* ───────── SENT ───────── */

function SentPanel() {
  const [records, setRecords] = useState<SentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const txt = await fetch("/api/admin/contacts/email/tracking").then((r) => r.text());
      try {
        const data = JSON.parse(txt);
        setRecords(data.recipients ?? []);
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? records.filter((r) =>
        r.email.toLowerCase().includes(search.toLowerCase()) ||
        r.name?.toLowerCase().includes(search.toLowerCase()) ||
        r.subject?.toLowerCase().includes(search.toLowerCase())
      )
    : records;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sent emails..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none placeholder:text-[var(--admin-text-muted)]"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] hover:border-[#ff6b00]/30 disabled:opacity-50"
        >
          <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading && records.length === 0 ? (
        <div className="text-center py-16 text-[var(--admin-text-muted)] text-sm">
          <FiRefreshCw size={20} className="animate-spin mx-auto mb-3" />
          Loading sent emails...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--admin-text-muted)] text-sm">
          <FiSend size={28} className="mx-auto mb-3 opacity-40" />
          {records.length === 0 ? "No bulk sends recorded yet." : "No matches."}
        </div>
      ) : (
        <div className="bg-[var(--admin-surface)] rounded-2xl border border-[var(--admin-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)] border-b border-[var(--admin-border)]">
                <th className="text-left px-5 py-3 font-semibold">Sent</th>
                <th className="text-left px-5 py-3 font-semibold">To</th>
                <th className="text-left px-5 py-3 font-semibold">Subject</th>
                <th className="text-left px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {filtered.slice(0, 100).map((r) => (
                <tr key={r.id} className="hover:bg-[var(--admin-surface-hover)]">
                  <td className="px-5 py-3 text-[var(--admin-text-muted)] whitespace-nowrap">{formatDate(r.sent_at)}</td>
                  <td className="px-5 py-3">
                    <p className="text-[var(--admin-text)] truncate max-w-[200px]">{r.name || r.email}</p>
                    {r.name && <p className="text-xs text-[var(--admin-text-muted)]">{r.email}</p>}
                  </td>
                  <td className="px-5 py-3 text-[var(--admin-text-secondary)] truncate max-w-[300px]">{r.subject}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      <FiCheck size={10} /> Sent
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <div className="text-center py-3 text-xs text-[var(--admin-text-muted)] border-t border-[var(--admin-border)]">
              Showing 100 of {filtered.length}
            </div>
          )}
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
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none placeholder:text-[var(--admin-text-muted)]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Message</label>
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
  const [attachResume, setAttachResume] = useState(true);
  const [roleSeeking, setRoleSeeking] = useState("SAP S/4HANA Consultant + AI/ML Engineering");
  const [generating, setGenerating] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

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

  const eligible = contacts.filter(
    (c) => !c.do_not_contact && !c.excluded_from_bulk && !c.bounced
  );

  async function generateDraft(field: "both" | "subject" | "message") {
    setGenerating(field);
    try {
      const types: Record<string, number> = {};
      const companies = new Set<string>();
      for (const c of eligible) {
        types[c.contact_type] = (types[c.contact_type] || 0) + 1;
        if (c.company) companies.add(c.company);
      }
      const r = await fetch("/api/admin/contacts/email/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-draft",
          field,
          count: eligible.length,
          contactTypes: Object.keys(types),
          companies: [...companies].slice(0, 10),
          currentSubject: subject,
          currentMessage: message,
          roleSeeking: roleSeeking || undefined,
        }),
      }).then((r) => r.text());
      try {
        const d = JSON.parse(r);
        if (d.subject !== undefined && field !== "message") setSubject(d.subject);
        if (d.message !== undefined && field !== "subject") setMessage(d.message);
      } catch { /* */ }
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
      const txt = await fetch("/api/admin/contacts/email/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactIds: eligible.map((c) => c.id),
          subject: subject.trim(),
          message: message.trim(),
          attachResume,
          roleSeeking,
        }),
      }).then((r) => r.text());
      try {
        const d = JSON.parse(txt);
        if (d.started) {
          const skipMsg = d.skipped ? ` (${d.skipped} skipped)` : "";
          onSuccess(
            `Sending to ${d.total} contact${d.total !== 1 ? "s" : ""} in the background${skipMsg}. Track replies in Sent tab.`
          );
        } else if (d.error) {
          onError(d.error);
        }
      } catch {
        onError("Invalid response");
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex gap-3">
        <div className="flex-1 bg-emerald-500/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-500">{eligible.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-emerald-400 mt-1">Will receive</p>
        </div>
        <div className="flex-1 bg-[var(--admin-surface)] rounded-xl p-4 text-center border border-[var(--admin-border)]">
          <p className="text-2xl font-bold text-[var(--admin-text)]">{contacts.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)] mt-1">Total contacts</p>
        </div>
        <div className="flex-1 bg-red-500/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{contacts.length - eligible.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-red-400 mt-1">Excluded</p>
        </div>
      </div>

      <div className="bg-[var(--admin-surface)] rounded-2xl border border-[var(--admin-border)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--admin-border)] flex items-center gap-2">
          <FiUsers size={16} className="text-[#ff6b00]" />
          <h3 className="font-bold text-[var(--admin-text)]">Compose Bulk Email</h3>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Role seeking</label>
            <div className="flex gap-2">
              <input
                value={roleSeeking}
                onChange={(e) => setRoleSeeking(e.target.value)}
                placeholder="Target role(s)"
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none placeholder:text-[var(--admin-text-muted)]"
              />
              <button
                onClick={() => generateDraft("both")}
                disabled={!!generating}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-xs font-semibold text-purple-400 hover:bg-purple-500/25 disabled:opacity-50"
              >
                {generating === "both" ? <FiRefreshCw size={11} className="animate-spin" /> : <span>AI</span>}
                {generating === "both" ? "Writing..." : "Generate"}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Subject</label>
              <button
                onClick={() => generateDraft("subject")}
                disabled={!!generating}
                className="text-[10px] text-purple-400 hover:text-purple-300 disabled:opacity-50"
              >
                {generating === "subject" ? "Writing..." : "Regenerate"}
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
                onClick={() => generateDraft("message")}
                disabled={!!generating}
                className="text-[10px] text-purple-400 hover:text-purple-300 disabled:opacity-50"
              >
                {generating === "message" ? "Writing..." : "Regenerate"}
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Email body (greeting and signature are added automatically)"
              rows={8}
              className="w-full px-4 py-3 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none placeholder:text-[var(--admin-text-muted)] resize-y"
            />
            <p className="text-[10px] text-[var(--admin-text-muted)]">
              Each contact gets a personalized greeting (Hi [FirstName],) and your signature automatically.
            </p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={attachResume}
              onChange={(e) => setAttachResume(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--admin-border)] text-[#ff6b00] focus:ring-[#ff6b00]"
            />
            <span className="text-sm text-[var(--admin-text)]">Attach resume</span>
          </label>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !message.trim() || eligible.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#ff6b00] text-white font-semibold text-sm shadow-md hover:bg-[#e55d00] disabled:opacity-50 transition-colors"
            >
              {sending ? <FiRefreshCw size={14} className="animate-spin" /> : <FiSend size={14} />}
              {sending ? "Sending..." : `Send to ${eligible.length} contacts`}
            </button>
          </div>
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
