import { NextResponse } from "next/server";
import {
  fetchAllProductDescriptions,
  fetchMaterialsWithStock,
  fetchMaterialsWithBOM,
} from "@/lib/sap-product-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/sap/materials — material catalog for the "Browse materials" panel.
 * Deterministic, no LLM involved.
 *
 * VERIFIED LIVE 2026-08-10 against the sandbox's 2,711 products:
 *   - 864 have live stock records; the rest are master-data-only entries that
 *     return nothing when queried.
 *   - 443 have a bill of materials (799 BOM header rows).
 *   - Material types: ROH 794, FERT 707, HALB 345, HAWA 307, SERV 306, tail.
 *
 * A material is listed if it has stock OR a BOM — those are exactly the ones
 * where clicking through produces real data. Each row carries its material
 * type (so finished goods are distinguishable from raw materials) and a
 * hasBOM flag, which is taken from the BOM data itself rather than inferred
 * from the type: plenty of FERT-typed products have no BOM at all.
 */
export async function GET() {
  const sapKey = process.env.SAP_API_KEY;
  if (!sapKey) {
    return NextResponse.json(
      { error: "SAP_API_KEY is not configured. Add it to your environment variables." },
      { status: 503 },
    );
  }

  const [descriptions, stockMaterials, bomMaterials] = await Promise.all([
    fetchAllProductDescriptions(sapKey),
    fetchMaterialsWithStock(sapKey),
    fetchMaterialsWithBOM(sapKey),
  ]);

  if (descriptions.error) {
    return NextResponse.json({ error: descriptions.error }, { status: 502 });
  }
  if (stockMaterials.error) {
    return NextResponse.json({ error: stockMaterials.error }, { status: 502 });
  }
  // A BOM failure is not fatal — the catalog is still useful without the flag.
  const bomSet = bomMaterials.materials;

  const materials = descriptions.rows
    .filter((r) => stockMaterials.materials.has(r.material) || bomSet.has(r.material))
    .map((r) => ({
      material: r.material,
      description: r.description,
      productType: r.productType ?? "",
      hasStock: stockMaterials.materials.has(r.material),
      hasBOM: bomSet.has(r.material),
    }));

  return NextResponse.json({
    materials,
    total: materials.length,
    totalInCatalog: descriptions.rows.length,
    withBOM: materials.filter((m) => m.hasBOM).length,
  });
}
