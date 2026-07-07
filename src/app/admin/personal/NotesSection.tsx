"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiZap,
  FiClock,
  FiAlertTriangle,
  FiStar,
  FiSave,
  FiX,
  FiArchive,
} from "react-icons/fi";
import VoiceMic from "../VoiceMic";
import {
  inputClass,
  daysUntil,
  bucketLabel,
  timeAgo,
  StatChip,
  Markdown,
} from "./shared";
import type { PersonalNote } from "./shared";

type AgentResult = {
  markdown: string;
  context: Record<string, unknown>;
  runAt: number;
};

export default function NotesSection({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftCategory, setDraftCategory] = useState<string>("note");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editDate, setEditDate] = useState("");

  const [agentBusy, setAgentBusy] = useState(false);
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
    try {
      const saved = window.localStorage.getItem("krishna_admin_life_digest");
      if (saved) setAgentResult(JSON.parse(saved));
    } catch {}
  }, []);

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/admin/personal/notes", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(j.notes)) {
      setNotes(j.notes);
    } else if (j.error) {
      onError(j.error);
    }
    setLoading(false);
  }

  async function create() {
    if (!draft.trim()) return;
    setCreating(true);
    const tags = draftCategory !== "note" ? [draftCategory] : [];
    const r = await fetch("/api/admin/personal/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: draft.trim(),
        event_date: draftDate || undefined,
        tags,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setCreating(false);
    if (!r.ok) {
      onError(j.error || "Save failed");
      return;
    }
    onSuccess(
      `${draftCategory === "note" ? "Note" : draftCategory.charAt(0).toUpperCase() + draftCategory.slice(1)} saved`
    );
    setDraft("");
    setDraftDate("");
    setDraftCategory("note");
    setNotes((n) => [j.note, ...n]);
  }

  async function patch(id: string, p: Partial<PersonalNote>) {
    const r = await fetch(`/api/admin/personal/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error || "Update failed");
      return;
    }
    setNotes((arr) => arr.map((n) => (n.id === id ? j.note : n)));
  }

  async function remove(id: string) {
    if (!confirm("Delete this note?")) return;
    const r = await fetch(`/api/admin/personal/notes/${id}`, {
      method: "DELETE",
    });
    if (!r.ok) {
      onError("Delete failed");
      return;
    }
    setNotes((arr) => arr.filter((n) => n.id !== id));
    onSuccess("Deleted");
  }

  async function runAgent() {
    setAgentBusy(true);
    setAgentError(null);
    try {
      const r = await fetch("/api/admin/agents/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setAgentError(j.error || "Life agent failed");
        onError(j.error || "Life agent failed");
      } else {
        const next: AgentResult = {
          markdown: j.markdown || "",
          context: j.context || {},
          runAt: Date.now(),
        };
        setAgentResult(next);
        try {
          window.localStorage.setItem(
            "krishna_admin_life_digest",
            JSON.stringify(next)
          );
        } catch {}
        onSuccess("Life agent done");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setAgentError(msg);
      onError(msg);
    }
    setAgentBusy(false);
  }

  const grouped = useMemo(() => {
    const sorted = [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const ra = bucketLabel(daysUntil(a.event_date)).rank;
      const rb = bucketLabel(daysUntil(b.event_date)).rank;
      if (ra !== rb) return ra - rb;
      return (a.event_date ?? "9999").localeCompare(b.event_date ?? "9999");
    });
    return sorted;
  }, [notes]);

  const stats = useMemo(() => {
    let overdue = 0;
    let urgent = 0;
    let soon = 0;
    for (const n of notes) {
      const d = daysUntil(n.event_date);
      if (d === null) continue;
      if (d < 0) overdue++;
      else if (d <= 14) urgent++;
      else if (d <= 60) soon++;
    }
    return { overdue, urgent, soon };
  }, [notes]);

  return (
    <>
      {/* Quick add */}
      <div className="rounded-2xl border border-[#ff6b00]/20 bg-gradient-to-br from-[#ff6b00]/[0.05] to-transparent p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="block text-xs font-mono tracking-[0.15em] uppercase text-[#ff8c38]">
              Add
            </label>
            <select
              value={draftCategory}
              onChange={(e) => setDraftCategory(e.target.value)}
              className="px-2 py-1 rounded-lg bg-[var(--admin-bg)] border border-[#ff6b00]/30 text-xs text-[#ff8c38] focus:outline-none"
            >
              <option value="note">Note</option>
              <option value="fact">Fact</option>
              <option value="habit">Habit</option>
              <option value="reading">Reading</option>
              <option value="visa">Visa / Immigration</option>
              <option value="tax">Tax</option>
              <option value="housing">Housing</option>
              <option value="travel">Travel</option>
              <option value="health">Health</option>
              <option value="goal">Goal</option>
            </select>
          </div>
          <VoiceMic
            size="sm"
            mode="live"
            onText={(text, isFinal) => {
              if (isFinal) {
                setDraft((d) => (d ? `${d} ${text}` : text));
              } else {
                setDraft(text);
              }
            }}
            onError={(msg) => onError(msg)}
          />
        </div>
        <textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={inputClass + " resize-y leading-relaxed"}
          placeholder={
            'e.g. "H1B STEM OPT expires May 5" — dates and tags are auto-detected. Or tap the mic to talk.'
          }
        />
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] focus:border-[#ff6b00]/60 focus:outline-none text-xs text-[var(--admin-text)]"
            title="Override the auto-detected date"
          />
          <span className="text-[10px] text-[var(--admin-text-muted)] font-mono">
            (optional -- auto-detected from text otherwise)
          </span>
          <button
            type="button"
            onClick={create}
            disabled={creating || !draft.trim()}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-xs shadow-[0_4px_15px_rgba(255,107,0,0.35)] hover:scale-[1.03] disabled:opacity-60"
          >
            <FiPlus size={12} />
            {creating ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Stats + agent button */}
      <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <StatChip
            label="Overdue"
            value={stats.overdue}
            color="#f87171"
            urgent={stats.overdue > 0}
          />
          <StatChip label="Urgent ≤14d" value={stats.urgent} color="#fb923c" />
          <StatChip label="Soon ≤60d" value={stats.soon} color="#fbbf24" />
          <StatChip label="Total" value={notes.length} color="#888" />
        </div>
        <button
          type="button"
          onClick={runAgent}
          disabled={agentBusy || notes.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_4px_20px_rgba(255,107,0,0.4)] hover:scale-[1.02] disabled:opacity-60"
        >
          <FiZap size={14} />
          {agentBusy ? "Thinking..." : "Run Life agent"}
        </button>
      </div>

      {/* Agent error */}
      {agentError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-300/90 flex items-start gap-2">
          <FiAlertTriangle size={12} className="mt-0.5 shrink-0" />
          <p className="break-all">
            <strong>Agent error:</strong> {agentError}
          </p>
        </div>
      )}

      {/* Agent digest */}
      {agentResult && !agentBusy && (
        <div className="rounded-2xl bg-[var(--admin-bg)] border border-[var(--admin-border)] p-5">
          <div className="flex items-center gap-2 mb-3 text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)]">
            <FiClock size={10} />
            Last run {timeAgo(agentResult.runAt)}
            {typeof agentResult.context.provider === "string" && (
              <span>- search: {String(agentResult.context.provider)}</span>
            )}
            {typeof agentResult.context.model === "string" && (
              <span>- {String(agentResult.context.model)}</span>
            )}
          </div>
          <Markdown text={agentResult.markdown} />
        </div>
      )}

      {/* Notes list */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-[var(--admin-text)]">
          All notes
        </h3>
        {loading ? (
          <p className="text-xs text-[var(--admin-text-muted)]">Loading...</p>
        ) : notes.length === 0 ? (
          <p className="text-xs text-[var(--admin-text-muted)]">
            Nothing on file yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {grouped.map((n) => {
              const d = daysUntil(n.event_date);
              const b = bucketLabel(d);
              const isEditing = editing === n.id;
              return (
                <li
                  key={n.id}
                  className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className={inputClass + " text-sm"}
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="px-3 py-1.5 rounded-lg bg-[var(--admin-bg)] border border-[var(--admin-border)] text-xs text-[var(--admin-text)]"
                        />
                        <button
                          onClick={async () => {
                            await patch(n.id, {
                              body: editBody,
                              event_date: editDate || null,
                            });
                            setEditing(null);
                          }}
                          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ff6b00] text-black text-xs font-bold"
                        >
                          <FiSave size={11} />
                          Save
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--admin-surface-hover)] border border-[var(--admin-border)] text-xs"
                        >
                          <FiX size={11} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {n.pinned && (
                            <FiStar size={11} className="text-[#ff8c38]" />
                          )}
                          <span
                            className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
                            style={{
                              color: b.color,
                              backgroundColor: b.color + "22",
                              border: `1px solid ${b.color}33`,
                            }}
                          >
                            {b.label}
                          </span>
                          {n.event_date && (
                            <span className="text-[10px] font-mono text-[var(--admin-text-muted)]">
                              {n.event_date}
                            </span>
                          )}
                          {n.tags.map((t) => (
                            <span
                              key={t}
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--admin-surface-hover)] text-[var(--admin-text-muted)] border border-[var(--admin-border)]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-[var(--admin-text)] whitespace-pre-wrap leading-relaxed">
                          {n.body}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => patch(n.id, { pinned: !n.pinned })}
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${n.pinned ? "text-[#ff8c38]" : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"}`}
                          title={n.pinned ? "Unpin" : "Pin"}
                        >
                          <FiStar size={12} />
                        </button>
                        <button
                          onClick={() => {
                            setEditing(n.id);
                            setEditBody(n.body);
                            setEditDate(n.event_date ?? "");
                          }}
                          className="w-8 h-8 rounded-full text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] flex items-center justify-center"
                          title="Edit"
                        >
                          <FiEdit2 size={12} />
                        </button>
                        <button
                          onClick={() => patch(n.id, { archived: true })}
                          className="w-8 h-8 rounded-full text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] flex items-center justify-center"
                          title="Archive"
                        >
                          <FiArchive size={12} />
                        </button>
                        <button
                          onClick={() => remove(n.id)}
                          className="w-8 h-8 rounded-full text-[var(--admin-text-muted)] hover:text-red-400 flex items-center justify-center"
                          title="Delete"
                        >
                          <FiTrash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
