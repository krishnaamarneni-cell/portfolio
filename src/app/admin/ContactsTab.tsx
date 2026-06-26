"use client";

import { useEffect, useState } from "react";
import {
  FiMail,
  FiStar,
  FiTrash2,
  FiSearch,
  FiArrowUp,
  FiArrowDown,
  FiUsers,
  FiEdit2,
  FiSend,
  FiPaperclip,
  FiCheck,
  FiX,
  FiCheckSquare,
} from "react-icons/fi";

type ContactType = "recruiter" | "personal" | "colleague" | "unknown";

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
  contact_type: ContactType;
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
  const [filterMatch, setFilterMatch] = useState<string>("all");

  // Edit contact
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", company: "", role: "", notes: "" });

  // Email composer
  const [composeTo, setComposeTo] = useState<Contact | null>(null);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeAttachResume, setComposeAttachResume] = useState(true);
  const [composeSending, setComposeSending] = useState(false);
  const [composeGenerating, setComposeGenerating] = useState(false);

  // Contact classification
  const [classifying, setClassifying] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  // Bulk send
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSubject, setBulkSubject] = useState("Exploring opportunities");
  const [bulkBody, setBulkBody] = useState("");
  const [bulkAttachResume, setBulkAttachResume] = useState(true);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);

  async function load() {
    const r = await fetch("/api/admin/contacts");
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j.contacts)) setContacts(j.contacts);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function act(body: Record<string, unknown>) {
    const r = await fetch("/api/admin/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) load();
  }

  // ── Edit contact ──
  function startEdit(c: Contact) {
    setEditingId(c.id);
    setEditForm({ name: c.name, email: c.email, company: c.company || "", role: c.role_pitched || "", notes: c.notes || "" });
  }
  async function saveEdit() {
    if (!editingId) return;
    await act({ email: editForm.email, name: editForm.name, company: editForm.company || null, role_pitched: editForm.role || null, notes: editForm.notes || null });
    setEditingId(null);
    onSuccess("Contact updated");
  }

  // ── Email composer ──
  function openComposer(c: Contact) {
    setComposeTo(c);
    setComposeSubject(c.role_pitched ? `Re: ${c.role_pitched}` : "Exploring opportunities");
    setComposeBody("");
    setComposeAttachResume(true);
    // Auto-generate draft
    generateDraft(c);
  }

  async function generateDraft(c: Contact) {
    setComposeGenerating(true);
    try {
      const r = await fetch("/api/admin/contacts/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: c.id, to: c.email, recruiterName: c.name || "Hiring Manager",
          company: c.company || undefined, rolePitched: c.role_pitched || undefined,
          draftOnly: true,
        }),
      });
      const j = await r.json();
      if (j.draft) setComposeBody(j.draft);
    } catch {}
    setComposeGenerating(false);
  }

  async function sendComposed() {
    if (!composeTo) return;
    setComposeSending(true);
    try {
      const r = await fetch("/api/admin/contacts/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: composeTo.id,
          to: composeTo.email,
          recruiterName: composeTo.name || "Hiring Manager",
          company: composeTo.company || undefined,
          rolePitched: composeTo.role_pitched || undefined,
          customMessage: composeBody,
          customSubject: composeSubject,
          attachResume: composeAttachResume,
        }),
      });
      const j = await r.json();
      if (j.ok) {
        onSuccess(`Sent to ${composeTo.name || composeTo.email}`);
        setComposeTo(null);
        load();
      } else {
        onError(j.error || "Send failed");
      }
    } catch { onError("Network error"); }
    setComposeSending(false);
  }

  // ── Bulk send ──
  function toggleSelect(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }
  function selectAll() {
    const recruiters = filtered.filter((c) => c.contact_type === "recruiter" || c.contact_type === "unknown");
    if (selected.size === recruiters.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(recruiters.map((c) => c.id)));
    }
  }

  async function generateBulkDraft() {
    setBulkGenerating(true);
    try {
      const r = await fetch("/api/admin/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "I'm reaching out regarding potential opportunities that match my background.",
          instruction: "Write a short cold outreach email (3-4 sentences) for a job seeker with SAP and AI engineering background. Professional but human. End with a call to action.",
        }),
      });
      const j = await r.json();
      if (j.rewritten) setBulkBody(j.rewritten);
    } catch {}
    setBulkGenerating(false);
  }

  async function sendBulk() {
    if (selected.size === 0 || !bulkBody) return;
    setBulkSending(true);
    let sent = 0;
    const targets = contacts.filter((c) => selected.has(c.id));
    for (const c of targets) {
      try {
        // Personalize: replace {name} with first name
        const firstName = c.name.split(" ")[0] || "there";
        const personalBody = bulkBody.replace(/\{name\}/gi, firstName);
        const r = await fetch("/api/admin/contacts/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: c.id, to: c.email,
            recruiterName: c.name || "Hiring Manager",
            customMessage: personalBody,
            customSubject: bulkSubject,
            attachResume: bulkAttachResume,
          }),
        });
        const j = await r.json();
        if (j.ok) sent++;
      } catch {}
    }
    onSuccess(`Sent to ${sent}/${targets.length} contacts`);
    setBulkSending(false);
    setBulkMode(false);
    setSelected(new Set());
    load();
  }

  // ── Classify contacts ──
  async function classifyContacts() {
    setClassifying(true);
    try {
      const r = await fetch("/api/admin/contacts/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (j.classified !== undefined) {
        onSuccess(`Classified ${j.classified} contacts`);
        load();
      } else {
        onError(j.error || "Classification failed");
      }
    } catch {
      onError("Network error");
    }
    setClassifying(false);
  }

  // ── Filter + sort ──
  const filtered = contacts
    .filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        if (!`${c.name} ${c.email} ${c.company ?? ""} ${c.role_pitched ?? ""}`.toLowerCase().includes(q)) return false;
      }
      if (filterMatch === "strong" && (c.match_pct ?? 0) < 70) return false;
      if (filterMatch === "weak" && (c.match_pct ?? 0) >= 70) return false;
      if (filterMatch === "starred" && !c.starred) return false;
      if (filterType !== "all" && c.contact_type !== filterType) return false;
      return true;
    })
    .sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case "times_contacted": av = a.times_contacted ?? 0; bv = b.times_contacted ?? 0; break;
        case "match_pct": av = a.match_pct ?? -1; bv = b.match_pct ?? -1; break;
        case "name": return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        case "created_at": av = new Date(a.created_at).getTime(); bv = new Date(b.created_at).getTime(); break;
        default: av = 0; bv = 0;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });

  const strongCount = contacts.filter((c) => (c.match_pct ?? 0) >= 70).length;
  const recruiterCount = contacts.filter((c) => c.contact_type === "recruiter").length;
  const unknownCount = contacts.filter((c) => c.contact_type === "unknown").length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const inputCls = "w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/[0.08] text-xs text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6b00]/60";

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FiUsers size={20} /> Contacts
            <span className="text-sm font-normal text-[#666]">{contacts.length} total · {strongCount} strong</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {unknownCount > 0 && (
            <button
              type="button"
              onClick={classifyContacts}
              disabled={classifying}
              className="px-3 py-1.5 rounded-full text-xs font-bold border bg-violet-500/15 border-violet-500/30 text-violet-300 disabled:opacity-50"
            >
              {classifying ? "Classifying..." : `Classify ${unknownCount}`}
            </button>
          )}
          <button
            type="button"
            onClick={() => { setBulkMode(!bulkMode); setSelected(new Set()); }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${bulkMode ? "bg-[#ff6b00]/15 border-[#ff6b00]/40 text-[#ff8c38]" : "bg-white/[0.04] border-white/[0.08] text-[#999]"}`}
          >
            {bulkMode ? "Exit bulk" : "Bulk send"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total", value: contacts.length, color: "text-white" },
          { label: "Recruiters", value: recruiterCount, color: "text-orange-300" },
          { label: "Strong", value: strongCount, color: "text-emerald-300" },
          { label: "Emailed", value: contacts.filter((c) => c.emailed_at).length, color: "text-sky-300" },
          { label: "Starred", value: contacts.filter((c) => c.starred).length, color: "text-amber-300" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-[#1a1a1a] border border-white/[0.06] p-3 text-center">
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-[#666]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + filters + sort */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[180px] relative">
          <FiSearch size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#1a1a1a] border border-white/[0.08] text-xs text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6b00]/60" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#1a1a1a] border border-white/[0.08] text-xs text-[#999]">
          <option value="all">All types</option>
          <option value="recruiter">Recruiters</option>
          <option value="colleague">Colleagues</option>
          <option value="personal">Personal</option>
          <option value="unknown">Unknown</option>
        </select>
        <select value={filterMatch} onChange={(e) => setFilterMatch(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#1a1a1a] border border-white/[0.08] text-xs text-[#999]">
          <option value="all">All match</option>
          <option value="strong">&gt;70%</option>
          <option value="weak">&lt;70%</option>
          <option value="starred">Starred</option>
        </select>
        {([ { key: "times_contacted" as SortKey, label: "Freq" }, { key: "match_pct" as SortKey, label: "Match" }, { key: "created_at" as SortKey, label: "Date" }, { key: "name" as SortKey, label: "Name" }
        ]).map((s) => (
          <button key={s.key} type="button" onClick={() => toggleSort(s.key)}
            className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold border ${sortKey === s.key ? "bg-[#ff6b00]/15 border-[#ff6b00]/40 text-[#ff8c38]" : "bg-white/[0.04] border-white/[0.08] text-[#999]"}`}>
            {s.label}
            {sortKey === s.key && (sortDir === "desc" ? <FiArrowDown size={10} /> : <FiArrowUp size={10} />)}
          </button>
        ))}
      </div>

      {/* Bulk send controls */}
      {bulkMode && (
        <div className="rounded-xl bg-[#ff6b00]/[0.04] border border-[#ff6b00]/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button type="button" onClick={selectAll} className="text-[10px] text-[#ff8c38] underline">
                {selected.size > 0 ? "Deselect all" : "Select all recruiters"}
              </button>
              <span className="text-xs text-[#888]">{selected.size} selected</span>
            </div>
          </div>
          <input value={bulkSubject} onChange={(e) => setBulkSubject(e.target.value)} placeholder="Subject line" className={inputCls} />
          <textarea value={bulkBody} onChange={(e) => setBulkBody(e.target.value)} rows={4} placeholder="Email body... Use {name} to personalize (e.g. 'Hi {name},')" className={inputCls + " resize-y"} />
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={generateBulkDraft} disabled={bulkGenerating}
              className="px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-[10px] font-bold text-violet-300 disabled:opacity-50">
              {bulkGenerating ? "Generating..." : "AI Generate"}
            </button>
            <label className="flex items-center gap-1.5 text-[10px] text-[#999] cursor-pointer">
              <input type="checkbox" checked={bulkAttachResume} onChange={(e) => setBulkAttachResume(e.target.checked)}
                className="rounded border-white/20 bg-[#0a0a0a]" />
              <FiPaperclip size={10} /> Attach resume
            </label>
            <div className="flex-1" />
            <button type="button" onClick={sendBulk} disabled={bulkSending || selected.size === 0 || !bulkBody}
              className="px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40">
              {bulkSending ? "Sending..." : `Send to ${selected.size} contacts`}
            </button>
          </div>
        </div>
      )}

      {/* Email composer modal */}
      {composeTo && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setComposeTo(null)}>
          <div className="w-full max-w-lg bg-[#1a1a1a] rounded-2xl border border-white/[0.08] p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">Email to {composeTo.name || composeTo.email}</h3>
              <button type="button" onClick={() => setComposeTo(null)} className="text-[#666] hover:text-white"><FiX size={16} /></button>
            </div>
            <div className="text-[10px] text-[#666]">To: {composeTo.email}</div>
            <input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Subject" className={inputCls} />
            <textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} rows={6}
              placeholder={composeGenerating ? "Generating AI draft..." : "Email body..."} className={inputCls + " resize-y"} />
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={() => generateDraft(composeTo)} disabled={composeGenerating}
                className="px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-[10px] font-bold text-violet-300 disabled:opacity-50">
                {composeGenerating ? "..." : "Regenerate AI"}
              </button>
              <label className="flex items-center gap-1.5 text-[10px] text-[#999] cursor-pointer">
                <input type="checkbox" checked={composeAttachResume} onChange={(e) => setComposeAttachResume(e.target.checked)}
                  className="rounded border-white/20 bg-[#0a0a0a]" />
                <FiPaperclip size={10} /> Attach resume
              </label>
              <div className="flex-1" />
              <button type="button" onClick={sendComposed} disabled={composeSending || !composeBody}
                className="px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40">
                <FiSend size={12} className="inline mr-1" />
                {composeSending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit contact modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setEditingId(null)}>
          <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-white/[0.08] p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-white">Edit contact</h3>
            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" className={inputCls} />
            <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Email" className={inputCls} />
            <input value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} placeholder="Company" className={inputCls} />
            <input value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} placeholder="Role pitched" className={inputCls} />
            <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Notes" rows={2} className={inputCls + " resize-y"} />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-xs text-[#999]">Cancel</button>
              <button type="button" onClick={saveEdit} className="px-4 py-1.5 rounded-lg bg-[#ff6b00]/15 border border-[#ff6b00]/40 text-xs font-bold text-[#ff8c38]">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Contact list */}
      {loading ? (
        <p className="text-sm text-[#666]">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-[#1a1a1a] border border-white/[0.06] p-8 text-center">
          <FiUsers size={24} className="mx-auto text-[#444] mb-2" />
          <p className="text-sm text-[#666]">{contacts.length === 0 ? "No contacts yet. Run Email Intelligence." : "No contacts match filters."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.id} className={`rounded-xl border p-3 flex items-center gap-2.5 ${c.starred ? "border-amber-500/20 bg-amber-500/[0.02]" : "border-white/[0.06] bg-[#1a1a1a]"}`}>
              {/* Bulk checkbox — only recruiters + unknown can be selected */}
              {bulkMode && (
                c.contact_type === "personal" || c.contact_type === "colleague" ? (
                  <span className="shrink-0 w-[14px] h-[14px] rounded-sm bg-white/[0.03] border border-white/[0.06]" title="Not a recruiter" />
                ) : (
                  <button type="button" onClick={() => toggleSelect(c.id)} className="shrink-0">
                    <FiCheckSquare size={14} className={selected.has(c.id) ? "text-[#ff8c38]" : "text-[#444]"} />
                  </button>
                )
              )}
              {/* Star */}
              <button type="button" onClick={() => act({ action: "star", id: c.id, starred: !c.starred })} className="shrink-0">
                <FiStar size={13} className={c.starred ? "text-amber-300" : "text-[#444]"} fill={c.starred ? "currentColor" : "none"} />
              </button>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white truncate">{c.name || c.email}</span>
                  {c.company && <span className="text-[10px] text-[#888]">@ {c.company}</span>}
                  {c.contact_type && c.contact_type !== "unknown" && (
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                      c.contact_type === "recruiter" ? "bg-orange-500/15 text-orange-300" :
                      c.contact_type === "colleague" ? "bg-blue-500/15 text-blue-300" :
                      "bg-gray-500/15 text-gray-400"
                    }`}>
                      {c.contact_type}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#666] truncate">{c.email}{c.role_pitched ? ` — ${c.role_pitched}` : ""}</p>
              </div>
              {/* Frequency */}
              <div className="shrink-0 text-center w-10">
                <div className={`text-sm font-bold ${c.times_contacted >= 3 ? "text-[#ff8c38]" : "text-[#888]"}`}>{c.times_contacted ?? 1}</div>
                <div className="text-[7px] font-mono text-[#666]">emails</div>
              </div>
              {/* Match */}
              {c.match_pct !== null && (
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${c.match_pct >= 70 ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.04] text-[#666]"}`}>
                  {c.match_pct}%
                </span>
              )}
              {/* Actions */}
              <button type="button" onClick={() => startEdit(c)} className="shrink-0 w-7 h-7 rounded-md text-[#555] hover:text-white flex items-center justify-center">
                <FiEdit2 size={11} />
              </button>
              {c.emailed_at && (
                <span className="shrink-0 text-[8px] font-mono text-emerald-400/70">Sent</span>
              )}
              <button type="button" onClick={() => openComposer(c)}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-bold hover:bg-sky-500/25">
                <FiMail size={10} /> {c.emailed_at ? "Again" : "Email"}
              </button>
              <button type="button" onClick={() => act({ action: "delete", id: c.id })}
                className="shrink-0 w-6 h-6 rounded-md text-[#444] hover:text-red-400 flex items-center justify-center">
                <FiTrash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
