"use client";

import { useEffect, useState } from "react";
import { FiEdit3, FiBarChart2, FiZap, FiPlay } from "react-icons/fi";
import SocialEditor from "./SocialEditor";
import SocialAnalytics from "./SocialAnalytics";
import IdeasPanel from "./IdeasPanel";
import AutopilotPanel from "./AutopilotPanel";

export default function SocialPage({
  onSuccess,
  onError,
}: {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [view, setView] = useState<"editor" | "analytics" | "ideas" | "autopilot">("editor");
  const [seedTopic, setSeedTopic] = useState("");
  const [seedNote, setSeedNote] = useState("");
  const [seedNonce, setSeedNonce] = useState(0);
  const [newIdeas, setNewIdeas] = useState(0);

  // Small badge on the Ideas tab so saved topics are discoverable.
  useEffect(() => {
    fetch("/api/admin/social/ideas")
      .then((r) => r.json())
      .then((j) => setNewIdeas(typeof j.newCount === "number" ? j.newCount : 0))
      .catch(() => {});
  }, [view]);

  function draftFromIdea(topic: string, note?: string | null) {
    setSeedTopic(topic);
    setSeedNote(note ?? "");
    setSeedNonce((n) => n + 1);
    setView("editor");
    onSuccess("Drafting posts from this idea…");
  }

  return (
    <div className="space-y-5">
      <div className="inline-flex items-center gap-1 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] p-1">
        <TabBtn active={view === "editor"} onClick={() => setView("editor")} icon={<FiEdit3 size={12} />} label="Composer" />
        <TabBtn active={view === "analytics"} onClick={() => setView("analytics")} icon={<FiBarChart2 size={12} />} label="Analytics" />
        <TabBtn
          active={view === "ideas"}
          onClick={() => setView("ideas")}
          icon={<FiZap size={12} />}
          label="Ideas"
          badge={newIdeas > 0 ? newIdeas : undefined}
        />
        <TabBtn active={view === "autopilot"} onClick={() => setView("autopilot")} icon={<FiPlay size={12} />} label="Autopilot" />
      </div>

      {view === "editor" ? (
        <SocialEditor onSuccess={onSuccess} onError={onError} seedTopic={seedTopic} seedNote={seedNote} seedNonce={seedNonce} />
      ) : view === "analytics" ? (
        <SocialAnalytics onSuccess={onSuccess} onError={onError} />
      ) : view === "autopilot" ? (
        <AutopilotPanel onSuccess={onSuccess} onError={onError} />
      ) : (
        <IdeasPanel onDraft={draftFromIdea} onSuccess={onSuccess} onError={onError} />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active
          ? "bg-emerald-600 text-white"
          : "text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)]"
      }`}
    >
      {icon}
      {label}
      {badge != null && (
        <span
          className={`ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold inline-flex items-center justify-center ${
            active ? "bg-white/25 text-white" : "bg-emerald-500/20 text-emerald-500"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
