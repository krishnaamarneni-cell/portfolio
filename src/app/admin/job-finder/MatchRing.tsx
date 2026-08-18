"use client";

import { scoreTone } from "./types";

/**
 * Match score as a ring.
 *
 * A number alone reads as a label; an arc reads as a proportion, which is what
 * a score is. Colour comes from the same scoreTone used by the chips, so a
 * strong match looks identical everywhere it appears.
 */
export default function MatchRing({
  score,
  size = 44,
  stroke = 4,
}: {
  score: number | null;
  size?: number;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score));
  const tone = scoreTone(score);

  // Tailwind classes can't reach an SVG stroke, so the palette is mirrored here.
  const color =
    score === null
      ? "var(--admin-border)"
      : pct >= 85
        ? "#10b981"
        : pct >= 70
          ? "#0ea5e9"
          : pct >= 50
            ? "#f59e0b"
            : "#f43f5e";

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      title={score === null ? "Not scored yet" : `${pct}% — ${tone.label}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--admin-border)"
          strokeWidth={stroke}
        />
        {score !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (pct / 100) * circumference}
            style={{ transition: "stroke-dashoffset 500ms ease" }}
          />
        )}
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-bold tabular-nums text-[var(--admin-text)]"
        style={{ fontSize: size * 0.28 }}
      >
        {score === null ? "–" : pct}
      </span>
    </div>
  );
}
