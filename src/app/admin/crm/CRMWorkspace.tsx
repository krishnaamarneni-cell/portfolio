"use client";

import { useState } from "react";
import {
  FiUsers,
  FiBriefcase,
  FiMessageSquare,
  FiTarget,
  FiSlash,
  FiCheckCircle,
  FiCornerUpLeft,
} from "react-icons/fi";
import type { CRMTab } from "./types";
import ContactsPanel from "./ContactsPanel";
import CompaniesPanel from "./CompaniesPanel";
import ConversationsPanel from "./ConversationsPanel";
import AudienceBuilder from "./AudienceBuilder";
import ExclusionsPanel from "./ExclusionsPanel";
import EnrichmentReview from "./EnrichmentReview";
import ResponsesPanel from "./ResponsesPanel";

const TABS: Array<{ id: CRMTab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "contacts", label: "Contacts", icon: FiUsers },
  { id: "companies", label: "Companies", icon: FiBriefcase },
  { id: "conversations", label: "Conversations", icon: FiMessageSquare },
  { id: "responses", label: "Responses", icon: FiCornerUpLeft },
  { id: "audience", label: "Audience", icon: FiTarget },
  { id: "exclusions", label: "Exclusions", icon: FiSlash },
  { id: "enrichment", label: "Enrichment", icon: FiCheckCircle },
];

export default function CRMWorkspace({
  onSuccess,
  onError,
}: {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [tab, setTab] = useState<CRMTab>("contacts");

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                active
                  ? "bg-[#ff6b00] text-white shadow-md"
                  : "bg-[var(--admin-surface)] border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] hover:border-[#ff6b00]/30"
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      {tab === "contacts" ? (
        <ContactsPanel onSuccess={onSuccess} onError={onError} />
      ) : tab === "companies" ? (
        <CompaniesPanel onSuccess={onSuccess} onError={onError} />
      ) : tab === "conversations" ? (
        <ConversationsPanel onSuccess={onSuccess} onError={onError} />
      ) : tab === "responses" ? (
        <ResponsesPanel onSuccess={onSuccess} onError={onError} />
      ) : tab === "audience" ? (
        <AudienceBuilder onSuccess={onSuccess} onError={onError} />
      ) : tab === "exclusions" ? (
        <ExclusionsPanel onSuccess={onSuccess} onError={onError} />
      ) : (
        <EnrichmentReview onSuccess={onSuccess} onError={onError} />
      )}
    </div>
  );
}
