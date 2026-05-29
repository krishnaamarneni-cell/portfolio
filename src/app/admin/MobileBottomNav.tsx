"use client";

import { useState } from "react";
import {
  FiHeart,
  FiMessageSquare,
  FiZap,
  FiCpu,
  FiMoreHorizontal,
  FiLayout,
  FiBriefcase,
  FiFolder,
  FiShare2,
  FiBarChart2,
  FiLink,
  FiX,
} from "react-icons/fi";

export type Tab =
  | "content"
  | "thoughts"
  | "jobs"
  | "projects"
  | "social"
  | "analytics"
  | "agents"
  | "personal"
  | "connectors"
  | "chat";

/** Five-slot bottom bar. Order chosen for daily-touch frequency:
 *  Chat → Life → Social → Agents → More. iPhone 15/16 widths (393-440px)
 *  give ~78-88px per slot which fits a 22px icon + 11px label comfortably. */
const PRIMARY: Array<{ id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "chat", label: "Chat", icon: FiMessageSquare },
  { id: "personal", label: "Life", icon: FiHeart },
  { id: "social", label: "Social", icon: FiShare2 },
  { id: "agents", label: "Agents", icon: FiCpu },
];

const SECONDARY: Array<{ id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "content", label: "Site Content", icon: FiLayout },
  { id: "thoughts", label: "Notes", icon: FiZap },
  { id: "jobs", label: "Jobs", icon: FiBriefcase },
  { id: "projects", label: "Projects", icon: FiFolder },
  { id: "analytics", label: "Analytics", icon: FiBarChart2 },
  { id: "connectors", label: "Settings", icon: FiLink },
];

export default function MobileBottomNav({
  active,
  onSelect,
}: {
  active: Tab;
  onSelect: (t: Tab) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  const moreContainsActive = SECONDARY.some((s) => s.id === active);

  return (
    <>
      {/* Bottom bar — iOS-style frosted glass, 49pt tab height + safe area */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-2xl border-t border-white/[0.08]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {PRIMARY.map((item) => {
            const Icon = item.icon;
            const on = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`flex flex-col items-center gap-1 py-2.5 active:scale-95 transition-transform ${on ? "text-[#ff8c38]" : "text-[#999]"}`}
              >
                <Icon size={22} />
                <span className="text-[11px] font-medium tracking-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center gap-1 py-2.5 active:scale-95 transition-transform ${moreContainsActive ? "text-[#ff8c38]" : "text-[#999]"}`}
          >
            <FiMoreHorizontal size={22} />
            <span className="text-[11px] font-medium tracking-tight">More</span>
          </button>
        </div>
      </nav>

      {/* "More" sheet */}
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="w-full bg-[#0a0a0a] rounded-t-3xl border-t border-white/[0.08] p-5 pb-8"
            style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">More</h3>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.08] text-[#888] flex items-center justify-center"
              >
                <FiX size={14} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {SECONDARY.map((item) => {
                const Icon = item.icon;
                const on = active === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect(item.id);
                      setMoreOpen(false);
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border ${on ? "bg-[#ff6b00]/15 border-[#ff6b00]/40 text-[#ff8c38]" : "bg-white/[0.03] border-white/[0.06] text-[#ccc]"}`}
                  >
                    <Icon size={20} />
                    <span className="text-[11px] font-medium text-center">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Title shown in the compact mobile header per tab. */
export function tabLabel(tab: Tab): string {
  const all = [...PRIMARY, ...SECONDARY];
  return all.find((t) => t.id === tab)?.label ?? "Admin";
}
