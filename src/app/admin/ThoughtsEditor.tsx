"use client";

import { useEffect, useState } from "react";
import {
  FiPlus,
  FiSave,
  FiTrash2,
  FiEdit2,
  FiZap,
  FiX,
  FiEye,
  FiEyeOff,
} from "react-icons/fi";
import type { Thought, ThoughtInput } from "@/lib/content-types";
import { EMPTY_THOUGHT } from "@/lib/content-types";

type Props = {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
};

const inputClass =
  "w-full px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none text-sm text-white placeholder:text-[#555] transition-colors";
const textareaClass = inputClass + " resize-y leading-relaxed";

export default function ThoughtsEditor({ onSuccess, onError }: Props) {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Thought | "new" | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/thoughts")
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && Array.isArray(data.thoughts)) {
          setThoughts(data.thoughts);
        } else if (data.error) {
          onError(data.error);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onError]);

  async function refresh() {
    const r = await fetch("/api/admin/thoughts");
    const d = await r.json();
    if (Array.isArray(d.thoughts)) setThoughts(d.thoughts);
  }

  async function save(input: ThoughtInput, id?: string) {
    const url = id ? `/api/admin/thoughts/${id}` : "/api/admin/thoughts";
    const method = id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      onError(data.error || "Save failed");
      return false;
    }
    onSuccess(id ? "Thought updated" : "Thought saved");
    await refresh();
    return true;
  }

  async function togglePublish(t: Thought) {
    await save(
      {
        title: t.title,
        body: t.body,
        raw_text: t.raw_text,
        tags: t.tags,
        published: !t.published,
        published_at: t.published_at,
      },
      t.id
    );
  }

  async function remove(id: string) {
    if (!confirm("Delete this thought?")) return;
    const res = await fetch(`/api/admin/thoughts/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      onError(data.error || "Delete failed");
      return;
    }
    onSuccess("Thought deleted");
    await refresh();
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Thoughts</h2>
          <p className="text-xs text-[#666] mt-1">
            Drop raw thoughts in. Have Groq clean them up. Publish to{" "}
            <a
              href="/thoughts"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#ff8c38] hover:underline"
            >
              /thoughts
            </a>{" "}
            when ready.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/thoughts"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10 text-[#ccc] text-sm hover:border-[#ff6b00]/40 hover:text-[#ff6b00] transition-colors"
          >
            View live page
          </a>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-semibold text-sm shadow-[0_4px_20px_rgba(255,107,0,0.4)] hover:scale-[1.03] transition-transform"
          >
            <FiPlus size={14} />
            New thought
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-[#666] text-sm">Loading…</p>
      ) : thoughts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] p-10 text-center">
          <p className="text-[#888]">No thoughts yet.</p>
          <p className="text-xs text-[#555] mt-2">
            Add a <code>thoughts</code> table to Supabase by running
            <code className="text-[#ff8c38]"> supabase/schema.sql</code> first.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {thoughts.map((t) => (
            <ThoughtRow
              key={t.id}
              t={t}
              onEdit={() => setEditing(t)}
              onTogglePublish={() => togglePublish(t)}
              onDelete={() => remove(t.id)}
            />
          ))}
        </div>
      )}

      {editing !== null && (
        <ThoughtModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            const id = editing === "new" ? undefined : editing.id;
            const ok = await save(input, id);
            if (ok) setEditing(null);
          }}
          onError={onError}
        />
      )}
    </section>
  );
}

function ThoughtRow({
  t,
  onEdit,
  onTogglePublish,
  onDelete,
}: {
  t: Thought;
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl bg-[#1a1a1a] border border-white/[0.06] p-5">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h3 className="font-bold text-white truncate">
              {t.title || "(no title)"}
            </h3>
            {t.published ? (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                Published
              </span>
            ) : (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/[0.04] text-[#999] border border-white/10 uppercase">
                Draft
              </span>
            )}
          </div>
          <p className="text-xs text-[#666] mb-2">
            {t.published_at
              ? new Date(t.published_at).toLocaleString("en-US")
              : "Not published"}
            {t.tags.length > 0 && <> · {t.tags.join(", ")}</>}
          </p>
          <p className="text-sm text-[#bbb] line-clamp-2 whitespace-pre-wrap">
            {t.body}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onTogglePublish}
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] hover:border-[#ff6b00]/40 hover:text-[#ff6b00] flex items-center justify-center transition-colors"
            title={t.published ? "Unpublish" : "Publish"}
          >
            {t.published ? <FiEyeOff size={13} /> : <FiEye size={13} />}
          </button>
          <button
            onClick={onEdit}
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] hover:border-[#ff6b00]/40 hover:text-[#ff6b00] flex items-center justify-center transition-colors"
            title="Edit"
          >
            <FiEdit2 size={13} />
          </button>
          <button
            onClick={onDelete}
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] hover:border-red-500/40 hover:text-red-400 flex items-center justify-center transition-colors"
            title="Delete"
          >
            <FiTrash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ThoughtModal({
  initial,
  onClose,
  onSave,
  onError,
}: {
  initial: Thought | null;
  onClose: () => void;
  onSave: (input: ThoughtInput) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState<ThoughtInput>(() => {
    if (!initial) return EMPTY_THOUGHT;
    const { id: _i, created_at: _c, updated_at: _u, ...rest } = initial;
    void _i;
    void _c;
    void _u;
    return rest;
  });
  const [raw, setRaw] = useState(initial?.raw_text ?? "");
  const [hint, setHint] = useState("");
  const [formatting, setFormatting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagDraft, setTagDraft] = useState("");

  function patch<K extends keyof ThoughtInput>(k: K, v: ThoughtInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function formatWithAI() {
    if (!raw.trim()) {
      onError("Add some raw text first");
      return;
    }
    setFormatting(true);
    try {
      const res = await fetch("/api/admin/format-thought", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw, hint }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || "Formatting failed");
        setFormatting(false);
        return;
      }
      patch("title", data.title || form.title);
      patch("body", data.body || form.body);
      patch("tags", Array.isArray(data.tags) ? data.tags : form.tags);
      patch("raw_text", raw);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Network error");
    }
    setFormatting(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, raw_text: raw || null });
    setSaving(false);
  }

  function addTag() {
    const v = tagDraft.trim().toLowerCase();
    if (!v) return;
    if (form.tags.includes(v)) {
      setTagDraft("");
      return;
    }
    patch("tags", [...form.tags, v]);
    setTagDraft("");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-[#0f0f0f] border border-white/[0.08] rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] sticky top-0 bg-[#0f0f0f]/95 backdrop-blur-xl rounded-t-3xl">
          <h2 className="font-bold text-lg">
            {initial ? "Edit Thought" : "New Thought"}
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center hover:bg-white/[0.08]"
            aria-label="Close"
          >
            <FiX size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          <div className="rounded-2xl border border-[#ff6b00]/20 bg-gradient-to-br from-[#ff6b00]/[0.05] to-transparent p-4">
            <label className="block text-xs font-mono tracking-[0.15em] uppercase text-[#ff8c38] mb-2">
              Raw thought — write freely
            </label>
            <textarea
              rows={6}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className={textareaClass}
              placeholder="Dump it here. Stream of consciousness is fine — Groq will clean it up."
            />
            <div className="grid sm:grid-cols-[1fr_auto] gap-3 mt-3">
              <input
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                className={inputClass}
                placeholder="Optional hint (e.g. 'make it punchier' or 'focus on the takeaway')"
              />
              <button
                type="button"
                onClick={formatWithAI}
                disabled={formatting}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_4px_20px_rgba(255,107,0,0.4)] hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <FiZap size={14} />
                {formatting ? "Formatting…" : "Format with AI"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono tracking-[0.15em] uppercase text-[#888] mb-2">
              Title
            </label>
            <input
              value={form.title}
              onChange={(e) => patch("title", e.target.value)}
              className={inputClass}
              placeholder="Will be auto-suggested after Format with AI"
            />
          </div>

          <div>
            <label className="block text-xs font-mono tracking-[0.15em] uppercase text-[#888] mb-2">
              Body — this is what gets published
            </label>
            <textarea
              rows={10}
              value={form.body}
              onChange={(e) => patch("body", e.target.value)}
              className={textareaClass}
              placeholder="Cleaned-up post body. Edit freely after Format with AI."
            />
          </div>

          <div>
            <label className="block text-xs font-mono tracking-[0.15em] uppercase text-[#888] mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff6b00]/10 border border-[#ff6b00]/25 text-[#ff8c38] text-xs"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => patch("tags", form.tags.filter((x) => x !== t))}
                    className="hover:text-white"
                  >
                    <FiX size={11} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className={inputClass}
                placeholder="Type and press Enter"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm hover:border-[#ff6b00]/40 hover:text-[#ff6b00]"
              >
                Add
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => patch("published", e.target.checked)}
              className="w-4 h-4 accent-[#ff6b00]"
            />
            <span>
              <strong className="text-white">Publish</strong>{" "}
              <span className="text-[#888]">
                — when checked, this appears on the public{" "}
                <code className="text-[#ff8c38]">/thoughts</code> page.
              </span>
            </span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full border border-white/10 text-sm hover:bg-white/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_4px_20px_rgba(255,107,0,0.4)] hover:scale-[1.02] disabled:opacity-60"
            >
              <FiSave size={14} />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
