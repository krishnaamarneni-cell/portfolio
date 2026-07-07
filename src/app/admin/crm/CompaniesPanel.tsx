"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FiSearch,
  FiRefreshCw,
  FiLink,
  FiTrash2,
  FiUsers,
  FiPlus,
  FiMessageSquare,
  FiStar,
  FiCpu,
  FiArrowLeft,
  FiChevronRight,
  FiSlash,
} from "react-icons/fi";
import { type Company, type Contact, type CachedThread, typeInfo, timeAgo } from "./types";

type Props = {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
};

type WorkspaceData = {
  company: Company;
  contacts: Contact[];
  emails: string[];
  threads: CachedThread[];
  _debug?: {
    companyId: string;
    contactsReturned: number;
    directCount: number;
    storedContactCount: number | string;
    contactsError: string | null;
    threadsError: string | null;
  };
};

export default function CompaniesPanel({ onSuccess, onError }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/crm/companies");
    const d = await r.json().catch(() => ({ companies: [] }));
    setCompanies(d.companies ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function autoLink() {
    setLinking(true);
    const r = await fetch("/api/admin/crm/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "auto-link" }),
    });
    const d = await r.json().catch(() => ({}));
    setLinking(false);
    if (r.ok) {
      onSuccess(`Linked ${d.linked ?? 0} contacts to ${d.companies ?? 0} companies`);
      await load();
    } else {
      onError(d.error || "Auto-link failed");
    }
  }

  async function act(body: Record<string, unknown>) {
    const r = await fetch("/api/admin/crm/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      onError(d.error || "Action failed");
      return;
    }
    await load();
  }

  const filtered = useMemo(() => {
    if (!search) return companies;
    const q = search.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.domain.toLowerCase().includes(q) ||
        (c.industry?.toLowerCase().includes(q) ?? false)
    );
  }, [companies, search]);

  if (selectedId) {
    return (
      <CompanyWorkspace
        companyId={selectedId}
        onBack={() => { setSelectedId(null); load(); }}
        onSuccess={onSuccess}
        onError={onError}
        onDelete={(id) => {
          act({ action: "delete", id });
          setSelectedId(null);
          onSuccess("Company deleted");
        }}
      />
    );
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Companies" value={companies.length} />
        <Stat label="Excluded" value={companies.filter((c) => c.excluded_from_bulk).length} />
        <Stat label="Current Employer" value={companies.filter((c) => c.is_current_employer).length} />
        <Stat label="Total Contacts" value={companies.reduce((s, c) => s + c.contact_count, 0)} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)]"
          />
        </div>
        <button
          onClick={autoLink}
          disabled={linking}
          className="px-4 py-2.5 rounded-xl bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00] disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
        >
          <FiLink size={14} />
          {linking ? "Linking..." : "Auto-Link"}
        </button>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm font-semibold text-[var(--admin-text-secondary)] hover:border-[#ff6b00] flex items-center gap-2 whitespace-nowrap"
        >
          <FiPlus size={14} /> Add Company
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--admin-text-muted)] text-sm">No companies found. Use Auto-Link to discover companies from contacts.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4 hover:border-[#ff6b00]/40 transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--admin-text)] text-sm truncate">{c.name}</p>
                  <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">{c.domain}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {c.is_current_employer && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">EMPLOYER</span>
                  )}
                  {c.excluded_from_bulk && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">EXCL</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-[var(--admin-text-muted)]">
                <span className="flex items-center gap-1"><FiUsers size={12} />{c.contact_count}</span>
                {c.industry && <span className="truncate">{c.industry}</span>}
                <span className="ml-auto">{timeAgo(c.last_activity_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateCompanyModal
          onClose={() => setShowCreate(false)}
          onCreate={async (data) => {
            await act({ action: "create", ...data });
            setShowCreate(false);
            onSuccess("Company created");
          }}
        />
      )}
    </div>
  );
}

