"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiTrash2, FiCheck } from "react-icons/fi";
import { inputClass } from "./shared";

type HabitRow = {
  id: string;
  name: string;
  emoji: string | null;
  streak: number;
  checkins: Record<string, boolean>;
};

export default function HabitsCard({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");

  useEffect(() => {
    void load();
  }, []);
  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/habits", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(j.habits)) setHabits(j.habits);
    setLoading(false);
  }
  async function add() {
    if (!name.trim()) return;
    const r = await fetch("/api/admin/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        emoji: emoji.trim() || undefined,
      }),
    });
    if (r.ok) {
      onSuccess("Habit added");
      setName("");
      setEmoji("");
      void load();
    } else onError("Failed");
  }
  async function toggle(id: string) {
    const r = await fetch("/api/admin/habits/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habit_id: id }),
    });
    if (r.ok) void load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this habit and its history?")) return;
    await fetch(`/api/admin/habits/${id}`, { method: "DELETE" });
    void load();
  }

  if (loading) return null;
  const today = (() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-4 text-left"
      >
        <div className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0">
          <FiCheck size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-[var(--admin-text)]">Habits</h3>
            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-[var(--admin-surface-hover)] text-[var(--admin-text-muted)] border border-[var(--admin-border)] uppercase font-mono">
              {habits.length}
            </span>
            {habits.some((h) => h.checkins[today]) && (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                {habits.filter((h) => h.checkins[today]).length}/{habits.length}{" "}
                today
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--admin-text-muted)] mt-1">
            Daily checkboxes. Streaks counted backward from today. Feeds the
            Sunday Reflection.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-[var(--admin-text-muted)] px-2 py-1">
          {expanded ? "Hide" : "Open"}
        </span>
      </button>
      {expanded && (
        <div className="mt-4 pt-4 border-t border-[var(--admin-border)] space-y-3">
          <div className="flex gap-2">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
              placeholder="\u{1F3C3}"
              className="w-16 text-center px-2 py-2 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] focus:outline-none text-sm"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New habit (e.g. 'Workout', 'Write 200 words')"
              className={inputClass + " flex-1 text-sm"}
            />
            <button
              type="button"
              onClick={add}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs hover:bg-emerald-500/25"
            >
              <FiPlus size={11} />
              Add
            </button>
          </div>

          {habits.length === 0 ? (
            <p className="text-xs text-[var(--admin-text-muted)]">
              No habits yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {habits.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--admin-surface-hover)] border border-[var(--admin-border)]"
                >
                  <button
                    type="button"
                    onClick={() => toggle(h.id)}
                    className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                      h.checkins[today]
                        ? "bg-emerald-500 text-black"
                        : "bg-[var(--admin-surface-hover)] border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:border-emerald-500/40"
                    }`}
                    title="Toggle today"
                  >
                    <FiCheck size={12} />
                  </button>
                  <span className="text-sm shrink-0">{h.emoji || "•"}</span>
                  <span className="text-sm text-[var(--admin-text)] flex-1 min-w-0 truncate">
                    {h.name}
                  </span>
                  <div className="hidden sm:flex items-center gap-0.5">
                    {last7.map((d) => (
                      <span
                        key={d}
                        title={d}
                        className={`w-3 h-3 rounded-sm ${
                          h.checkins[d]
                            ? "bg-emerald-500"
                            : "bg-[var(--admin-surface-hover)]"
                        }`}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-[10px] font-mono tabular-nums ${h.streak > 0 ? "text-amber-300" : "text-[var(--admin-text-muted)]"}`}
                  >
                    {"\u{1F525}"} {h.streak}d
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(h.id)}
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
