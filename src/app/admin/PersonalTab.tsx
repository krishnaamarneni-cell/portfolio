"use client";

import MemoryAgentCard from "./MemoryAgentCard";
import { CollapsibleSection } from "./personal/shared";
import FactsCard from "./personal/FactsCard";
import HabitsCard from "./personal/HabitsCard";
import ReadingCard from "./personal/ReadingCard";
import RecruiterContactsCard from "./personal/RecruiterContactsCard";
import NotesSection from "./personal/NotesSection";
import MorningBriefingCardImpl from "./personal/MorningBriefingCard";
import SundayReflectionCardImpl from "./personal/SundayReflectionCard";

/* Re-export named cards so existing imports from ConnectorsEditor.tsx
   (and any other consumers) keep working without changes. */
export { default as MorningBriefingCard } from "./personal/MorningBriefingCard";
export { default as SundayReflectionCard } from "./personal/SundayReflectionCard";

export default function PersonalTab({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Life Cockpit</h2>
        <p className="text-xs text-[var(--admin-text-muted)] mt-1">
          Notepad + agent. Save anything personal (visa dates, flight plans,
          moves, birthdays). The agent reads it all and tells you what needs
          attention this week — plus blind spots you didn't list.
        </p>
      </div>

      {/* Memory agent — pinned to top because the user reviews suggestions
          here. Quietly fades to "Clean" badge when there's nothing pending. */}
      <MemoryAgentCard onSuccess={onSuccess} onError={onError} />

      {/* Collapsible sections — Facts, Habits, Reading */}
      <CollapsibleSection title="Facts" count={0} id="facts">
        <FactsCard onError={onError} onSuccess={onSuccess} />
      </CollapsibleSection>

      <CollapsibleSection title="Habits" count={0} id="habits">
        <HabitsCard onError={onError} onSuccess={onSuccess} />
      </CollapsibleSection>

      <CollapsibleSection title="Reading" count={0} id="reading">
        <ReadingCard onError={onError} onSuccess={onSuccess} />
      </CollapsibleSection>

      {/* Quick add, stats, agent digest, notes list */}
      <NotesSection onSuccess={onSuccess} onError={onError} />

      {/* Briefing cards */}
      <MorningBriefingCardImpl onSuccess={onSuccess} onError={onError} />
      <SundayReflectionCardImpl onSuccess={onSuccess} onError={onError} />

      {/* Recruiter contacts */}
      <RecruiterContactsCard onError={onError} onSuccess={onSuccess} />
    </section>
  );
}
