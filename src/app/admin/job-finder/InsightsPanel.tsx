"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiMap,
  FiBarChart2,
  FiTarget,
  FiRefreshCw,
  FiExternalLink,
  FiAlertTriangle,
} from "react-icons/fi";
import UsaTileMap from "./UsaTileMap";
import Treemap from "./Treemap";
import { scoreTone } from "./types";

type Props = { onError: (m: string) => void };

type SkillNode = {
  name: string;
  count: number;
  companies: string[];
  jobs: Array<{ id: string; title: string; company: string | null; url: string; score: number | null }>;
};

type Insights = {
  totals: { active: number; placed: number; remote: number; unplaced: number; statesLit: number };
  states: Array<{ code: string; name: string; count: number }>;
  topStates: Array<{ code: string; name: string; count: number }>;
  skills: Array<{ name: string; count: number }>;
  companies: Array<{ name: string; count: number }>;
  profileSkills: SkillNode[];
};

type View = "map" | "market" | "opportunity";

export default function InsightsPanel({ onError }: Props) {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("map");
  const [dimension, setDimension] = useState<"skills" | "companies">("skills");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  const cb = useRef({ onError });
  cb.current = { onError };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/job-finder/insights");
      const json = await res.json();
      if (json.error) {
        cb.current.onError(json.error);
        return;
      }
      setData(json);
    } catch {
      cb.current.onError("Could not load insights.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return <p className="text-sm text-[var(--admin-text-muted)] py-10 text-center">Reading the market…</p>;
  }
  if (!data) return null;

  const skill = data.profileSkills.find((s) => s.name === selectedSkill) ?? null;
  const withJobs = data.profileSkills.filter((s) => s.count > 0);
  const withoutJobs = data.profileSkills.filter((s) => s.count === 0);
  const maxSkill = Math.max(1, ...data.profileSkills.map((s) => s.count));

  const VIEWS: Array<[View, string, React.ComponentType<{ size?: number }>]> = [
    ["map", "USA heatmap", FiMap],
    ["market", "Market intelligence", FiBarChart2],
    ["opportunity", "Opportunity map", FiTarget],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-[var(--admin-bg)] rounded-lg p-1">
          {VIEWS.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                view === id
                  ? "bg-[#ff6b00] text-white"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        <span className="text-xs text-[var(--admin-text-muted)]">
          {data.totals.active} active roles · {data.totals.statesLit} states
        </span>

        <button
          onClick={load}
          disabled={loading}
          className="ml-auto p-2 rounded-lg border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] disabled:opacity-50"
          aria-label="Refresh"
        >
          <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── USA heatmap ── */}
      {view === "map" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4">
            <UsaTileMap states={data.states} selected={selectedState} onSelect={setSelectedState} />
            <p className="text-[10px] text-[var(--admin-text-muted)] mt-3 leading-relaxed">
              Equal-area tiles, not a geographic map — the variable here is how many roles are open, and
              drawing real state areas would over-weight empty western states. {data.totals.remote} roles are
              remote and {data.totals.unplaced} carry no readable location, so neither appears on the grid.
            </p>
          </div>

          <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2.5">
              Top states
            </p>
            {!data.topStates.length ? (
              <p className="text-xs text-[var(--admin-text-muted)]">No located roles yet.</p>
            ) : (
              <div className="space-y-1.5">
                {data.topStates.map((s, i) => (
                  <button
                    key={s.code}
                    onClick={() => setSelectedState(s.code)}
                    className={`w-full flex items-center gap-2 text-left px-1.5 py-1 rounded ${
                      selectedState === s.code ? "bg-[#ff6b00]/10" : "hover:bg-[var(--admin-bg)]"
                    }`}
                  >
                    <span className="text-[10px] text-[var(--admin-text-muted)] w-4 tabular-nums">{i + 1}</span>
                    <span className="text-xs text-[var(--admin-text)] flex-1 truncate">{s.name}</span>
                    <span className="text-xs font-semibold text-[var(--admin-text)] tabular-nums">
                      {s.count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Market intelligence ── */}
      {view === "market" && (
        <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4">
          <div className="flex items-center gap-2 mb-3">
            {(["skills", "companies"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDimension(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  dimension === d
                    ? "border-[#ff6b00] text-[#ff6b00]"
                    : "border-[var(--admin-border)] text-[var(--admin-text-muted)]"
                }`}
              >
                {d === "skills" ? "Skill demand" : "Company demand"}
              </button>
            ))}
            <span className="text-[10px] text-[var(--admin-text-muted)] ml-auto">
              Tile area = number of open roles
            </span>
          </div>

          <Treemap
            items={dimension === "skills" ? data.skills : data.companies}
            unit="roles"
            height={400}
          />

          {dimension === "skills" && data.skills.length < 5 && (
            <p className="text-[10px] text-amber-500 mt-3 leading-relaxed">
              Skills come from scored postings only, so this fills in as scoring catches up — it is thin
              right now rather than the market being thin.
            </p>
          )}
        </div>
      )}

      {/* ── Opportunity map ── */}
      {view === "opportunity" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-1">
              Your skills, and who is hiring for them
            </p>
            <p className="text-[10px] text-[var(--admin-text-muted)] mb-3">
              Click a skill to see the open roles and employers behind it.
            </p>

            <div className="flex flex-wrap gap-1.5">
              {withJobs.map((s) => {
                const weight = s.count / maxSkill;
                const active = selectedSkill === s.name;
                return (
                  <button
                    key={s.name}
                    onClick={() => setSelectedSkill(active ? null : s.name)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-colors ${
                      active
                        ? "border-[#ff6b00] bg-[#ff6b00]/10"
                        : "border-[var(--admin-border)] hover:border-[#ff6b00]/50"
                    }`}
                    style={{ backgroundColor: active ? undefined : `rgba(255,107,0,${0.04 + weight * 0.16})` }}
                  >
                    <span className="text-xs font-semibold text-[var(--admin-text)]">{s.name}</span>
                    <span className="text-[10px] font-bold text-[#ff6b00] tabular-nums">{s.count}</span>
                  </button>
                );
              })}
            </div>

            {withoutJobs.length > 0 && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mt-4 mb-1.5">
                  No openings found ({withoutJobs.length})
                </p>
                {/* Shown rather than filtered out: a skill with nothing behind it
                    is a finding about the market, or about the keywords. */}
                <div className="flex flex-wrap gap-1.5">
                  {withoutJobs.map((s) => (
                    <span
                      key={s.name}
                      className="px-2 py-1 rounded-lg border border-dashed border-[var(--admin-border)] text-[11px] text-[var(--admin-text-muted)]"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--admin-text-muted)] mt-2 leading-relaxed">
                  Either nobody in the tracked pool is asking for these, or no posting naming them has been
                  scored yet — skills are only read off scored roles.
                </p>
              </>
            )}
          </div>

          <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4">
            {!skill ? (
              <div className="text-center py-8">
                <FiTarget size={22} className="mx-auto text-[var(--admin-text-muted)] mb-2" />
                <p className="text-xs text-[var(--admin-text-muted)]">
                  Pick a skill to see its roles and employers.
                </p>
              </div>
            ) : (
              <>
                <p className="font-semibold text-[var(--admin-text)] text-sm">{skill.name}</p>
                <p className="text-[11px] text-[var(--admin-text-muted)] mt-0.5">
                  {skill.count} open role{skill.count === 1 ? "" : "s"} · {skill.companies.length} employer
                  {skill.companies.length === 1 ? "" : "s"}
                </p>

                {skill.companies.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {skill.companies.map((c) => (
                      <span
                        key={c}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border border-[var(--admin-border)]"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5 mt-3 max-h-[420px] overflow-y-auto">
                  {skill.jobs.map((j) => {
                    const tone = scoreTone(j.score);
                    return (
                      <a
                        key={j.id}
                        href={j.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 bg-[var(--admin-bg)] rounded-lg border border-[var(--admin-border)] px-2.5 py-2 hover:border-[#ff6b00] transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-[var(--admin-text)] truncate">
                            {j.title}
                          </p>
                          <p className="text-[10px] text-[var(--admin-text-muted)] truncate">
                            {j.company ?? "Unknown company"}
                          </p>
                        </div>
                        {j.score !== null && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border shrink-0 ${tone.className}`}
                          >
                            {j.score}
                          </span>
                        )}
                        <FiExternalLink size={10} className="text-[var(--admin-text-muted)] shrink-0 mt-0.5" />
                      </a>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {data.totals.active < 50 && (
        <div className="flex gap-2 text-[10px] text-[var(--admin-text-muted)]">
          <FiAlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            These charts describe the {data.totals.active} roles your keywords have reached, not the whole
            market. Widen the keywords in Settings to widen the picture.
          </p>
        </div>
      )}
    </div>
  );
}
