"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FiSlash,
  FiRefreshCw,
  FiPlus,
  FiTrash2,
  FiShield,
  FiBriefcase,
  FiMail,
  FiGlobe,
} from "react-icons/fi";
import { timeAgo } from "./types";

type Props = {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
};

type UnifiedExclusion = {
  id: string;
  type: "email" | "domain" | "company" | "contact";
  value: string;
  reason: string | null;
  source: string;
  created_at: string;
};

const EXCL_TYPES = [
  { value: "email", label: "Email Address", icon: FiMail },
  { value: "domain", label: "Domain", icon: FiGlobe },
  { value: "company", label: "Company Name", icon: FiBriefcase },
];

const SOURCE_LABELS: Record<string, string> = {
  exclusion_table: "Manual rule",
  contact_flag: "Contact flag",
  company_flag: "Company flag",
};

export default function ExclusionsPanel({ onSuccess, onError }: Props) {
  const [exclusions, setExclusions] = useState<UnifiedExclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState("email");
  const [newValue, setNewValue] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newPermanent, setNewPermanent] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<"all" | "exclusion_table" | "contact_flag" | "company_flag">("all");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/crm/exclusions");
    const d = await r.json().catch(() => ({ exclusions: [] }));
    setExclusions(d.exclusions ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function add() {
    if (!newValue.trim()) { onError("Enter a value"); return; }
    const r = await fetch("/api/admin/crm/audience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add-exclusion",
        exclusion_type: newType,
        exclusion_value: newValue.trim(),
        reason: newReason || null,
        is_permanent: newPermanent,
      }),
    });
    if (r.ok) {
      onSuccess("Exclusion added");
      setNewValue("");
      setNewReason("");
      setShowAdd(false);
      await load();
    } else {
      const d = await r.json().catch(() => ({}));
      onError(d.error || "Failed to add exclusion");
    }
  }

  async function remove(excl: UnifiedExclusion) {
    if (excl.source === "exclusion_table") {
      const r = await fetch("/api/admin/crm/audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove-exclusion", id: excl.id }),
      });
      if (r.ok) { onSuccess("Exclusion removed"); await load(); }
      else onError("Failed to remove");
    } else if (excl.source === "contact_flag") {
      const r = await fetch("/api/admin/crm/exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-contact", contactId: excl.id, excluded: false }),
      });
      if (r.ok) { onSuccess("Contact exclusion removed"); await load(); }
      else onError("Failed to remove");
    } else if (excl.source === "company_flag") {
      const r = await fetch("/api/admin/crm/exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-company", companyId: excl.id, excluded: false }),
      });
      if (r.ok) { onSuccess("Company exclusion removed"); await load(); }
      else onError("Failed to remove");
    }
  }

  const filtered = useMemo(() => {
    if (sourceFilter === "all") return exclusions;
    return exclusions.filter((e) => e.source === sourceFilter);
  }, [exclusions, sourceFilter]);

  const stats = useMemo(() => ({
    total: exclusions.length,
    manual: exclusions.filter((e) => e.source === "exclusion_table").length,
    contactFlags: exclusions.filter((e) => e.source === "contact_flag").length,
    companyFlags: exclusions.filter((e) => e.source === "company_flag").length,
  }), [exclusions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FiRefreshCw size={20} className="animate-spin text-[#ff6b00]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
        <FiShield size={18} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-300">Unified Outreach Safety</p>
          <p className="text-xs text-amber-400/80 mt-1">
            Shows all exclusions from three sources: manual rules, contact &ldquo;excluded from bulk&rdquo; flags, and company exclusion flags. Removing an entry here also removes the flag on the contact or company.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total Rules" value={stats.total} />
        <Stat label="Manual" value={stats.manual} />
        <Stat label="Contact Flags" value={stats.contactFlags} />
        <Stat label="Company Flags" value={stats.companyFlags} />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2.5 rounded-xl bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00] flex items-center gap-2"
        >
          <FiPlus size={14} /> Add Exclusion Rule
        </button>
        <div className="flex gap-1 bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-1">
          {(["all", "exclusion_table", "contact_flag", "company_flag"] as const).map((src) => (
            <button
              key={src}
              onClick={() => setSourceFilter(src)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sourceFilter === src
                  ? "bg-[#ff6b00] text-white"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
              }`}
            >
              {src === "all" ? "All" : src === "exclusion_table" ? "Manual" : src === "contact_flag" ? "Contacts" : "Companies"}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="px-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm font-semibold text-[var(--admin-text-secondary)] hover:border-[#ff6b00] flex items-center gap-2 ml-auto"
        >
          <FiRefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:outline-none"
              >
                {EXCL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Value</label>
              <input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={newType === "email" ? "user@example.com" : newType === "domain" ? "example.com" : "Company Name"}
                className="w-full px-3 py-2 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:outline-none"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider font-semibold">Reason (optional)</label>
            <input
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Why exclude this?"
              className="w-full px-3 py-2 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-[#ff6b00] focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--admin-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={newPermanent}
              onChange={(e) => setNewPermanent(e.target.checked)}
              className="rounded border-[var(--admin-border)] text-[#ff6b00] focus:ring-[#ff6b00]"
            />
            Permanent (cannot be overridden in audience rules)
          </label>
          <div className="flex gap-3">
            <button onClick={add} className="px-4 py-2 rounded-xl bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00]">
              Add
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text-secondary)]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Exclusion list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--admin-text-muted)] text-sm">
          {exclusions.length === 0
            ? "No exclusion rules yet. Add one above or toggle \"Exclude from Bulk\" on a contact or company."
            : "No exclusions match this filter."
          }
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => {
            const Icon = e.type === "email" || e.type === "contact" ? FiMail
              : e.type === "domain" ? FiGlobe
              : FiBriefcase;
            return (
              <div key={`${e.source}-${e.id}`} className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                  <Icon size={14} className="text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-[var(--admin-text)]">{e.value}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--admin-surface-hover)] text-[var(--admin-text-muted)] border border-[var(--admin-border)]">
                      {e.type}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      e.source === "exclusion_table"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : e.source === "contact_flag"
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}>
                      {SOURCE_LABELS[e.source] ?? e.source}
                    </span>
                  </div>
                  {e.reason && <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">{e.reason}</p>}
                  <p className="text-[10px] text-[var(--admin-text-muted)] mt-0.5">Added {timeAgo(e.created_at)}</p>
                </div>
                <button
                  onClick={() => { if (confirm("Remove this exclusion?")) remove(e); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--admin-text-muted)] hover:text-red-400 hover:bg-red-500/10 shrink-0 transition-colors"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            );
          })}
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
