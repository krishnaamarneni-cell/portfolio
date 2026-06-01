"use client";

import { useEffect, useState } from "react";
import {
  FiMail,
  FiStar,
  FiTrash2,
  FiSearch,
  FiArrowUp,
  FiArrowDown,
  FiFilter,
  FiUsers,
} from "react-icons/fi";

type Contact = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  role_pitched: string | null;
  match_pct: number | null;
  starred: boolean;
  emailed_at: string | null;
  times_contacted: number;
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SortKey = "times_contacted" | "match_pct" | "name" | "created_at";
type SortDir = "asc" | "desc";

export default function ContactsTab({
  onError,
  onSuccess,
}: {
  onError: (m: string) => void;
  onSuccess: (m: string) => void;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("times_contacted");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterMatch, setFilterMatch] = useState<string>("all");
  const [sending, setSending] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/admin/contacts");
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j.contacts)) setContacts(j.contacts);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function act(body: Record<string, unknown>) {
    const r = await fetch("/api/admin/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) load();
  }

  async function sendEmail(c: Contact) {
    setSending(c.id);
    try {
      const r = await fetch("/api/admin/contacts/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: c.id,
          to: c.email,
          recruiterName: c.name || "Hiring Manager",
          company: c.company || undefined,
          rolePitched: c.role_pitched || undefined,
        }),
      });
      const j = await r.json();
      if (j.ok) {
        onSuccess(`Email sent to ${c.name || c.email}`);
        load();
      } else {
        onError(j.error || "Send failed");
      }
    } catch {
      onError("Network error");
    }
    setSending(null);
  }

  // Filter + search + sort.
  const filtered = contacts
    .filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        const hay = `${c.name} ${c.email} ${c.company ?? ""} ${c.role_pitched ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterSource !== "all" && c.source !== filterSource) return false;
      if (filterMatch === "strong" && (c.match_pct ?? 0) < 70) return false;
      if (filterMatch === "weak" && (c.match_pct ?? 0) >= 70) return false;
      if (filterMatch === "starred" && !c.starred) return false;
      return true;
    })
    .sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case "times_contacted":
          av = a.times_contacted ?? 0;
          bv = b.times_contacted ?? 0;
          break;
        case "match_pct":
          av = a.match_pct ?? -1;
          bv = b.match_pct ?? -1;
          break;
        case "name":
          return sortDir === "asc"
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        case "created_at":
          av = new Date(a.created_at).getTime();
          bv = new Date(b.created_at).getTime();
          break;
        default:
          av = 0;
          bv = 0;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });

  const sources = [...new Set(contacts.map((c) => c.source))];
  const strongCount = contacts.filter((c) => (c.match_pct ?? 0) >= 70).length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FiUsers size={20} />
            Contacts
            <span className="text-sm font-normal text-[#666]">
              {contacts.length} total · {strongCount} strong matches
            </span>
          </h2>
          <p className="text-xs text-[#666] mt-1">
            Recruiter contacts extracted from your inbox. Sort by frequency, match %, or date.
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: contacts.length, color: "text-white" },
          { label: "Strong (>70%)", value: strongCount, color: "text-emerald-300" },
          { label: "Emailed", value: contacts.filter((c) => c.emailed_at).length, color: "text-sky-300" },
          { label: "Starred", value: contacts.filter((c) => c.starred).length, color: "text-amber-300" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-[#1a1a1a] border border-white/[0.06] p-3 text-center">
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-[#666]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <FiSearch size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, company, role..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#1a1a1a] border border-white/[0.08] text-xs text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6b00]/60"
          />
        </div>
        <select
          value={filterMatch}
          onChange={(e) => setFilterMatch(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#1a1a1a] border border-white/[0.08] text-xs text-[#999]"
        >
          <option value="all">All matches</option>
          <option value="strong">Strong (&gt;70%)</option>
          <option value="weak">Weak (&lt;70%)</option>
          <option value="starred">Starred only</option>
        </select>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#1a1a1a] border border-white/[0.08] text-xs text-[#999]"
        >
          <option value="all">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Sort buttons */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-mono uppercase tracking-widest text-[#666] mr-1">Sort</span>
        {([
          { key: "times_contacted" as SortKey, label: "Frequency" },
          { key: "match_pct" as SortKey, label: "Match %" },
          { key: "created_at" as SortKey, label: "Date" },
          { key: "name" as SortKey, label: "Name" },
        ]).map((s) => {
          const active = sortKey === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleSort(s.key)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                active
                  ? "bg-[#ff6b00]/15 border-[#ff6b00]/40 text-[#ff8c38]"
                  : "bg-white/[0.04] border-white/[0.08] text-[#999] hover:border-[#ff6b00]/30"
              }`}
            >
              {s.label}
              {active && (sortDir === "desc" ? <FiArrowDown size={10} /> : <FiArrowUp size={10} />)}
            </button>
          );
        })}
      </div>

      {/* Contact list */}
      {loading ? (
        <p className="text-sm text-[#666]">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-[#1a1a1a] border border-white/[0.06] p-8 text-center">
          <FiUsers size={24} className="mx-auto text-[#444] mb-2" />
          <p className="text-sm text-[#666]">
            {contacts.length === 0
              ? "No contacts yet. Run Email Intelligence in the Agents tab to extract contacts from your inbox."
              : "No contacts match your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border p-4 flex items-center gap-3 ${
                c.starred
                  ? "border-amber-500/20 bg-amber-500/[0.02]"
                  : "border-white/[0.06] bg-[#1a1a1a]"
              }`}
            >
              {/* Star */}
              <button type="button" onClick={() => act({ action: "star", id: c.id, starred: !c.starred })} className="shrink-0">
                <FiStar
                  size={14}
                  className={c.starred ? "text-amber-300" : "text-[#444]"}
                  fill={c.starred ? "currentColor" : "none"}
                />
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white truncate">{c.name || c.email}</span>
                  {c.company && (
                    <span className="text-[10px] text-[#888]">@ {c.company}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="text-[10px] text-[#666] font-mono">{c.email}</span>
                  {c.role_pitched && (
                    <span className="text-[10px] text-[#555]">— {c.role_pitched}</span>
                  )}
                </div>
                {c.notes && (
                  <p className="text-[9px] text-[#555] mt-1 truncate">{c.notes}</p>
                )}
              </div>

              {/* Frequency badge */}
              <div className="shrink-0 text-center">
                <div className={`text-sm font-bold ${c.times_contacted >= 3 ? "text-[#ff8c38]" : c.times_contacted >= 2 ? "text-white" : "text-[#888]"}`}>
                  {c.times_contacted ?? 1}
                </div>
                <div className="text-[8px] font-mono text-[#666] uppercase">emails</div>
              </div>

              {/* Match % */}
              {c.match_pct !== null && (
                <span
                  className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    c.match_pct >= 70
                      ? "bg-emerald-500/15 text-emerald-300"
                      : c.match_pct >= 40
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-white/[0.04] text-[#666]"
                  }`}
                >
                  {c.match_pct}%
                </span>
              )}

              {/* Source badge */}
              <span className="shrink-0 text-[8px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-[#666] uppercase hidden sm:block">
                {c.source}
              </span>

              {/* Actions */}
              {c.emailed_at ? (
                <span className="shrink-0 text-[9px] font-mono text-emerald-400/70 px-2">
                  Sent
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => sendEmail(c)}
                  disabled={sending === c.id}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-bold hover:bg-sky-500/25 disabled:opacity-50"
                >
                  <FiMail size={10} />
                  {sending === c.id ? "..." : "Email"}
                </button>
              )}

              <button
                type="button"
                onClick={() => act({ action: "delete", id: c.id })}
                className="shrink-0 w-7 h-7 rounded-md text-[#444] hover:text-red-400 flex items-center justify-center"
              >
                <FiTrash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
