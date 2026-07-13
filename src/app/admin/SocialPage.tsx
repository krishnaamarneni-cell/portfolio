"use client";

import { useState } from "react";
import { FiEdit3, FiBarChart2 } from "react-icons/fi";
import SocialEditor from "./SocialEditor";
import SocialAnalytics from "./SocialAnalytics";

export default function SocialPage({
  onSuccess,
  onError,
}: {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [view, setView] = useState<"editor" | "analytics">("editor");
  return (
    <div className="space-y-5">
      <div className="inline-flex items-center gap-1 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] p-1">
        <TabBtn
          active={view === "editor"}
          onClick={() => setView("editor")}
          icon={<FiEdit3 size={12} />}
          label="Composer"
        />
        <TabBtn
          active={view === "analytics"}
          onClick={() => setView("analytics")}
          icon={<FiBarChart2 size={12} />}
          label="Analytics"
        />
      </div>

      {view === "editor" ? (
        <SocialEditor onSuccess={onSuccess} onError={onError} />
      ) : (
        <SocialAnalytics onSuccess={onSuccess} onError={onError} />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
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
    </button>
  );
}
