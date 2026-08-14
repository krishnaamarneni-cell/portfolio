"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  FiDownload,
  FiSend,
  FiUploadCloud,
  FiPlus,
  FiUserPlus,
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
  const [cleaningJunk, setCleaningJunk] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCompose, setShowCompose] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);

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

  async function classify(forceAll = false) {
    setClassifying(true);
    const r = await fetch("/api/admin/contacts/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forceAll ? { forceAll: true } : {}),
    });
    const d = await r.json().catch(() => ({}));
    setClassifying(false);
    if (r.ok) {
      onSuccess(`Classified ${d.classified ?? 0} contacts`);
      await load();
    } else {
      onError(d.error || "Classification failed");
    }
  }

  async function cleanJunk() {
    setCleaningJunk(true);
    const r = await fetch("/api/admin/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-junk" }),
    });
    const d = await r.json().catch(() => ({}));
    setCleaningJunk(false);
    if (r.ok) {
      if (d.deleted > 0) {
        onSuccess(`Removed ${d.deleted} junk contacts (noreply, bots, notifications)`);
        await load();
      } else {
        onSuccess("No junk contacts found");
      }
    } else {
      onError(d.error || "Clean junk failed");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  // Quick-select audiences for a bulk send — both skip Do-Not-Contact + excluded.
  const presets = useMemo(() => {
    const sendable = (c: Contact) => !c.do_not_contact && !c.excluded_from_bulk;
    return {
      jobTargets: contacts.filter(
        (c) => sendable(c) && (c.contact_type === "recruiter" || c.contact_type === "hiring_manager")
      ),
      noVendorPersonal: contacts.filter(
        (c) => sendable(c) && c.contact_type !== "vendor" && c.contact_type !== "personal"
      ),
    };
  }, [contacts]);

  const selectedContact = selectedId ? contacts.find((c) => c.id === selectedId) ?? null : null;

  function exportCSV(rows: Contact[]) {
    if (rows.length === 0) { onError("No contacts to export"); return; }
    const headers = ["Name", "Email", "Company", "Type", "Title", "Phone", "LinkedIn", "Match %", "Starred", "DNC", "Excluded", "Last Activity", "Source"];
    const csvRows = [headers.join(",")];
    for (const c of rows) {
      const escape = (s: string | null | undefined) => {
        if (!s) return "";
        return `"${s.replace(/"/g, '""')}"`;
      };
      csvRows.push([
        escape(c.name), escape(c.email), escape(c.company),
        c.contact_type, escape(c.title), escape(c.phone),
        escape(c.linkedin_url), c.match_pct ?? "",
        c.starred ? "Yes" : "No", c.do_not_contact ? "Yes" : "No",
        c.excluded_from_bulk ? "Yes" : "No",
        c.last_gmail_activity_at ?? "", c.source,
      ].join(","));
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onSuccess(`Exported ${rows.length} contacts`);
  }

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
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none text-[var(--admin-text)] placeholder:text-[#ccc]"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as ContactType | "all")}
          className="px-3 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm text-[var(--admin-text-muted)] focus:border-[#ff6b00] focus:outline-none"
        >
          <option value="all">All types</option>
          {CONTACT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          onClick={() => classify(false)}
          disabled={classifying}
          className="px-4 py-2.5 rounded-xl bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00] disabled:opacity-50 whitespace-nowrap"
        >
          {classifying ? "Classifying..." : "AI Classify"}
        </button>
        <button
          onClick={() => classify(true)}
          disabled={classifying}
          className="px-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[#ff6b00]/40 text-sm font-semibold text-[#ff6b00] hover:bg-[#ff6b00]/10 disabled:opacity-50 whitespace-nowrap"
        >
          Re-classify All
        </button>
        <button
          onClick={() => exportCSV(filtered)}
          className="px-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm font-semibold text-[var(--admin-text-secondary)] hover:border-[#ff6b00] flex items-center gap-2 whitespace-nowrap"
        >
          <FiDownload size={14} /> Export CSV
        </button>
        <button
          onClick={() => setShowAddContact(true)}
          className="px-4 py-2.5 rounded-xl bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00] flex items-center gap-2 whitespace-nowrap"
        >
          <FiUserPlus size={14} /> Add Contact
        </button>
        <button
          onClick={cleanJunk}
          disabled={cleaningJunk}
          className="px-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-red-500/40 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
        >
          <FiSlash size={14} /> {cleaningJunk ? "Cleaning..." : "Clean Junk"}
        </button>
      </div>

      {/* Add Contact Form */}
      {showAddContact && (
        <AddContactForm
          onSave={async (data) => {
            const ok = await act(data);
            if (ok) {
              setShowAddContact(false);
              onSuccess("Contact added");
            }
          }}
          onCancel={() => setShowAddContact(false)}
        />
      )}

      {/* Quick-select audiences for bulk send */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--admin-text-muted)]">
          Quick select
        </span>
        <button
          type="button"
          onClick={() => setSelectedIds(new Set(presets.jobTargets.map((c) => c.id)))}
          className="px-2.5 py-1 rounded-full text-[11px] border bg-[#ff6b00]/10 border-[#ff6b00]/30 text-[#ff8c38] hover:bg-[#ff6b00]/20"
        >
          Recruiters + Hiring mgrs ({presets.jobTargets.length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedIds(new Set(presets.noVendorPersonal.map((c) => c.id)))}
          className="px-2.5 py-1 rounded-full text-[11px] border bg-[var(--admin-surface-hover)] border-[var(--admin-border)] text-[var(--admin-text-secondary)] hover:border-[#ff6b00]/40 hover:text-[#ff8c38]"
        >
          Exclude vendors + personal ({presets.noVendorPersonal.length})
        </button>
        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-[11px] text-[var(--admin-text-muted)] hover:underline ml-1"
          >
            Clear selection
          </button>
        )}
        <span className="text-[10px] text-[var(--admin-text-muted)]">
          Both skip Do-Not-Contact &amp; excluded contacts automatically.
        </span>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-[#ff6b00]/10 border border-[#ff6b00]/30 rounded-xl px-4 py-2.5 flex-wrap">
          <span className="text-sm font-semibold text-[#ff6b00]">{selectedIds.size} selected</span>
          <button
            onClick={() => setShowCompose(true)}
            className="px-3 py-1.5 rounded-lg bg-[#ff6b00] text-white text-xs font-semibold hover:bg-[#e55d00] flex items-center gap-1.5"
          >
            <FiSend size={12} /> Send Email
          </button>
          <button
            onClick={() => exportCSV(contacts.filter(c => selectedIds.has(c.id)))}
            className="px-3 py-1.5 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)] text-xs font-semibold text-[var(--admin-text-secondary)] hover:border-[#ff6b00] flex items-center gap-1.5"
          >
            <FiDownload size={12} /> Export Selected
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setSelectedIds(new Set(filtered.map(c => c.id)))}
            className="text-xs text-[#ff6b00] hover:underline"
          >
            Select all ({filtered.length})
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-[var(--admin-text-muted)] hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Contact list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-[#999] text-sm">No contacts found</div>
        ) : (
          filtered.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              selected={selectedIds.has(c.id)}
              onToggleSelect={() => toggleSelect(c.id)}
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

      {/* Bulk compose modal */}
      {showCompose && (
        <BulkComposeModal
          contacts={contacts.filter(c => selectedIds.has(c.id))}
          onClose={() => setShowCompose(false)}
          onDone={() => { setShowCompose(false); setSelectedIds(new Set()); load(); }}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] px-4 py-3">
      <p className="text-xl font-bold text-[var(--admin-text)]">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-[#999] mt-0.5">{label}</p>
    </div>
  );
}

function ContactRow({
  contact: c,
  selected,
  onToggleSelect,
  onSelect,
  onStar,
  onDelete,
}: {
  contact: Contact;
  selected: boolean;
  onToggleSelect: () => void;
  onSelect: () => void;
  onStar: () => void;
  onDelete: () => void;
}) {
  const ti = typeInfo(c.contact_type);
  return (
    <div
      className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4 flex items-center gap-3 hover:shadow-sm transition-shadow cursor-pointer group"
      onClick={onSelect}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect()}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 rounded border-[var(--admin-border)] text-[#ff6b00] focus:ring-[#ff6b00] shrink-0 cursor-pointer accent-[#ff6b00]"
      />
      <button
        onClick={(e) => { e.stopPropagation(); onStar(); }}
        className={`shrink-0 ${c.starred ? "text-amber-400" : "text-[#ddd] hover:text-amber-300"}`}
      >
        <FiStar size={16} fill={c.starred ? "currentColor" : "none"} />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[var(--admin-text)] text-sm truncate">{c.name || c.email}</span>
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
        className="w-full max-w-lg bg-[var(--admin-surface)] h-full overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--admin-surface)] border-b border-[var(--admin-border)] px-6 py-4 flex items-center justify-between z-10">
          <h3 className="font-bold text-[var(--admin-text)]">Contact Detail</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--admin-surface-hover)] flex items-center justify-center text-[#999] hover:text-[var(--admin-text-muted)]">
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
                <p className="font-bold text-[var(--admin-text)]">{c.name || "Unnamed"}</p>
                <p className="text-sm text-[#888]">{c.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {c.company && (
                <div>
                  <p className="text-[10px] uppercase text-[#bbb] tracking-wider">Company</p>
                  <p className="text-[var(--admin-text)]">{c.company}</p>
                </div>
              )}
              {c.title && (
                <div>
                  <p className="text-[10px] uppercase text-[#bbb] tracking-wider">Title</p>
                  <p className="text-[var(--admin-text)]">{c.title}</p>
                </div>
              )}
              {c.phone && (
                <div>
                  <p className="text-[10px] uppercase text-[#bbb] tracking-wider">Phone</p>
                  <p className="text-[var(--admin-text)]">{c.phone}</p>
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
                <p className="text-[var(--admin-text)]">{c.match_pct != null ? `${c.match_pct}%` : "N/A"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[#bbb] tracking-wider">Last Activity</p>
                <p className="text-[var(--admin-text)]">{timeAgo(c.last_gmail_activity_at)}</p>
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
              className="w-full px-3 py-2 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm focus:border-[#ff6b00] focus:outline-none"
            >
              {CONTACT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Flags */}
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={c.do_not_contact}
                onChange={(e) => onUpdate({ do_not_contact: e.target.checked })}
                className="rounded border-[var(--admin-border)] text-[#ff6b00] focus:ring-[#ff6b00]"
              />
              Do Not Contact
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={c.excluded_from_bulk}
                onChange={(e) => onUpdate({ excluded_from_bulk: e.target.checked })}
                className="rounded border-[var(--admin-border)] text-[#ff6b00] focus:ring-[#ff6b00]"
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
              className="w-full px-3 py-2 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm focus:border-[#ff6b00] focus:outline-none resize-none"
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
                  <div key={t.id} className="bg-[var(--admin-bg)] rounded-xl border border-[var(--admin-border)] p-3">
                    <div className="flex items-center gap-2">
                      <FiMessageSquare size={13} className={t.direction === "inbound" ? "text-blue-500" : "text-emerald-500"} />
                      <span className="text-sm font-medium text-[var(--admin-text)] truncate flex-1">{t.subject || "(no subject)"}</span>
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

function BulkComposeModal({
  contacts,
  onClose,
  onDone,
  onSuccess,
  onError,
}: {
  contacts: Contact[];
  onClose: () => void;
  onDone: () => void;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [roleSeeking, setRoleSeeking] = useState("");
  const [attachResume, setAttachResume] = useState(true);
  const [resumeInfo, setResumeInfo] = useState<{ url: string; name: string } | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const resumeUploadRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [sendVia, setSendVia] = useState<"auto" | "resend">("auto");

  useEffect(() => {
    fetch("/api/admin/resume")
      .then((r) => r.json())
      .then((j) => {
        if (j.url) setResumeInfo({ url: j.url, name: j.name || "Resume" });
      })
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
        onSuccess("Resume updated — this is what will be attached");
      }
    } catch {
      onError("Upload failed");
    }
    setUploadingResume(false);
    if (resumeUploadRef.current) resumeUploadRef.current.value = "";
  }
  const [generating, setGenerating] = useState<"both" | "subject" | "message" | null>(null);
  const [result, setResult] = useState<{
    sent: number;
    errors: number;
    skipped: number;
    skippedDetails?: Array<{ email: string; reason: string }>;
  } | null>(null);

  const eligible = contacts.filter(
    (c) => !c.do_not_contact && !c.excluded_from_bulk,
  );
  const excluded = contacts.filter(
    (c) => c.do_not_contact || c.excluded_from_bulk,
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
    generateDraft("both");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    if (!subject.trim()) {
      onError("Subject is required");
      return;
    }
    if (!message.trim()) {
      onError("Message is required");
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
          sendVia,
        }),
      });
      const d = await r.json();
      if (d.started) {
        // Sending runs in the background now — close and let the Responses tab
        // show progress, instead of blocking the modal for minutes.
        const skipMsg = d.skipped ? ` (${d.skipped} skipped)` : "";
        onSuccess(
          `Sending to ${d.total} contact${d.total !== 1 ? "s" : ""} in the background${skipMsg}. Track replies in the Responses tab.`
        );
        onClose();
      } else if (d.error) {
        onError(d.error);
      } else {
        // Nothing to send (everyone was excluded), or a legacy response shape.
        setResult(d);
      }
    } catch {
      onError("Network error — please try again");
    }
    setSending(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--admin-surface)] rounded-2xl border border-[var(--admin-border)] shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[var(--admin-surface)] border-b border-[var(--admin-border)] px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
          <h3 className="font-bold text-[var(--admin-text)] flex items-center gap-2">
            <FiSend size={16} className="text-[#ff6b00]" /> Bulk Send Email
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--admin-surface-hover)] flex items-center justify-center text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
          >
            <FiX size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
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
                    {c.name || c.email} — {c.do_not_contact ? "Do Not Contact" : "Excluded from bulk"}
                  </p>
                ))}
                {excluded.length > 5 && <p className="mt-0.5">...and {excluded.length - 5} more</p>}
              </div>
            </div>
          )}

          {!result ? (
            <>
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
                    {generating === "both" ? <FiRefreshCw size={11} className="animate-spin" /> : <span>✦</span>}
                    {generating === "both" ? "Writing…" : "Generate"}
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
                        onClick={() => {
                          setRoleSeeking(r);
                          generateDraft("both", r);
                        }}
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
                  Pick a role above (or type one) — the email will target that specific role, not both. You can still
                  edit below.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Subject</label>
                  <button
                    onClick={() => generateDraft("subject")}
                    disabled={!!generating}
                    className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 disabled:opacity-50 flex items-center gap-1"
                  >
                    {generating === "subject" ? <FiRefreshCw size={10} className="animate-spin" /> : <span>✦</span>}
                    {generating === "subject" ? "Generating..." : "Rewrite with AI"}
                  </button>
                </div>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={generating === "both" ? "AI is generating..." : "Re: Opportunity discussion"}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none placeholder:text-[var(--admin-text-muted)]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Message</label>
                  <button
                    onClick={() => generateDraft("message")}
                    disabled={!!generating}
                    className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 disabled:opacity-50 flex items-center gap-1"
                  >
                    {generating === "message" ? <FiRefreshCw size={10} className="animate-spin" /> : <span>✦</span>}
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
                        <FiUploadCloud size={12} /> {uploadingResume ? "Uploading…" : "Upload new"}
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
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-emerald-500">{result.sent}</p>
                  <p className="text-[10px] uppercase tracking-wider text-emerald-400">Sent</p>
                </div>
                <div className="bg-red-500/10 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-red-500">{result.errors}</p>
                  <p className="text-[10px] uppercase tracking-wider text-red-400">Failed</p>
                </div>
                <div className="bg-amber-500/10 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-amber-500">{result.skipped}</p>
                  <p className="text-[10px] uppercase tracking-wider text-amber-400">Skipped</p>
                </div>
              </div>

              {result.skippedDetails && result.skippedDetails.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-500 mb-1">Skipped contacts:</p>
                  {result.skippedDetails.slice(0, 10).map((s, i) => (
                    <p key={i} className="text-xs text-amber-400">{s.email} — {s.reason}</p>
                  ))}
                </div>
              )}

              <button
                onClick={onDone}
                className="w-full py-3 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-[var(--admin-text)] font-semibold hover:border-[#ff6b00]"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── ADD CONTACT FORM ───────── */

function AddContactForm({
  onSave,
  onCancel,
}: {
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [contactType, setContactType] = useState<string>("recruiter");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    await onSave({
      email: email.trim(),
      name: name.trim(),
      company: company.trim() || null,
      contact_type: contactType,
      source: "manual",
      notes: notes.trim() || null,
    });
    setSaving(false);
  }

  const inputCls = "w-full px-3 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none placeholder:text-[var(--admin-text-muted)]";

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--admin-surface)] rounded-2xl border border-[#ff6b00]/30 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--admin-text)] flex items-center gap-2">
          <FiUserPlus size={15} className="text-[#ff6b00]" /> Add Contact
        </h3>
        <button type="button" onClick={onCancel} className="text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]">
          <FiX size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email *" type="email" required className={inputCls} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={inputCls} />
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className={inputCls} />
        <select value={contactType} onChange={(e) => setContactType(e.target.value)} className={inputCls}>
          {CONTACT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className={inputCls} />

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl bg-[var(--admin-surface-hover)] text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]">
          Cancel
        </button>
        <button type="submit" disabled={saving || !email.trim()} className="px-5 py-2 rounded-xl bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00] disabled:opacity-50">
          {saving ? "Saving..." : "Add Contact"}
        </button>
      </div>
    </form>
  );
}
