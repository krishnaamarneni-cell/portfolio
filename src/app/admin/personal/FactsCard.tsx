"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiTrash2, FiInfo } from "react-icons/fi";
import { inputClass } from "./shared";

type Fact = {
  id: string;
  key: string;
  value: string;
  category: string;
  expires_at: string | null;
};

export default function FactsCard({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [k, setK] = useState("");
  const [v, setV] = useState("");
  const [c, setC] = useState("general");
  const [exp, setExp] = useState("");

  useEffect(() => {
    void load();
  }, []);
  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/facts", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(j.facts)) setFacts(j.facts);
    setLoading(false);
  }
  async function add() {
    if (!k.trim() || !v.trim()) return;
    const r = await fetch("/api/admin/facts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: k.trim(),
        value: v.trim(),
        category: c,
        expires_at: exp || undefined,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error || "Save failed");
      return;
    }
    onSuccess(`Fact saved: ${k}`);
    setK("");
    setV("");
    setExp("");
    void load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this fact?")) return;
    const r = await fetch(`/api/admin/facts/${id}`, { method: "DELETE" });
    if (r.ok) {
      void load();
      onSuccess("Deleted");
    }
  }

  if (loading) return null;
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-4 text-left"
      >
        <div className="w-11 h-11 rounded-xl bg-cyan-500/15 text-cyan-300 flex items-center justify-center shrink-0">
          <FiInfo size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-[var(--admin-text)]">Facts</h3>
            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-[var(--admin-surface-hover)] text-[var(--admin-text-muted)] border border-[var(--admin-border)] uppercase font-mono">
              {facts.length}
            </span>
          </div>
          <p className="text-[11px] text-[var(--admin-text-muted)] mt-1">
            Always-on memory. Every agent (chat, news, jobs, life, briefings)
            auto-loads these into its system prompt.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-[var(--admin-text-muted)] px-2 py-1">
          {expanded ? "Hide" : "Open"}
        </span>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-[var(--admin-border)] space-y-3">
          {/* Add form */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_120px_140px_auto] gap-2 items-end">
            <input
              value={k}
              onChange={(e) => setK(e.target.value)}
              placeholder="key (e.g. visa_status)"
              className={inputClass + " text-xs"}
            />
            <input
              value={v}
              onChange={(e) => setV(e.target.value)}
              placeholder="value (e.g. H1B STEM OPT)"
              className={inputClass + " text-xs"}
            />
            <select
              value={c}
              onChange={(e) => setC(e.target.value)}
              className={inputClass + " text-xs"}
            >
              {[
                "general",
                "visa",
                "location",
                "family",
                "work",
                "health",
                "preferences",
                "finance",
              ].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={exp}
              onChange={(e) => setExp(e.target.value)}
              className={inputClass + " text-xs"}
              title="Expires at"
            />
            <button
              type="button"
              onClick={add}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs hover:bg-cyan-500/25"
            >
              <FiPlus size={11} />
              Add
            </button>
          </div>

          {/* List */}
          {facts.length === 0 ? (
            <p className="text-xs text-[var(--admin-text-muted)]">
              No facts yet. Try keys like <code>visa_status</code>,{" "}
              <code>location_current</code>, <code>wife_birthday</code>,{" "}
              <code>diet</code>.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {facts.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--admin-surface-hover)] border border-[var(--admin-border)]"
                >
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--admin-surface-hover)] text-[var(--admin-text-muted)] border border-[var(--admin-border)]">
                    {f.category}
                  </span>
                  <span className="text-xs font-mono text-cyan-300 shrink-0">
                    {f.key}:
                  </span>
                  <span className="text-xs text-[var(--admin-text)] flex-1 min-w-0 truncate">
                    {f.value}
                  </span>
                  {f.expires_at && (
                    <span className="text-[10px] font-mono text-[var(--admin-text-muted)]">
                      exp {f.expires_at}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(f.id)}
                    className="w-7 h-7 rounded-md text-[var(--admin-text-muted)] hover:text-red-400 flex items-center justify-center"
                  >
                    <FiTrash2 size={11} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
