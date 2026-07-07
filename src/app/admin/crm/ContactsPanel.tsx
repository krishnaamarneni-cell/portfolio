"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FiSearch,
  FiStar,
  FiMail,
  FiEdit2,
  FiTrash2,
  FiPhone,
  FiX,
  FiRefreshCw,
  FiChevronRight,
  FiMessageSquare,
  FiSlash,
  FiExternalLink,
} from "react-icons/fi";
import { type Contact, type ContactType, CONTACT_TYPES, typeInfo, timeAgo } from "./types";

type Props = {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
};

export default function ContactsPanel({ onSuccess, onError }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<ContactType | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/contacts");
    const d = await r.json().catch(() => ({ contacts: [] }));
    setContacts(d.contacts ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function act(body: Record<string, unknown>) {
    const r = await fetch("/api/admin/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      onError(d.error || "Action failed");
      return false;
    }
    await load();
    return true;
  }

  async function classify() {
    setClassifying(true);
    const r = await fetch("/api/admin/contacts/classify", { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setClassifying(false);
    if (r.ok) {
      onSuccess(`Classified ${d.classified ?? 0} contacts`);
      await load();
    } else {
      onError(d.error || "Classification failed");
    }
  }

  const filtered = useMemo(() => {
    let list = contacts;
    if (filterType !== "all") list = list.filter((c) => c.contact_type === filterType);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.company?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [contacts, search, filterType]);

  const stats = useMemo(() => {
    const total = contacts.length;
    const recruiters = contacts.filter((c) => c.contact_type === "recruiter" || c.contact_type === "hiring_manager").length;
    const starred = contacts.filter((c) => c.starred).length;
    const dnc = contacts.filter((c) => c.do_not_contact).length;
    const withPhone = contacts.filter((c) => c.phone).length;
    return { total, recruiters, starred, dnc, withPhone };
  }, [contacts]);

  const selectedContact = selectedId ? contacts.find((c) => c.id === selectedId) ?? null : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FiRefreshCw size={20} className="animate-spin text-[#ff6b00]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MiniStat label="Total" value={stats.total} />
        <MiniStat label="Recruiters" value={stats.recruiters} />
        <MiniStat label="Starred" value={stats.starred} />
        <MiniStat label="Do Not Contact" value={stats.dnc} />
        <MiniStat label="With Phone" value={stats.withPhone} />
      </div>

      {/* Search + filters + classify */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bbb]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-[#E8DFD4] text-sm focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none text-[#1a1a1a] placeholder:text-[#ccc]"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as ContactType | "all")}
          className="px-3 py-2.5 rounded-xl bg-white border border-[#E8DFD4] text-sm text-[#555] focus:border-[#ff6b00] focus:outline-none"
        >
          <option value="all">All types</option>
          {CONTACT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          onClick={classify}
          disabled={classifying}
          className="px-4 py-2.5 rounded-xl bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00] disabled:opacity-50 whitespace-nowrap"
        >
          {classifying ? "Classifying..." : "AI Classify"}
        </button>
      </div>

      {/* Contact list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-[#999] text-sm">No contacts found</div>
        ) : (
          filtered.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              onSelect={() => setSelectedId(c.id)}
              onStar={() => act({ action: "star", id: c.id, starred: !c.starred })}
              onDelete={() => {
                if (confirm(`Delete ${c.name || c.email}?`)) act({ action: "delete", id: c.id });
              }}
            />
          ))
        )}
      </div>

      {/* Detail drawer */}
      {selectedContact && (
        <ContactDetail
          contact={selectedContact}
          onClose={() => setSelectedId(null)}
          onUpdate={async (patch) => {
            const ok = await act({ action: "update_fields", id: selectedContact.id, patch });
            if (ok) onSuccess("Contact updated");
          }}
          onSync={async () => {
            const r = await fetch("/api/admin/crm/threads", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "sync", contactId: selectedContact.id }),
            });
            const d = await r.json().catch(() => ({}));
            if (r.ok) {
              onSuccess(`Synced ${d.synced ?? 0} threads, ${d.enriched ?? 0} enrichments`);
              await load();
            } else {
              onError(d.error || "Sync failed");
            }
          }}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-[#E8DFD4] px-4 py-3">
      <p className="text-xl font-bold text-[#1a1a1a]">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-[#999] mt-0.5">{label}</p>
    </div>
  );
}

function ContactRow({
  contact: c,
  onSelect,
  onStar,
  onDelete,
}: {
  contact: Contact;
  onSelect: () => void;
  onStar: () => void;
  onDelete: () => void;
}) {
  const ti = typeInfo(c.contact_type);
  return (
    <div
      className="bg-white rounded-xl border border-[#E8DFD4] p-4 flex items-center gap-3 hover:shadow-sm transition-shadow cursor-pointer group"
      onClick={onSelect}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onStar(); }}
        className={`shrink-0 ${c.starred ? "text-amber-400" : "text-[#ddd] hover:text-amber-300"}`}
      >
        <FiStar size={16} fill={c.starred ? "currentColor" : "none"} />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[#1a1a1a] text-sm truncate">{c.name || c.email}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ti.color}`}>{ti.label}</span>
          {c.do_not_contact && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">DNC</span>
          )}
          {c.priority && c.priority <= 2 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">P{c.priority}</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-[#999]">
          <span className="truncate">{c.email}</span>
          {c.company && <span className="hidden sm:inline">{c.company}</span>}
          {c.title && <span className="hidden md:inline text-[#bbb]">{c.title}</span>}
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-3 text-xs text-[#999] shrink-0">
        {c.phone && <FiPhone size={12} className="text-[#bbb]" />}
        {c.times_contacted > 0 && (
          <span className="flex items-center gap-1"><FiMail size={12} />{c.times_contacted}</span>
        )}
        <span>{timeAgo(c.last_gmail_activity_at || c.emailed_at)}</span>
      </div>

      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[#ccc] hover:text-red-500 hover:bg-red-50"
        >
          <FiTrash2 size={13} />
        </button>
        <FiChevronRight size={14} className="text-[#ccc]" />
      </div>
    </div>
  );
}

function ContactDetail({
  contact: c,
  onClose,
  onUpdate,
  onSync,
}: {
  contact: Contact;
  onClose: () => void;
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
  onSync: () => Promise<void>;
}) {
  const [threads, setThreads] = useState<Array<{ id: string; subject: string | null; snippet: string | null; message_count: number; last_message_at: string | null; direction: string }>>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editNotes, setEditNotes] = useState(c.notes ?? "");
  const [editType, setEditType] = useState(c.contact_type);

  useEffect(() => {
    setEditNotes(c.notes ?? "");
    setEditType(c.contact_type);
    loadThreads();
  }, [c.id]);

  async function loadThreads() {
    setLoadingThreads(true);
    const r = await fetch(`/api/admin/crm/threads?contactId=${c.id}`);
    const d = await r.json().catch(() => ({ threads: [] }));
    setThreads(d.threads ?? []);
    setLoadingThreads(false);
  }

  async function handleSync() {
    setSyncing(true);
    await onSync();
    await loadThreads();
    setSyncing(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#E8DFD4] px-6 py-4 flex items-center justify-between z-10">
          <h3 className="font-bold text-[#1a1a1a]">Contact Detail</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#f5f0ea] flex items-center justify-center text-[#999] hover:text-[#555]">
            <FiX size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Profile */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center text-white font-bold text-lg">
                {(c.name || c.email)[0].toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-[#1a1a1a]">{c.name || "Unnamed"}</p>
                <p className="text-sm text-[#888]">{c.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {c.company && (
                <div>
                  <p className="text-[10px] uppercase text-[#bbb] tracking-wider">Company</p>
                  <p className="text-[#1a1a1a]">{c.company}</p>
                </div>
              )}
              {c.title && (
                <div>
                  <p className="text-[10px] uppercase text-[#bbb] tracking-wider">Title</p>
                  <p className="text-[#1a1a1a]">{c.title}</p>
                </div>
              )}
              {c.phone && (
                <div>
                  <p className="text-[10px] uppercase text-[#bbb] tracking-wider">Phone</p>
                  <p className="text-[#1a1a1a]">{c.phone}</p>
                </div>
              )}
              {c.linkedin_url && (
                <div>
                  <p className="text-[10px] uppercase text-[#bbb] tracking-wider">LinkedIn</p>
                  <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[#ff6b00] text-xs flex items-center gap-1 hover:underline">
                    <FiExternalLink size={11} /> Profile
                  </a>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase text-[#bbb] tracking-wider">Match</p>
                <p className="text-[#1a1a1a]">{c.match_pct != null ? `${c.match_pct}%` : "N/A"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[#bbb] tracking-wider">Last Activity</p>
                <p className="text-[#1a1a1a]">{timeAgo(c.last_gmail_activity_at)}</p>
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="space-y-2">
            <p className="text-[10px] uppercase text-[#bbb] tracking-wider font-semibold">Classification</p>
            <select
              value={editType}
              onChange={(e) => {
                const v = e.target.value as ContactType;
                setEditType(v);
                onUpdate({ contact_type: v });
              }}
              className="w-full px-3 py-2 rounded-xl bg-[#FAFAF8] border border-[#E8DFD4] text-sm focus:border-[#ff6b00] focus:outline-none"
            >
              {CONTACT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Flags */}
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm text-[#555] cursor-pointer">
              <input
                type="checkbox"
                checked={c.do_not_contact}
                onChange={(e) => onUpdate({ do_not_contact: e.target.checked })}
                className="rounded border-[#E8DFD4] text-[#ff6b00] focus:ring-[#ff6b00]"
              />
              Do Not Contact
            </label>
            <label className="flex items-center gap-2 text-sm text-[#555] cursor-pointer">
              <input
                type="checkbox"
                checked={c.excluded_from_bulk}
                onChange={(e) => onUpdate({ excluded_from_bulk: e.target.checked })}
                className="rounded border-[#E8DFD4] text-[#ff6b00] focus:ring-[#ff6b00]"
              />
              Exclude from Bulk
            </label>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <p className="text-[10px] uppercase text-[#bbb] tracking-wider font-semibold">Notes</p>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              onBlur={() => {
                if (editNotes !== (c.notes ?? "")) onUpdate({ notes: editNotes || null });
              }}
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-[#FAFAF8] border border-[#E8DFD4] text-sm focus:border-[#ff6b00] focus:outline-none resize-none"
              placeholder="Add notes..."
            />
          </div>

          {/* Threads */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase text-[#bbb] tracking-wider font-semibold">Conversations</p>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="text-xs text-[#ff6b00] font-semibold hover:underline flex items-center gap-1"
              >
                <FiRefreshCw size={12} className={syncing ? "animate-spin" : ""} />
                {syncing ? "Syncing..." : "Sync Gmail"}
              </button>
            </div>

            {loadingThreads ? (
              <div className="text-center py-6 text-[#999] text-sm">Loading threads...</div>
            ) : threads.length === 0 ? (
              <div className="text-center py-6 text-[#999] text-sm">No conversations yet. Click Sync Gmail to pull threads.</div>
            ) : (
              <div className="space-y-2">
                {threads.map((t) => (
                  <div key={t.id} className="bg-[#FAFAF8] rounded-xl border border-[#E8DFD4] p-3">
                    <div className="flex items-center gap-2">
                      <FiMessageSquare size={13} className={t.direction === "inbound" ? "text-blue-500" : "text-emerald-500"} />
                      <span className="text-sm font-medium text-[#1a1a1a] truncate flex-1">{t.subject || "(no subject)"}</span>
                      <span className="text-[10px] text-[#999]">{t.message_count} msgs</span>
                    </div>
                    <p className="text-xs text-[#888] mt-1 line-clamp-2">{t.snippet}</p>
                    <p className="text-[10px] text-[#bbb] mt-1">{timeAgo(t.last_message_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