function CompanyWorkspace({
  companyId,
  onBack,
  onSuccess,
  onError,
  onDelete,
}: {
  companyId: string;
  onBack: () => void;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
  onDelete: (id: string) => void;
}) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [notes, setNotes] = useState("");
  const [industry, setIndustry] = useState("");
  const [activeSection, setActiveSection] = useState<"contacts" | "threads" | "summary">("contacts");
  const [threadDetail, setThreadDetail] = useState<CachedThread | null>(null);

  useEffect(() => {
    loadWorkspace();
  }, [companyId]);

  async function loadWorkspace() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/crm/companies/workspace?id=${companyId}`);
      if (!r.ok) throw new Error("Failed to load workspace");
      const d = await r.json();
      setData(d);
      setNotes(d.company?.notes ?? "");
      setIndustry(d.company?.industry ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    }
    setLoading(false);
  }

  async function updateCompany(patch: Record<string, unknown>) {
    const r = await fetch("/api/admin/crm/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id: companyId, ...patch }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      onError(d.error || "Update failed");
      return;
    }
    onSuccess("Updated");
    await loadWorkspace();
  }

  async function toggleExclusion(excluded: boolean) {
    const r = await fetch("/api/admin/crm/exclusions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle-company", companyId, excluded }),
    });
    if (r.ok) {
      onSuccess(excluded ? "Company excluded from bulk" : "Exclusion removed");
      await loadWorkspace();
    } else {
      onError("Failed to toggle exclusion");
    }
  }

  async function generateSummary() {
    setGeneratingSummary(true);
    try {
      const r = await fetch("/api/admin/crm/companies/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-summary", companyId }),
      });
      const d = await r.json();
      setAiSummary(d.summary ?? d.error ?? "No summary generated");
    } catch {
      setAiSummary("Failed to generate summary");
    }
    setGeneratingSummary(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FiRefreshCw size={20} className="animate-spin text-[#ff6b00]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-[#ff6b00] font-semibold hover:underline">
          <FiArrowLeft size={14} /> Back to companies
        </button>
        <div className="text-center py-12 text-red-400 text-sm">{error || "Company not found"}</div>
      </div>
    );
  }

  const { company: c, contacts, emails, threads, _debug } = data;

  if (threadDetail) {
    return (
      <ThreadDetailView
        thread={threadDetail}
        companyName={c.name}
        onBack={() => setThreadDetail(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-[#ff6b00] font-semibold hover:underline">
          <FiArrowLeft size={14} /> Companies
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { if (confirm(`Delete ${c.name}?`)) onDelete(c.id); }}
            className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20"
          >
            <FiTrash2 size={14} />
          </button>
        </div>
      </div>

      {_debug && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs font-mono text-blue-300 space-y-1">
          <p className="font-bold text-blue-400">Debug: Workspace Query</p>
          <p>Company ID: {_debug.companyId}</p>
          <p>Contacts returned by query: {_debug.contactsReturned}</p>
          <p>Direct count (same WHERE): {_debug.directCount}</p>
          <p>Stored contact_count: {_debug.storedContactCount}</p>
          {_debug.contactsError && <p className="text-red-400">Contacts error: {_debug.contactsError}</p>}
          {_debug.threadsError && <p className="text-red-400">Threads error: {_debug.threadsError}</p>}
        </div>
      )}

      <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center text-white font-bold text-lg shrink-0">
            {c.name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-[var(--admin-text)]">{c.name}</h2>
            <p className="text-sm text-[var(--admin-text-muted)]">{c.domain}</p>
            {c.aliases.length > 0 && (
              <p className="text-xs text-[var(--admin-text-muted)] mt-1">Also: {c.aliases.join(", ")}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="text-center">
            <p className="text-lg font-bold text-[var(--admin-text)]">{contacts.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)]">Contacts</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-[var(--admin-text)]">{threads.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)]">Threads</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-[var(--admin-text)]">{emails.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)]">Emails</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider block mb-1">Industry</label>
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              onBlur={() => { if (industry !== (c.industry ?? "")) updateCompany({ industry: industry || null }); }}
              className="w-full px-3 py-2 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:outline-none"
              placeholder="e.g. Technology"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider block mb-1">Emails</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {emails.length > 0 ? emails.slice(0, 3).map((e) => (
                <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--admin-surface-hover)] text-[var(--admin-text-secondary)] border border-[var(--admin-border)]">{e}</span>
              )) : <span className="text-xs text-[var(--admin-text-muted)]">None</span>}
              {emails.length > 3 && (
                <span className="text-[10px] text-[var(--admin-text-muted)]">+{emails.length - 3} more</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-4">
          <label className="flex items-center gap-2 text-sm text-[var(--admin-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={c.is_current_employer}
              onChange={(e) => updateCompany({ is_current_employer: e.target.checked })}
              className="rounded border-[var(--admin-border)] text-[#ff6b00] focus:ring-[#ff6b00]"
            />
            Current Employer
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--admin-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={c.excluded_from_bulk}
              onChange={(e) => toggleExclusion(e.target.checked)}
              className="rounded border-[var(--admin-border)] text-[#ff6b00] focus:ring-[#ff6b00]"
            />
            Exclude from Bulk
          </label>
        </div>

        <div className="mt-4">
          <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider block mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => { if (notes !== (c.notes ?? "")) updateCompany({ notes: notes || null }); }}
            rows={2}
            className="w-full px-3 py-2 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:outline-none resize-none"
            placeholder="Notes..."
          />
        </div>
      </div>

      <div className="flex gap-1 bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-1">
        {(["contacts", "threads", "summary"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSection(tab)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === tab
                ? "bg-[#ff6b00] text-white"
                : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] hover:bg-[var(--admin-surface-hover)]"
            }`}
          >
            {tab === "contacts" && `Contacts (${contacts.length})`}
            {tab === "threads" && `Threads (${threads.length})`}
            {tab === "summary" && "AI Summary"}
          </button>
        ))}
      </div>

      {activeSection === "contacts" && (
        <ContactsSection contacts={contacts} onSuccess={onSuccess} onError={onError} />
      )}
      {activeSection === "threads" && (
        <ThreadsSection threads={threads} onOpen={setThreadDetail} />
      )}
      {activeSection === "summary" && (
        <SummarySection
          summary={aiSummary}
          generating={generatingSummary}
          onGenerate={generateSummary}
        />
      )}
    </div>
  );
}

