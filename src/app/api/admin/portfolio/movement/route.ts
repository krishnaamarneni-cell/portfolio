import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  computePortfolioMovement,
  fetchMoverNews,
  DEFAULT_MOVE_THRESHOLD,
} from "@/lib/portfolio-movement";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/admin/portfolio/movement?threshold=3
 * Live day-movement of the portfolio from the WealthClaude MCP + Yahoo, with a
 * news headline for each holding that moved past the threshold.
 */
export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const t = Number(new URL(request.url).searchParams.get("threshold"));
  const threshold = Number.isFinite(t) && t > 0 ? t : DEFAULT_MOVE_THRESHOLD;

  try {
    const movement = await computePortfolioMovement(threshold);
    const news =
      movement.available && movement.movers.length
        ? await fetchMoverNews(movement.movers).catch(() => [])
        : [];
    return NextResponse.json({ movement, news });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to compute movement" },
      { status: 500 }
    );
  }
}
