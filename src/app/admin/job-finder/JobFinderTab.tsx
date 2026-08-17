"use client";

import { useCallback, useState } from "react";
import { FiCompass, FiBookmark, FiFileText, FiGlobe, FiSliders } from "react-icons/fi";
import JobFeed from "./JobFeed";
import SourcesPanel from "./SourcesPanel";
import JobSettings from "./JobSettings";
import ApplicationsTab from "../ApplicationsTab";
import type { Stats } from "./types";

type Props = { onSuccess: (m: string) => void; onError: (m: string) => void };

type SubTab = "discover" | "saved" | "applications" | "sources" | "settings";

const SUB_TABS: Array<{ id: SubTab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "discover", label: "Discover", icon: FiCompass },
  { id: "saved", label: "Saved", icon: FiBookmark },
  { id: "applications", label: "Applications", icon: FiFileText },
  { id: "sources", label: "Sources", icon: FiGlobe },
  { id: "settings", label: "Settings", icon: FiSliders },
];

export default function JobFinderTab({ onSuccess, onError }: Props) {
  const [sub, setSub] = useState<SubTab>("discover");
  const [stats, setStats] = useState<Stats>({});

  const handleStats = useCallback((s: Stats) => setStats(s), []);

  const badge = (id: SubTab) => {
    if (id === "discover") return stats.new || 0;
    if (id === "saved") return stats.saved || 0;
    return 0;
  };

  return (
    <section>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-[var(--admin-text)]">Job Finder</h2>
        <p className="text-sm text-[var(--admin-text-muted)] mt-1">
          Discovered roles, scored against your profile. You review and apply — nothing is submitted for you.
        </p>
      </div>

      <div className="flex gap-1 mb-5 border-b border-[var(--admin-border)] overflow-x-auto">
        {SUB_TABS.map(({ id, label, icon: Icon }) => {
          const active = sub === id;
          const count = badge(id);
          return (
            <button
              key={id}
              onClick={() => setSub(id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                active
                  ? "border-[#ff6b00] text-[#ff6b00]"
                  : "border-transparent text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
              }`}
            >
              <Icon size={14} />
              {label}
              {count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                    active ? "bg-[#ff6b00] text-white" : "bg-[var(--admin-bg)] text-[var(--admin-text-muted)]"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {sub === "discover" && (
        <JobFeed
          scope="active"
          showScoring
          onStats={handleStats}
          onSuccess={onSuccess}
          onError={onError}
          emptyTitle="No listings discovered yet"
          emptyHint="Hit “Find jobs” to pull live postings from 11 major career sites using the keywords in Settings. Then “Score with AI” ranks what came back against your profile."
        />
      )}

      {sub === "saved" && (
        <JobFeed
          scope="saved"
          onStats={handleStats}
          onSuccess={onSuccess}
          onError={onError}
          emptyTitle="Nothing saved"
          emptyHint="Save a listing from Discover and it lands here, ready to turn into an application kit."
        />
      )}

      {sub === "applications" && <ApplicationsTab onSuccess={onSuccess} onError={onError} />}

      {sub === "sources" && <SourcesPanel onSuccess={onSuccess} onError={onError} />}

      {sub === "settings" && <JobSettings onSuccess={onSuccess} onError={onError} />}
    </section>
  );
}
