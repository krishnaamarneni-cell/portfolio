import { NextResponse } from "next/server";
import { fetchAllProductDescriptions } from "@/lib/sap-product-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/sap/materials — full material catalog for the "Browse materials"
 * panel. Deterministic, no LLM involved: this just proxies the cached
 * SAP Product Description list (see src/lib/sap-product-cache.ts).
 *
 * Returns the FULL list (2,711 English-language rows, verified live) in one
 * response rather than server-side paging — small enough that the client
 * does instant search/pagination in memory instead of round-tripping SAP on
 * every keystroke.
 */
export async function GET() {
  const sapKey = process.env.SAP_API_KEY;
  if (!sapKey) {
    return NextResponse.json(
      { error: "SAP_API_KEY is not configured. Add it to your environment variables." },
      { status: 503 },
    );
  }

  const result = await fetchAllProductDescriptions(sapKey);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ materials: result.rows, total: result.rows.length });
}
