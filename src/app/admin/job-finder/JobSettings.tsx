"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiSave, FiX, FiPlus, FiRefreshCw } from "react-icons/fi";
import type { Settings } from "./types";

type Props = { onSuccess: (m: string) => void; onError: (m: string) => void };

function TagList({
  label,
  hint,
  values,
  onChange,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v || values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...values, v]);
    setDraft("");
  };

  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-1.5">
        {label}
      </label>
      {hint && <p className="text-xs text-[var(--admin-text-muted)] mb-2 leading-relaxed">{hint}</p>}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-[var(--admin-bg)] text-[var(--admin-text)] border border-[var(--admin-border)]"
          >
            {v}
            <button
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-[var(--admin-text-muted)] hover:text-rose-500"
              aria-label={`Remove ${v}`}
            >
              <FiX size={11} />
            </button>
          </span>
        ))}
        {!values.length && <span className="text-xs text-[var(--admin-text-muted)]">None yet</span>}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Type and press Enter"
          className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[#ff6b00]"
        />
        <button
          onClick={add}
          className="p-2 rounded-lg border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[#ff6b00] transition-colors"
          aria-label={`Add to ${label}`}
        >
          <FiPlus size={13} />
        </button>
      </div>
    </div>
  );
}

export default function JobSettings({ onSuccess, onError }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const cb = useRef({ onSuccess, onError });
  cb.current = { onSuccess, onError };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/job-finder/settings");
      const data = await res.json();
      if (data.error) {
        cb.current.onError(data.error);
        return;
      }
      setSettings(data.settings);
    } catch {
      cb.current.onError("Could not load Job Finder settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/job-finder/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.error) {
        onError(data.error);
        return;
      }
      setSettings(data.settings);
      onSuccess("Job Finder preferences saved.");
    } catch {
      onError("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const patch = (next: Partial<Settings>) => setSettings((s) => (s ? { ...s, ...next } : s));
  const patchProfile = (next: Partial<Settings["profile"]>) =>
    setSettings((s) => (s ? { ...s, profile: { ...s.profile, ...next } } : s));

  if (loading || !settings) {
    return <p className="text-sm text-[var(--admin-text-muted)] py-8 text-center">Loading…</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--admin-text-muted)] leading-relaxed max-w-2xl">
          These preferences drive both what gets surfaced and how the AI scores each posting against you.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={load}
            className="p-2 rounded-lg border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] transition-colors"
            aria-label="Reload"
          >
            <FiRefreshCw size={13} />
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00] transition-colors disabled:opacity-50"
          >
            <FiSave size={13} />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-5 space-y-5">
        <h3 className="font-semibold text-[var(--admin-text)] text-sm">Search preferences</h3>

        <TagList
          label="Keywords"
          hint="Terms that mark a posting as relevant to you."
          values={settings.keywords}
          onChange={(keywords) => patch({ keywords })}
        />
        <TagList
          label="Locations"
          values={settings.locations}
          onChange={(locations) => patch({ locations })}
        />
        <TagList
          label="Work types"
          hint="remote, hybrid, onsite"
          values={settings.work_types}
          onChange={(work_types) => patch({ work_types })}
        />
        <TagList
          label="Target companies"
          hint="Optional. Leave empty to consider every source."
          values={settings.target_companies}
          onChange={(target_companies) => patch({ target_companies })}
        />

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-1.5">
            Minimum match score
          </label>
          <p className="text-xs text-[var(--admin-text-muted)] mb-2">
            Listings below this score are still saved, just pushed down the feed. Currently{" "}
            <span className="font-semibold text-[var(--admin-text)] tabular-nums">{settings.min_match_score}</span>.
          </p>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={settings.min_match_score}
            onChange={(e) => patch({ min_match_score: Number(e.target.value) })}
            className="w-full accent-[#ff6b00]"
          />
        </div>
      </div>

      <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-5 space-y-5">
        <div>
          <h3 className="font-semibold text-[var(--admin-text)] text-sm">Your profile</h3>
          <p className="text-xs text-[var(--admin-text-muted)] mt-1 leading-relaxed">
            This is what the AI compares each posting against. The more precise it is, the more honest the scores.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-1.5">
            Summary
          </label>
          <textarea
            value={settings.profile.summary}
            onChange={(e) => patchProfile({ summary: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:outline-none focus:border-[#ff6b00] leading-relaxed"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-1.5">
              Years of experience
            </label>
            <input
              type="number"
              min={0}
              max={60}
              value={settings.profile.experience_years}
              onChange={(e) => patchProfile({ experience_years: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:outline-none focus:border-[#ff6b00]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-1.5">
              Education
            </label>
            <input
              value={settings.profile.education}
              onChange={(e) => patchProfile({ education: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:outline-none focus:border-[#ff6b00]"
            />
          </div>
        </div>

        <TagList
          label="Skills"
          values={settings.profile.skills}
          onChange={(skills) => patchProfile({ skills })}
        />
        <TagList
          label="Target roles"
          hint="Job titles you actually want. Scoring penalises postings that drift away from these."
          values={settings.profile.target_roles}
          onChange={(target_roles) => patchProfile({ target_roles })}
        />
      </div>
    </div>
  );
}
