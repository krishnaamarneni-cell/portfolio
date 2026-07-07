"use client";

import { useState, useEffect } from "react";
import {
  FiSlash,
  FiRefreshCw,
  FiPlus,
  FiTrash2,
  FiShield,
} from "react-icons/fi";
import { type Exclusion, timeAgo } from "./types";

type Props = {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
};

const EXCL_TYPES = [
  { value: "email", label: "Email Address" },
  { value: "domain", label: "Domain" },
  { value: "company", label: "Company Name" },
];

export default function ExclusionsPanel({ onSuccess, onError }: Props) {
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState("email");
  const [newValue, setNewValue] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newPermanent, setNewPermanent] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/crm/audience");
    const d = await r.json().catch(() => ({}));
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

  async function remove(id: string) {
    const r = await fetch("/api/admin/crm/audience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove-exclusion", id }),
    });
    if (r.ok) {
      onSuccess("Exclusion removed");
      await load();
    }
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
      {/* Header */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <FiShield size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Outreach Safety Rules</p>
          <p className="text-xs text-amber-700 mt-1">
            Exclusions prevent contacts from appearing in any audience evaluation. Use this to protect your current employer, personal contacts, and companies you should never cold-email.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Active Rules" value={exclusions.length} />
        <Stat label="By Email" value={exclusions.filter((e) => e.exclusion_type === "email").length} />
        <Stat label="By Domain" value={exclusions.filter((e) => e.exclusion_type === "domain").length} />
        <Stat label="By Company" value={exclusions.filter((e) => e.exclusion_type === "company").length} />
      </div>

      {/* Add button */}
      <button
        onClick={() => setShowAdd(!showAdd)}
        className="px-4 py-2.5 rounded-xl bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00] flex items-center gap-2"
      >
        <FiPlus size={14} /> Add Exclusion
      </button>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-[#E8DFD4] p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-[#bbb] tracking-wider font-semibold">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#FAFAF8] border border-[#E8DFD4] text-sm focus:border-[#ff6b00] focus:outline-none"
              >
                {EXCL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-[#bbb] tracking-wider font-semibold">Value</label>
              <input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={newType === "email" ? "user@example.com" : newType === "domain" ? "example.com" : "Company Name"}
                className="w-full px-3 py-2 rounded-xl bg-[#FAFAF8] border border-[#E8DFD4] text-sm focus:border-[#ff6b00] focus:outline-none"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-[#bbb] tracking-wider font-semibold">Reason (optional)</label>
            <input
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Why exclude this?"
              className="w-full px-3 py-2 rounded-xl bg-[#FAFAF8] border border-[#E8DFD4] text-sm focus:border-[#ff6b00] focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#555] cursor-pointer">
            <input
              type="checkbox"
              checked={newPermanent}
              onChange={(e) => setNewPermanent(e.target.checked)}
              className="rounded border-[#E8DFD4] text-[#ff6b00] focus:ring-[#ff6b00]"
            />
            Permanent (cannot be overridden in audience rules)
          </label>
          <div className="flex gap-3">
            <button onClick={add} className="px-4 py-2 rounded-xl bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00]">
              Add
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-[#999] hover:text-[#555]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Exclusion list */}
      {exclusions.length === 0 ? (
        <div className="text-center py-12 text-[#999] text-sm">No exclusion rules yet. Add one above to protect contacts from bulk outreach.</div>
      ) : (
        <div className="space-y-2">
          {exclusions.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-[#E8DFD4] p-4 flex items-center gap-3">
              <FiSlash size={16} className="text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[#1a1a1a]">{e.exclusion_value}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">{e.exclusion_type}</span>
                  {e.is_permanent && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">permanent</span>
                  )}
                </div>
                {e.reason && <p className="text-xs text-[#888] mt-0.5">{e.reason}</p>}
                <p className="text-[10px] text-[#bbb] mt-0.5">Added {timeAgo(e.created_at)}</p>
              </div>
              <button
                onClick={() => { if (confirm("Remove this exclusion?")) remove(e.id); }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#ccc] hover:text-red-500 hover:bg-red-50 shrink-0"
              >
                <FiTrash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-[#E8DFD4] px-4 py-3">
      <p className="text-xl font-bold text-[#1a1a1a]">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-[#999] mt-0.5">{label}</p>
    </div>
  );
}
