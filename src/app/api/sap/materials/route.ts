import { NextResponse } from "next/server";
import { fetchAllProductDescriptions, fetchMaterialsWithStock } from "@/lib/sap-product-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/sap/materials — material catalog for the "Browse materials" panel.
 * Deterministic, no LLM involved.
 *
 * VERIFIED LIVE 2026-08-10: of the 2,711 materials in the Product master,
 * only 863 have any row in the Stock API — the rest are master-data-only
 * entries (created by API Business Hub users over the years) that return
 * nothing when queried. Listing all 2,711 would make most clicks in the
 * browser a dead end, so this filters to the ~863 that actually have live
 * stock data — every entry shown is guaranteed to produce a real answer.
 */
export async function GET() {
  const sapKey = process.env.SAP_API_KEY;
  if (!sapKey) {
    return NextResponse.json(
      { error: "SAP_API_KEY is not configured. Add it to your environment variables." },
      { status: 503 },
    );
  }

  const [descriptions, stockMaterials] = await Promise.all([
    fetchAllProductDescriptions(sapKey),
    fetchMaterialsWithStock(sapKey),
  ]);

  if (descriptions.error) {
    return NextResponse.json({ error: descriptions.error }, { status: 502 });
  }
  if (stockMaterials.error) {
    return NextResponse.json({ error: stockMaterials.error }, { status: 502 });
  }

  const materials = descriptions.rows.filter((r) => stockMaterials.materials.has(r.material));

  return NextResponse.json({
    materials,
    total: materials.length,
    totalInCatalog: descriptions.rows.length,
  });
}
