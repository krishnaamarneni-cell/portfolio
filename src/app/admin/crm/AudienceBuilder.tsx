"use client";

import { useState, useEffect } from "react";
import {
  FiTarget,
  FiRefreshCw,
  FiTrash2,
  FiPlus,
  FiAlertTriangle,
  FiUsers,
  FiSave,
  FiPlay,
} from "react-icons/fi";
import { CONTACT_TYPES, type ContactType } from "./types";

type AudienceRules = {
  include_types: ContactType[];
  exclude_types: ContactType[];
  include_tags: string[];
  exclude_tags: string[];
  min_match_pct: number;
  active_within_days: number;
  exclude_companies: string[];
  exclude_domains: string[];
};

type SavedAudience = {
  id: string;
  name: string;
  description: string | null;
  rules: AudienceRules;
  contact_count: number;
  created_at: string;
};

type EvaluatedContact = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  contact_type: ContactType;
  match_pct: number | null;
};

type Props = {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
};

const EMPTY_RULES: AudienceRules = {
  include_types: [],
  exclude_types: [],
  include_tags: [],
  exclude_tags: [],
  min_match_pct: 0,
  active_within_days: 0,
  exclude_companies: [],
  exclude_domains: [],
};

export default function AudienceBuilder({ onSuccess, onError }: Props) {
  const [audiences, setAudiences] = useState<SavedAudience[]>([]);
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<AudienceRules>({ ...EMPTY_RULES });
  const [preview, setPreview] = useState<EvaluatedContact[] | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [exclTagInput, setExclTagInput] = useState("");
  const [companyInput, setCompanyInput] = useState("");
  const [domainInput, setDomainInput] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/crm/audience");
    const d = await r.json().catch(() => ({}));
    setAudiences(d.audiences ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function evaluate() {
    setEvaluating(true);
    const r = await fetch("/api/admin/crm/audience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "evaluate", rules }),
    });
    const d = await r.json().catch(() => ({}));
    setPreview(d.contacts ?? []);
    setEvaluating(false);
  }

  async function save() {
    if (!saveName.trim()) { onError("Enter a name"); return; }
    const r = await fetch("/api/admin/crm/audience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-audience",
        name: saveName,
        rules,
        contact_count: preview?.length ?? 0,
      }),
    });
    if (r.ok) {
      onSuccess("Audience saved");
      setSaveName("");
      await load();
    } else {
      const d = await r.json().catch(() => ({}));
      onError(d.error || "Save failed");
    }
  }

  async function deleteAudience(id: string) {
    await fetch("/api/admin/crm/audience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-audience", id }),
    });
    await load();
  }

  function addTag() {
    if (tagInput.trim() && !rules.include_tags.includes(tagInput.trim())) {
      setRules({ ...rules, include_tags: [...rules.include_tags, tagInput.trim()] });
      setTagInput("");
    }
  }

  function addExclTag() {
    if (exclTagInput.trim() && !rules.exclude_tags.includes(exclTagInput.trim())) {
      setRules({ ...rules, exclude_tags: [...rules.exclude_tags, exclTagInput.trim()] });
      setExclTagInput("");
    }
  }

  function addCompany() {
    if (companyInput.trim() && !rules.exclude_companies.includes(companyInput.trim())) {
      setRules({ ...rules, exclude_companies: [...rules.exclude_companies, companyInput.trim()] });
      setCompanyInput("");
    }
  }

  function addDomain() {
    if (domainInput.trim() && !rules.exclude_domains.includes(domainInput.trim())) {
      setRules({ ...rules, exclude_domains: [...rules.exclude_domains, domainInput.trim()] });
      setDomainInput("");
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
    <div className="space-y-6">
      {/* Saved audiences */}
      {audiences.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[#555]">Saved Audiences</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {audiences.map((a) => (
              <div key={a.id} className="bg-white rounded-xl border border-[#E8DFD4] p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm text-[#1a1a1a]">{a.name}</p>
                    {a.description && <p className="text-xs text-[#888] mt-0.5">{a.description}</p>}
                  </div>
                  <button
                    onClick={() => deleteAudience(a.id)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[#ccc] hover:text-red-500 hover:bg-red-50"
                  >
                    <FiTrash2 size={13} />
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-[#999]">
                  <span className="flex items-center gap-1"><FiUsers size={12} />{a.contact_count} contacts</span>
                  <button
                    onClick={() => {
                      setRules(a.rules as AudienceRules);
                      setSaveName(a.name);
                    }}
                    className="text-[#ff6b00] hover:underline"
                  >
                    Load rules
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rule builder */}
      <div className="bg-white rounded-xl border border-[#E8DFD4] p-5 space-y-5">
        <h3 className="font-semibold text-[#1a1a1a] flex items-center gap-2">
          <FiTarget size={16} /> Build Audience
        </h3>

        {/* Include types */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase text-[#bbb] tracking-wider font-semibold">Include Types</label>
          <div className="flex flex-wrap gap-2">
            {CONTACT_TYPES.map((t) => {
              const active = rules.include_types.includes(t.value);
              return (
                <button
                  key={t.value}
                  onClick={() =>
                    setRules({
                      ...rules,
                      include_types: active
                        ? rules.include_types.filter((v) => v !== t.value)
                        : [...rules.include_types, t.value],
                    })
                  }
                  className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                    active ? `${t.color} font-semibold` : "bg-white border-[#E8DFD4] text-[#999] hover:border-[#ff6b00]/30"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Exclude types */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase text-[#bbb] tracking-wider font-semibold">Exclude Types</label>
          <div className="flex flex-wrap gap-2">
            {CONTACT_TYPES.map((t) => {
              const active = rules.exclude_types.includes(t.value);
              return (
                <button
                  key={t.value}
                  onClick={() =>
                    setRules({
                      ...rules,
                      exclude_types: active
                        ? rules.exclude_types.filter((v) => v !== t.value)
                        : [...rules.exclude_types, t.value],
                    })
                  }
                  className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                    active ? "bg-red-50 text-red-600 border-red-200 font-semibold" : "bg-white border-[#E8DFD4] text-[#999] hover:border-red-200"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tags */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-[#bbb] tracking-wider font-semibold">Include Tags</label>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTag(); }}
                placeholder="Add tag..."
                className="flex-1 px-3 py-2 rounded-xl bg-[#FAFAF8] border border-[#E8DFD4] text-sm focus:border-[#ff6b00] focus:outline-none"
              />
              <button onClick={addTag} className="w-9 h-9 rounded-xl bg-[#ff6b00] text-white flex items-center justify-center hover:bg-[#e55d00]">
                <FiPlus size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {rules.include_tags.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] border border-emerald-200 flex items-center gap-1">
                  {t}
                  <button onClick={() => setRules({ ...rules, include_tags: rules.include_tags.filter((v) => v !== t) })} className="hover:text-red-500">&times;</button>
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-[#bbb] tracking-wider font-semibold">Exclude Tags</label>
            <div className="flex gap-2">
              <input
                value={exclTagInput}
                onChange={(e) => setExclTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addExclTag(); }}
                placeholder="Add tag..."
                className="flex-1 px-3 py-2 rounded-xl bg-[#FAFAF8] border border-[#E8DFD4] text-sm focus:border-[#ff6b00] focus:outline-none"
              />
              <button onClick={addExclTag} className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100">
                <FiPlus size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {rules.exclude_tags.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] border border-red-200 flex items-center gap-1">
                  {t}
                  <button onClick={() => setRules({ ...rules, exclude_tags: rules.exclude_tags.filter((v) => v !== t) })} className="hover:text-red-700">&times;</button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Numeric filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-[#bbb] tracking-wider font-semibold">Min Match %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={rules.min_match_pct || ""}
              onChange={(e) => setRules({ ...rules, min_match_pct: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="w-full px-3 py-2 rounded-xl bg-[#FAFAF8] border border-[#E8DFD4] text-sm focus:border-[#ff6b00] focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-[#bbb] tracking-wider font-semibold">Active Within (days)</label>
            <input
              type="number"
              min={0}
              value={rules.active_within_days || ""}
              onChange={(e) => setRules({ ...rules, active_within_days: parseInt(e.target.value) || 0 })}
              placeholder="0 = any time"
              className="w-full px-3 py-2 rounded-xl bg-[#FAFAF8] border border-[#E8DFD4] text-sm focus:border-[#ff6b00] focus:outline-none"
            />
          </div>
        </div>

        {/* Exclude companies / domains */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-[#bbb] tracking-wider font-semibold">Exclude Companies</label>
            <div className="flex gap-2">
              <input
                value={companyInput}
                onChange={(e) => setCompanyInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCompany(); }}
                placeholder="Company name..."
                className="flex-1 px-3 py-2 rounded-xl bg-[#FAFAF8] border border-[#E8DFD4] text-sm focus:border-[#ff6b00] focus:outline-none"
              />
              <button onClick={addCompany} className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100">
                <FiPlus size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {rules.exclude_companies.map((c) => (
                <span key={c} className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] border border-red-200 flex items-center gap-1">
                  {c}
                  <button onClick={() => setRules({ ...rules, exclude_companies: rules.exclude_companies.filter((v) => v !== c) })} className="hover:text-red-700">&times;</button>
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-[#bbb] tracking-wider font-semibold">Exclude Domains</label>
            <div className="flex gap-2">
              <input
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addDomain(); }}
                placeholder="domain.com..."
                className="flex-1 px-3 py-2 rounded-xl bg-[#FAFAF8] border border-[#E8DFD4] text-sm focus:border-[#ff6b00] focus:outline-none"
              />
              <button onClick={addDomain} className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100">
                <FiPlus size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {rules.exclude_domains.map((d) => (
                <span key={d} className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] border border-red-200 flex items-center gap-1">
                  {d}
                  <button onClick={() => setRules({ ...rules, exclude_domains: rules.exclude_domains.filter((v) => v !== d) })} className="hover:text-red-700">&times;</button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={evaluate}
            disabled={evaluating}
            className="px-5 py-2.5 rounded-xl bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00] disabled:opacity-50 flex items-center gap-2"
          >
            <FiPlay size={14} />
            {evaluating ? "Evaluating..." : "Preview Audience"}
          </button>
          <button
            onClick={() => { setRules({ ...EMPTY_RULES }); setPreview(null); }}
            className="px-4 py-2.5 rounded-xl bg-white border border-[#E8DFD4] text-sm text-[#999] hover:text-[#555]"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="bg-white rounded-xl border border-[#E8DFD4] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[#1a1a1a] flex items-center gap-2">
              <FiUsers size={16} /> Preview: {preview.length} contacts
            </h3>
            <div className="flex items-center gap-2">
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Audience name..."
                className="px-3 py-2 rounded-xl bg-[#FAFAF8] border border-[#E8DFD4] text-sm focus:border-[#ff6b00] focus:outline-none"
              />
              <button
                onClick={save}
                disabled={!saveName.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
              >
                <FiSave size={14} /> Save
              </button>
            </div>
          </div>

          {preview.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <FiAlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Contacts flagged as Do Not Contact, excluded from bulk, or matching active exclusion rules have been filtered out.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8DFD4] text-[10px] uppercase text-[#bbb] tracking-wider">
                  <th className="text-left py-2 pr-4">Name</th>
                  <th className="text-left py-2 pr-4">Email</th>
                  <th className="text-left py-2 pr-4">Company</th>
                  <th className="text-left py-2 pr-4">Type</th>
                  <th className="text-right py-2">Match</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 50).map((c) => (
                  <tr key={c.id} className="border-b border-[#f5f0ea]">
                    <td className="py-2 pr-4 text-[#1a1a1a]">{c.name || "—"}</td>
                    <td className="py-2 pr-4 text-[#888]">{c.email}</td>
                    <td className="py-2 pr-4 text-[#888]">{c.company || "—"}</td>
                    <td className="py-2 pr-4">
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-600 border-gray-200">{c.contact_type}</span>
                    </td>
                    <td className="py-2 text-right text-[#888]">{c.match_pct ?? "—"}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 50 && (
              <p className="text-xs text-[#999] mt-2">Showing 50 of {preview.length} contacts</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
