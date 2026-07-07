"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FiSearch,
  FiRefreshCw,
  FiLink,
  FiEdit2,
  FiTrash2,
  FiX,
  FiUsers,
  FiSlash,
  FiPlus,
} from "react-icons/fi";
import { type Company, timeAgo } from "./types";

type Props = {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
};

export default function CompaniesPanel({ onSuccess, onError }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/crm/companies");
    const d = await r.json().catch(() => ({ companies: [] }));
    setCompanies(d.companies ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

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

  const selected = selectedId ? companies.find((c) => c.id === selectedId) ?? null : null;

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Companies" value={companies.length} />
        <Stat label="Excluded" value={companies.filter((c) => c.excluded_from_bulk).length} />
        <Stat label="Current Employer" value={companies.filter((c) => c.is_current_employer).length} />
        <Stat label="Total Contacts" value={companies.reduce((s, c) => s + c.contact_count, 0)} />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bbb]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none text-[var(--admin-text)] placeholder:text-[#ccc]"
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
          className="px-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm font-semibold text-[var(--admin-text-muted)] hover:border-[#ff6b00] flex items-center gap-2 whitespace-nowrap"
        >
          <FiPlus size={14} /> Add Company
        </button>
      </div>

      {/* Company grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[#999] text-sm">No companies found. Use Auto-Link to discover companies from contacts.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4 hover:shadow-sm transition-shadow cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--admin-text)] text-sm truncate">{c.name}</p>
                  <p className="text-xs text-[#999] mt-0.5">{c.domain}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {c.is_current_employer && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">EMPLOYER</span>
                  )}
                  {c.excluded_from_bulk && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">EXCL</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-[#999]">
                <span className="flex items-center gap-1"><FiUsers size={12} />{c.contact_count}</span>
                {c.industry && <span className="truncate">{c.industry}</span>}
                <span className="ml-auto">{timeAgo(c.last_activity_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <CompanyDetail
          company={selected}
          onClose={() => setSelectedId(null)}
          onUpdate={(patch) => {
            act({ action: "update", id: selected.id, ...patch });
            onSuccess("Company updated");
          }}
          onDelete={() => {
            if (confirm(`Delete ${selected.name}?`)) {
              act({ action: "delete", id: selected.id });
              setSelectedId(null);
              onSuccess("Company deleted");
            }
          }}
        />
      )}

      {/* Create modal */}
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] px-4 py-3">
      <p className="text-xl font-bold text-[var(--admin-text)]">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-[#999] mt-0.5">{label}</p>
    </div>
  );
}

function CompanyDetail({
  company: c,
  onClose,
  onUpdate,
  onDelete,
}: {
  company: Company;
  onClose: () => void;
  onUpdate: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [notes, setNotes] = useState(c.notes ?? "");
  const [industry, setIndustry] = useState(c.industry ?? "");

  useEffect(() => {
    setNotes(c.notes ?? "");
    setIndustry(c.industry ?? "");
  }, [c.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg bg-[var(--admin-surface)] h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-[var(--admin-surface)] border-b border-[var(--admin-border)] px-6 py-4 flex items-center justify-between z-10">
          <h3 className="font-bold text-[var(--admin-text)]">Company Detail</h3>
          <div className="flex items-center gap-2">
            <button onClick={onDelete} className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100">
              <FiTrash2 size={14} />
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--admin-surface-hover)] flex items-center justify-center text-[#999] hover:text-[var(--admin-text-muted)]">
              <FiX size={16} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <p className="text-xl font-bold text-[var(--admin-text)]">{c.name}</p>
            <p className="text-sm text-[#888]">{c.domain}</p>
            {c.aliases.length > 0 && (
              <p className="text-xs text-[#bbb] mt-1">Aliases: {c.aliases.join(", ")}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase text-[#bbb] tracking-wider block mb-1">Industry</label>
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                onBlur={() => { if (industry !== (c.industry ?? "")) onUpdate({ industry: industry || null }); }}
                className="w-full px-3 py-2 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm focus:border-[#ff6b00] focus:outline-none"
                placeholder="e.g. Technology"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-[#bbb] tracking-wider block mb-1">Contacts</label>
              <p className="text-sm text-[var(--admin-text)] px-3 py-2">{c.contact_count}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={c.is_current_employer}
                onChange={(e) => onUpdate({ is_current_employer: e.target.checked })}
                className="rounded border-[var(--admin-border)] text-[#ff6b00] focus:ring-[#ff6b00]"
              />
              Current Employer
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

          <div>
            <label className="text-[10px] uppercase text-[#bbb] tracking-wider block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => { if (notes !== (c.notes ?? "")) onUpdate({ notes: notes || null }); }}
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm focus:border-[#ff6b00] focus:outline-none resize-none"
              placeholder="Notes..."
            />
          </div>
        </div>
      </div>
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
      <div className="bg-[var(--admin-surface)] rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-[var(--admin-text)]">New Company</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Company name"
          className="w-full px-3 py-2.5 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm focus:border-[#ff6b00] focus:outline-none"
        />
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="Domain (e.g. google.com)"
          className="w-full px-3 py-2.5 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm focus:border-[#ff6b00] focus:outline-none"
        />
        <input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="Industry (optional)"
          className="w-full px-3 py-2.5 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm focus:border-[#ff6b00] focus:outline-none"
        />
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-[#999] hover:text-[var(--admin-text-muted)]">Cancel</button>
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