function ContactsSection({
  contacts,
  onSuccess,
  onError,
}: {
  contacts: Contact[];
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  async function toggleContactExclusion(contactId: string, excluded: boolean) {
    const r = await fetch("/api/admin/crm/exclusions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle-contact", contactId, excluded }),
    });
    if (r.ok) onSuccess(excluded ? "Contact excluded" : "Exclusion removed");
    else onError("Failed to toggle exclusion");
  }

  if (contacts.length === 0) {
    return (
      <div className="text-center py-10 text-[var(--admin-text-muted)] text-sm">
        No contacts linked to this company yet. Use Auto-Link from the companies list.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contacts.map((c) => {
        const ti = typeInfo(c.contact_type);
        return (
          <div
            key={c.id}
            className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {(c.name || c.email)[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-[var(--admin-text)] truncate">{c.name || c.email}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ti.color}`}>{ti.label}</span>
                {c.starred && <FiStar size={12} className="text-amber-400" fill="currentColor" />}
                {c.excluded_from_bulk && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">EXCL</span>
                )}
                {c.do_not_contact && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">DNC</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-[var(--admin-text-muted)]">
                <span className="truncate">{c.email}</span>
                {c.title && <span className="hidden sm:inline">{c.title}</span>}
                {c.phone && <span className="hidden sm:inline">{c.phone}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => toggleContactExclusion(c.id, !c.excluded_from_bulk)}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                  c.excluded_from_bulk
                    ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
                    : "text-[var(--admin-text-muted)] hover:text-red-400 hover:bg-red-500/10"
                }`}
                title={c.excluded_from_bulk ? "Remove exclusion" : "Exclude from bulk"}
              >
                <FiSlash size={13} />
              </button>
              <span className="text-[10px] text-[var(--admin-text-muted)]">{timeAgo(c.last_gmail_activity_at)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ThreadsSection({
  threads,
  onOpen,
}: {
  threads: CachedThread[];
  onOpen: (t: CachedThread) => void;
}) {
  if (threads.length === 0) {
    return (
      <div className="text-center py-10 text-[var(--admin-text-muted)] text-sm">
        No email threads found. Sync contacts from the Contacts tab to pull Gmail threads.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {threads.map((t) => (
        <div
          key={t.id}
          onClick={() => onOpen(t)}
          className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4 hover:border-[#ff6b00]/40 transition-colors cursor-pointer"
        >
          <div className="flex items-start gap-3">
            <FiMessageSquare
              size={16}
              className={`shrink-0 mt-0.5 ${t.direction === "inbound" ? "text-blue-400" : "text-emerald-400"}`}
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-[var(--admin-text)] truncate">{t.subject || "(no subject)"}</p>
              <p className="text-xs text-[var(--admin-text-muted)] mt-0.5 line-clamp-2">{t.snippet}</p>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--admin-text-muted)]">
                <span>{t.message_count} msgs</span>
                <span>{t.participants?.length ?? 0} participants</span>
                {t.intent && <span className="text-purple-400">{t.intent}</span>}
                <span className="ml-auto">{timeAgo(t.last_message_at)}</span>
              </div>
            </div>
            <FiChevronRight size={14} className="text-[var(--admin-text-muted)] shrink-0 mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ThreadDetailView({
  thread,
  companyName,
  onBack,
}: {
  thread: CachedThread;
  companyName: string;
  onBack: () => void;
}) {
  const messages = thread.cached_messages ?? [];

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-[#ff6b00] font-semibold hover:underline">
        <FiArrowLeft size={14} /> Back to {companyName}
      </button>

      <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-5">
        <h3 className="font-bold text-[var(--admin-text)]">{thread.subject || "(no subject)"}</h3>
        <div className="flex items-center gap-3 mt-2 text-xs text-[var(--admin-text-muted)]">
          <span>{thread.message_count} messages</span>
          <span>{timeAgo(thread.last_message_at)}</span>
          {thread.intent && (
            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px]">
              {thread.intent}
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
            thread.direction === "inbound"
              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          }`}>
            {thread.direction}
          </span>
        </div>
        <p className="text-xs text-[var(--admin-text-muted)] mt-1">
          Participants: {thread.participants?.join(", ") ?? "unknown"}
        </p>
      </div>

      {messages.length > 0 ? (
        <div className="space-y-3">
          {messages.map((m, i) => (
            <div key={i} className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center text-white text-[10px] font-bold">
                  {(m.from || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--admin-text)] truncate">{m.from}</p>
                  <p className="text-[10px] text-[var(--admin-text-muted)]">{m.date ? new Date(m.date).toLocaleString() : ""}</p>
                </div>
              </div>
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

function SummarySection({
  summary,
  generating,
  onGenerate,
}: {
  summary: string | null;
  generating: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--admin-text)] flex items-center gap-2">
          <FiCpu size={14} className="text-[#ff6b00]" /> AI Intelligence Summary
        </p>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="px-3 py-1.5 rounded-lg bg-[#ff6b00] text-white text-xs font-semibold hover:bg-[#e55d00] disabled:opacity-50 flex items-center gap-1"
        >
          <FiRefreshCw size={12} className={generating ? "animate-spin" : ""} />
          {generating ? "Generating..." : summary ? "Regenerate" : "Generate"}
        </button>
      </div>
      {summary ? (
        <div className="text-sm text-[var(--admin-text-secondary)] leading-relaxed whitespace-pre-wrap">
          {summary}
        </div>
      ) : (
        <p className="text-sm text-[var(--admin-text-muted)]">
          Click Generate to create an AI-powered summary based on email conversations with this company.
        </p>
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

function CreateCompanyModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: { name: string; domain: string; industry?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--admin-surface)] rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 border border-[var(--admin-border)]" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-[var(--admin-text)]">New Company</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Company name"
          className="w-full px-3 py-2.5 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:outline-none"
        />
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="Domain (e.g. google.com)"
          className="w-full px-3 py-2.5 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:outline-none"
        />
        <input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="Industry (optional)"
          className="w-full px-3 py-2.5 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:outline-none"
        />
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text-secondary)]">Cancel</button>
          <button
            onClick={() => { if (name && domain) onCreate({ name, domain, industry: industry || undefined }); }}
            disabled={!name || !domain}
            className="px-4 py-2 rounded-xl bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00] disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
