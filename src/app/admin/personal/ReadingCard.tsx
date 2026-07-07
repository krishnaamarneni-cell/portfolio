"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiTrash2, FiBook, FiStar } from "react-icons/fi";
import { inputClass } from "./shared";

type Reading = {
  id: string;
  title: string;
  author: string | null;
  status: "wishlist" | "reading" | "done" | "abandoned";
  rating: number | null;
  notes: string | null;
};

export default function ReadingCard({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [items, setItems] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState<Reading["status"]>("reading");

  useEffect(() => {
    void load();
  }, []);
  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/reading", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(j.items)) setItems(j.items);
    setLoading(false);
  }
  async function add() {
    if (!title.trim()) return;
    const r = await fetch("/api/admin/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        author: author.trim() || undefined,
        status,
      }),
    });
    if (r.ok) {
      onSuccess("Added");
      setTitle("");
      setAuthor("");
      void load();
    } else onError("Failed");
  }
  async function patch(id: string, patch: Partial<Reading>) {
    await fetch(`/api/admin/reading/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    void load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this book?")) return;
    await fetch(`/api/admin/reading/${id}`, { method: "DELETE" });
    void load();
  }

  if (loading) return null;
  const grouped: Record<Reading["status"], Reading[]> = {
    reading: [],
    wishlist: [],
    done: [],
    abandoned: [],
  };
  for (const i of items) grouped[i.status].push(i);

  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-4 text-left"
      >
        <div className="w-11 h-11 rounded-xl bg-pink-500/15 text-pink-300 flex items-center justify-center shrink-0">
          <FiBook size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-[var(--admin-text)]">Reading</h3>
            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-[var(--admin-surface-hover)] text-[var(--admin-text-muted)] border border-[var(--admin-border)] uppercase font-mono">
              {items.length}
            </span>
            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-pink-500/10 text-pink-300 border border-pink-500/20 uppercase">
              {grouped.reading.length} reading
            </span>
          </div>
          <p className="text-[11px] text-[var(--admin-text-muted)] mt-1">
            Wishlist - Reading - Done. Quick notes per book. You wrote one --
            track what you're reading next.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-[var(--admin-text-muted)] px-2 py-1">
          {expanded ? "Hide" : "Open"}
        </span>
      </button>
      {expanded && (
        <div className="mt-4 pt-4 border-t border-[var(--admin-border)] space-y-4">
          {/* Add */}
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_140px_auto] gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className={inputClass + " text-sm"}
            />
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author (optional)"
              className={inputClass + " text-sm"}
            />
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as Reading["status"])
              }
              className={inputClass + " text-sm"}
            >
              <option value="wishlist">Wishlist</option>
              <option value="reading">Reading</option>
              <option value="done">Done</option>
              <option value="abandoned">Abandoned</option>
            </select>
            <button
              type="button"
              onClick={add}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs hover:bg-pink-500/25"
            >
              <FiPlus size={11} />
              Add
            </button>
          </div>

          {(["reading", "wishlist", "done", "abandoned"] as const).map((s) => {
            const list = grouped[s];
            if (list.length === 0) return null;
            return (
              <div key={s}>
                <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)] mb-1.5">
                  {s} ({list.length})
                </p>
                <ul className="space-y-1.5">
                  {list.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--admin-surface-hover)] border border-[var(--admin-border)]"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--admin-text)] truncate">
                          {b.title}
                        </p>
                        {b.author && (
                          <p className="text-[10px] text-[var(--admin-text-muted)] truncate">
                            by {b.author}
                          </p>
                        )}
                      </div>
                      <select
                        value={b.status}
                        onChange={(e) =>
                          patch(b.id, {
                            status: e.target.value as Reading["status"],
                          })
                        }
                        className="shrink-0 px-2 py-1 rounded-md bg-[var(--admin-bg)] border border-[var(--admin-border)] text-[10px] text-[var(--admin-text)]"
                      >
                        <option value="wishlist">Wishlist</option>
                        <option value="reading">Reading</option>
                        <option value="done">Done</option>
                        <option value="abandoned">Abandoned</option>
                      </select>
                      {b.status === "done" && (
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => patch(b.id, { rating: n })}
                              className={
                                n <= (b.rating ?? 0)
                                  ? "text-amber-300"
                                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
                              }
                            >
                              <FiStar
                                size={10}
                                fill={
                                  n <= (b.rating ?? 0)
                                    ? "currentColor"
                                    : "none"
                                }
                              />
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(b.id)}
                        className="w-7 h-7 rounded-md text-[var(--admin-text-muted)] hover:text-red-400 flex items-center justify-center"
                      >
                        <FiTrash2 size={11} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
