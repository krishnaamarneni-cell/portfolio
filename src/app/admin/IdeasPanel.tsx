"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEdit3, FiTrash2, FiRefreshCw, FiZap } from "react-icons/fi";

type Idea = {
  id: string;
  topic: string;
  note: string | null;
  source: string | null;
  status: string;
  created_at: string;
};

export default function IdeasPanel({
  onDraft,
  onSuccess,
  onError,
}: {
  onDraft: (topic: string) => void;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [topic, setTopic] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/social/ideas");
      const j = await r.json();
      setIdeas(Array.isArray(j.ideas) ? j.ideas : []);
      setNeedsMigration(!!j.needsMigration);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    const t = topic.trim();
    if (!t) return;
    setAdding(true);
    try {
      const r = await fetch("/api/admin/social/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", topic: t, note: note.trim() || undefined, source: "manual" }),
      });
      if (r.ok) {
        setTopic("");
        setNote("");
        onSuccess("Idea saved");
        load();
      } else onError("Could not save idea");
    } catch {
      onError("Network error");
    }
    setAdding(false);
  }

  async function act(action: "remove" | "status", idea: Idea, status?: string) {
    // optimistic
    if (action === "remove") setIdeas((xs) => xs.filter((i) => i.id !== idea.id));
    else setIdeas((xs) => xs.map((i) => (i.id === idea.id ? { ...i, status: status! } : i)));
    try {
      await fetch("/api/admin/social/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "remove"
            ? { action: "remove", id: idea.id }
            : { action: "status", id: idea.id, status }
        ),
      });
    } catch {}
  }

  const newIdeas = ideas.filter((i) => i.status !== "dismissed");

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/25 to-emerald-500/5 ring-1 ring-emerald-500/20 flex items-center justify-center shrink-0">
            <FiZap size={18} className="text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--admin-text)]">Post ideas</h2>
            <p className="text-[11px] text-[var(--admin-text-secondary)] max-w-md">
              Topics your agents flagged (or you saved). Draft one in the Composer, then review and post.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)] text-xs text-[var(--admin-text-secondary)] hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-50"
        >
          <FiRefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {needsMigration ? (
        <p className="text-[11px] text-amber-500">
          Run <code className="font-mono px-1 rounded bg-[var(--admin-input-bg)]">supabase/social_ideas.sql</code> in
          Supabase once to enable the ideas inbox.
        </p>
      ) : (
        <>
          {/* Manual add */}
          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 space-y-2">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(); }}
              placeholder="Add a topic idea… e.g. 'how compound interest turned my paycheck into freedom'"
              className="w-full px-3 py-2 rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] focus:border-emerald-500 focus:outline-none text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)]"
            />
            <div className="flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") add(); }}
                placeholder="Optional angle / note"
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] focus:border-emerald-500 focus:outline-none text-xs text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)]"
              />
              <button
                type="button"
                onClick={add}
                disabled={adding || !topic.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                <FiPlus size={12} />
                Add
              </button>
            </div>
          </div>

          {newIdeas.length === 0 ? (
            <p className="text-[12px] text-[var(--admin-text-muted)] py-8 text-center">
              {loading ? "Loading…" : "No ideas yet. Save some from the agent chat or the Social Observer, or add one above."}
            </p>
          ) : (
            <div className="space-y-2">
              {newIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className={`rounded-xl border p-4 space-y-2 ${
                    idea.status === "drafted"
                      ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface)]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--admin-text)]">{idea.topic}</p>
                      {idea.note && (
                        <p className="text-[11px] text-[var(--admin-text-secondary)] mt-0.5">{idea.note}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        {idea.source && (
                          <span className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-[var(--admin-text-muted)]">
                            {idea.source}
                          </span>
                        )}
                        {idea.status === "drafted" && (
                          <span className="text-[9px] font-bold text-emerald-500">DRAFTED</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onDraft(idea.topic);
                          act("status", idea, "drafted");
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20"
                      >
                        <FiEdit3 size={12} />
                        Draft in Composer
                      </button>
                      <button
                        type="button"
                        onClick={() => act("remove", idea)}
                        className="p-1.5 rounded-lg text-[var(--admin-text-muted)] hover:text-red-400 hover:bg-red-400/10"
                        title="Delete"
                      >
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
