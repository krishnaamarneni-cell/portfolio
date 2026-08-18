"use client";

/**
 * US states as a tile grid rather than a geographic map.
 *
 * A real outline needs fifty path definitions and renders Rhode Island as a
 * speck you cannot read or click. The tile layout keeps states in roughly the
 * right relative position while giving each one equal area, which is the honest
 * shape for "how many jobs are here" — geographic area is not the variable
 * being encoded, and drawing it that way over-weights empty western states.
 */

/** [row, col] on a 8×12 grid, in approximate geographic arrangement. */
const GRID: Record<string, [number, number]> = {
  AK: [0, 0], ME: [0, 11],
  VT: [1, 10], NH: [1, 11],
  WA: [1, 1], ID: [1, 2], MT: [1, 3], ND: [1, 4], MN: [1, 5], IL: [1, 6], WI: [1, 7], MI: [1, 8], NY: [1, 9], MA: [1, 10],
  OR: [2, 1], NV: [2, 2], WY: [2, 3], SD: [2, 4], IA: [2, 5], IN: [2, 6], OH: [2, 7], PA: [2, 8], NJ: [2, 9], CT: [2, 10], RI: [2, 11],
  CA: [3, 1], UT: [3, 2], CO: [3, 3], NE: [3, 4], MO: [3, 5], KY: [3, 6], WV: [3, 7], VA: [3, 8], MD: [3, 9], DE: [3, 10],
  AZ: [4, 2], NM: [4, 3], KS: [4, 4], AR: [4, 5], TN: [4, 6], NC: [4, 7], SC: [4, 8], DC: [4, 9],
  OK: [5, 4], LA: [5, 5], MS: [5, 6], AL: [5, 7], GA: [5, 8],
  HI: [6, 0], TX: [6, 4], FL: [6, 9],
};

export default function UsaTileMap({
  states,
  onSelect,
  selected,
}: {
  states: Array<{ code: string; name: string; count: number }>;
  onSelect?: (code: string) => void;
  selected?: string | null;
}) {
  const byCode = new Map(states.map((s) => [s.code, s]));
  const max = Math.max(1, ...states.map((s) => s.count));

  const CELL = 40;
  const GAP = 4;
  const rows = 7;
  const cols = 12;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${cols * (CELL + GAP)} ${rows * (CELL + GAP)}`}
        className="w-full"
        style={{ minWidth: 520 }}
        role="img"
        aria-label="US states by open roles"
      >
        {Object.entries(GRID).map(([code, [r, c]]) => {
          const s = byCode.get(code);
          const count = s?.count ?? 0;
          // Square-root scaling: linear made a single dominant state wash out
          // every other one that genuinely has openings.
          const intensity = count === 0 ? 0 : Math.sqrt(count / max);
          const isSelected = selected === code;
          return (
            <g
              key={code}
              transform={`translate(${c * (CELL + GAP)}, ${r * (CELL + GAP)})`}
              onClick={() => count > 0 && onSelect?.(code)}
              style={{ cursor: count > 0 ? "pointer" : "default" }}
            >
              <title>{`${s?.name ?? code}: ${count} open role${count === 1 ? "" : "s"}`}</title>
              <rect
                width={CELL}
                height={CELL}
                rx={6}
                fill={count === 0 ? "var(--admin-bg)" : "#ff6b00"}
                fillOpacity={count === 0 ? 1 : 0.15 + intensity * 0.85}
                stroke={isSelected ? "#ff6b00" : "var(--admin-border)"}
                strokeWidth={isSelected ? 2 : 1}
              />
              <text
                x={CELL / 2}
                y={CELL / 2 - 2}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill={intensity > 0.55 ? "#fff" : "var(--admin-text)"}
              >
                {code}
              </text>
              {count > 0 && (
                <text
                  x={CELL / 2}
                  y={CELL / 2 + 11}
                  textAnchor="middle"
                  fontSize={9}
                  fill={intensity > 0.55 ? "#fff" : "var(--admin-text-muted)"}
                >
                  {count}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
