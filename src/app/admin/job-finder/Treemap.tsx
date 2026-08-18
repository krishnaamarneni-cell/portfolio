"use client";

/**
 * Squarified treemap.
 *
 * Area encodes count, which is what makes a treemap readable at a glance: the
 * biggest demand is literally the biggest tile. The squarified algorithm keeps
 * tiles close to square — a naive slice-and-dice produces slivers that are
 * impossible to label or click.
 *
 * Kept local rather than pulled from a charting library: this is ~50 lines, and
 * a dependency would bring a renderer, a theme system and a bundle cost for one
 * view.
 */

type Item = { name: string; count: number };
type Tile = Item & { x: number; y: number; w: number; h: number };

function worstRatio(row: number[], length: number, scale: number): number {
  const sum = row.reduce((a, b) => a + b, 0) * scale;
  const max = Math.max(...row) * scale;
  const min = Math.min(...row) * scale;
  if (sum === 0 || length === 0) return Infinity;
  return Math.max((length * length * max) / (sum * sum), (sum * sum) / (length * length * min));
}

function squarify(items: Item[], width: number, height: number): Tile[] {
  const total = items.reduce((a, b) => a + b.count, 0);
  if (!total) return [];
  const scale = (width * height) / total;

  const tiles: Tile[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let i = 0;

  while (i < items.length) {
    const vertical = w >= h;
    const length = vertical ? h : w;
    const row: number[] = [];
    let j = i;

    // Grow the row while it keeps tiles closer to square.
    while (j < items.length) {
      const next = [...row, items[j].count];
      if (row.length && worstRatio(next, length, scale) > worstRatio(row, length, scale)) break;
      row.push(items[j].count);
      j++;
    }

    const rowSum = row.reduce((a, b) => a + b, 0) * scale;
    const thickness = length ? rowSum / length : 0;
    let offset = 0;

    for (let k = 0; k < row.length; k++) {
      const share = length ? (row[k] * scale) / thickness : 0;
      tiles.push(
        vertical
          ? { ...items[i + k], x, y: y + offset, w: thickness, h: share }
          : { ...items[i + k], x: x + offset, y, w: share, h: thickness }
      );
      offset += share;
    }

    if (vertical) {
      x += thickness;
      w -= thickness;
    } else {
      y += thickness;
      h -= thickness;
    }
    i = j;
  }

  return tiles;
}

export default function Treemap({
  items,
  height = 380,
  unit = "roles",
  onSelect,
}: {
  items: Item[];
  height?: number;
  unit?: string;
  onSelect?: (name: string) => void;
}) {
  const W = 1000;
  const H = height;
  const tiles = squarify(items.filter((i) => i.count > 0), W, H);
  const max = Math.max(1, ...items.map((i) => i.count));

  if (!tiles.length) {
    return (
      <p className="text-xs text-[var(--admin-text-muted)] text-center py-10">
        Nothing to chart yet — scoring populates the skills this reads from.
      </p>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl" role="img" aria-label="Demand treemap">
      {tiles.map((t) => {
        const intensity = Math.sqrt(t.count / max);
        // Only label tiles with room for the text; the rest rely on the tooltip.
        const showLabel = t.w > 70 && t.h > 30;
        const showCount = t.w > 70 && t.h > 46;
        return (
          <g
            key={t.name}
            onClick={() => onSelect?.(t.name)}
            style={{ cursor: onSelect ? "pointer" : "default" }}
          >
            <title>{`${t.name}: ${t.count} ${unit}`}</title>
            <rect
              x={t.x + 1}
              y={t.y + 1}
              width={Math.max(0, t.w - 2)}
              height={Math.max(0, t.h - 2)}
              rx={5}
              fill="#ff6b00"
              fillOpacity={0.15 + intensity * 0.75}
              stroke="var(--admin-surface)"
              strokeWidth={2}
            />
            {showLabel && (
              <text
                x={t.x + 10}
                y={t.y + 21}
                fontSize={13}
                fontWeight={700}
                fill={intensity > 0.5 ? "#fff" : "var(--admin-text)"}
              >
                {t.name.length > Math.floor(t.w / 8) ? `${t.name.slice(0, Math.floor(t.w / 8))}…` : t.name}
              </text>
            )}
            {showCount && (
              <text
                x={t.x + 10}
                y={t.y + 38}
                fontSize={11}
                fill={intensity > 0.5 ? "#ffffffcc" : "var(--admin-text-muted)"}
              >
                {t.count} {unit}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
