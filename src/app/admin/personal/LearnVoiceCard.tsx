"use client";

/**
 * Trigger for the learn-voice agent.
 *
 * The route has existed for a while with nothing calling it, so voice_prompt was
 * never generated and every auto-reply went out in the model's default register.
 * This card is the missing button — and it sits next to the auto-reply toggle
 * deliberately, because that is the pairing that matters: replies go out
 * unreviewed, so the voice should be learned before the switch is flipped.
 */

import { useEffect, useState } from "react";
import { FiFeather, FiRefreshCw, FiCheck, FiChevronDown, FiChevronUp } from "react-icons/fi";

type VoiceState = {
  voicePrompt: string | null;
  updatedAt: string | null;
};

export default function LearnVoiceCard({
  onSuccess,
  onError,
}: {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [state, setState] = useState<VoiceState | null>(null);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/admin/agents/learn-voice", { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        setState(
          r.ok
            ? { voicePrompt: j.voicePrompt ?? null, updatedAt: j.updatedAt ?? null }
            : { voicePrompt: null, updatedAt: null }
        );
      } catch {
        if (!cancelled) setState({ voicePrompt: null, updatedAt: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function learn() {
    setRunning(true);
    try {
      const r = await fetch("/api/admin/agents/learn-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 180 }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        // The route's 404s are actionable ("only found 2 replies"), so surface
        // the message rather than a generic failure.
        onError(j.error || "Could not learn your voice");
      } else {
        setState({ voicePrompt: j.voicePrompt ?? null, updatedAt: new Date().toISOString() });
        onSuccess(`Voice learned from ${j.emailsAnalyzed} of your sent replies`);
        setExpanded(true);
      }
    } catch {
      onError("Network error");
    }
    setRunning(false);
  }

  if (state === null) return null;
  const learned = Boolean(state.voicePrompt);

  return (
    <div
      className={`rounded-2xl border p-5 ${
        learned
          ? "border-[var(--admin-border)] bg-[var(--admin-surface)]"
          : "border-amber-500/30 bg-amber-500/[0.04]"
      }`}
    >
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-[#ff6b00]/15 text-[#ff6b00] flex items-center justify-center shrink-0">
          <FiFeather size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-[var(--admin-text)]">Your writing voice</h3>
            <span
              className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md uppercase border ${
                learned
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}
            >
              {learned ? "Learned" : "Not learned"}
            </span>
          </div>

          <p className="text-[11px] text-[var(--admin-text-muted)] mt-1">
            {learned ? (
              <>
                Reads your last 6 months of sent recruiter replies and extracts how you actually write — tone, length,
                openings, what you never say. Auto-reply and the CRM drafts use it.
                {state.updatedAt && (
                  <>
                    {" "}
                    Last learned {new Date(state.updatedAt).toLocaleDateString()}.
                  </>
                )}
              </>
            ) : (
              <>
                Nothing learned yet, so replies go out in a generic assistant tone rather than yours. This reads your
                own sent replies from the last 6 months and extracts your style. Worth running{" "}
                <strong className="text-[var(--admin-text)]">before</strong> turning auto-reply on, since those send
                without review.
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={learn}
          disabled={running}
          className="shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold bg-[#ff6b00] text-white hover:bg-[#ff8534] transition-colors disabled:opacity-60"
        >
          {running ? (
            <>
              <FiRefreshCw size={13} className="animate-spin" />
              Reading your replies…
            </>
          ) : (
            <>
              {learned ? <FiRefreshCw size={13} /> : <FiCheck size={13} />}
              {learned ? "Re-learn" : "Learn my voice"}
            </>
          )}
        </button>
      </div>

      {running && (
        <p className="mt-3 text-[11px] text-[var(--admin-text-muted)]">
          Scanning up to 40 threads and analysing up to 50 of your replies. This can take a minute or two — leave the
          tab open.
        </p>
      )}

      {learned && state.voicePrompt && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] transition-colors"
          >
            {expanded ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
            {expanded ? "Hide" : "Show"} what it learned
          </button>
          {expanded && (
            <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--admin-text)] bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl p-3 max-h-72 overflow-y-auto">
              {state.voicePrompt}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
