export const SAP_BASE = "https://sandbox.api.sap.com/s4hanacloud";

export type ToolOutcome<T> = {
  rows: T[];
  /** Set only when every candidate call failed at the HTTP level — a real
   *  API error, distinct from a genuinely empty (200 OK, zero rows) result. */
  error?: string;
};

export type ProductDescriptionRow = { material: string; description: string };

/**
 * fetchAllProductDescriptions — Product Description search (OData V2, API_PRODUCT_SRV)
 *
 * Endpoint: /sap/opu/odata/sap/API_PRODUCT_SRV/A_ProductDescription
 * VERIFIED LIVE 2026-08-10:
 *   - Entity fields: Product (key), Language (key), ProductDescription — all confirmed
 *     against the live sandbox $metadata.
 *   - There are only 2,711 English-language (Language eq 'EN') description rows
 *     total, and they all come back in a single request (no server-side paging
 *     kicks in below that count) — small enough to cache in memory and reuse
 *     for both the chat's name-resolution step and the material browser.
 *
 * Shared module-level cache: both /api/sap/chat and /api/sap/materials import
 * this so they hit SAP once per TTL window instead of duplicating the fetch.
 */
let descriptionCache: { rows: ProductDescriptionRow[]; fetchedAt: number } | null = null;
const DESCRIPTION_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function fetchAllProductDescriptions(
  apiKey: string,
): Promise<ToolOutcome<ProductDescriptionRow>> {
  if (descriptionCache && Date.now() - descriptionCache.fetchedAt < DESCRIPTION_CACHE_TTL_MS) {
    return { rows: descriptionCache.rows };
  }

  const params = new URLSearchParams({
    $filter: "Language eq 'EN'",
    $select: "Product,ProductDescription",
    $format: "json",
    $top: "5000",
  });
  const url = `${SAP_BASE}/sap/opu/odata/sap/API_PRODUCT_SRV/A_ProductDescription?${params}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { APIKey: apiKey, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network error";
    console.error("[SAP ProductDescription] Fetch failed:", msg);
    return { rows: [], error: `Network error: ${msg}` };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[SAP ProductDescription] HTTP ${res.status}:`, body.slice(0, 500));
    return {
      rows: [],
      error: `HTTP ${res.status}${res.status === 403 ? " (blocked by SAP gateway — UCON)" : ""}`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();
  const results: Record<string, unknown>[] = json?.d?.results ?? [];
  const rows: ProductDescriptionRow[] = results.map((r) => ({
    material: String(r.Product ?? "").trim(),
    description: String(r.ProductDescription ?? "").trim(),
  }));

  console.log(`[SAP ProductDescription] Cached ${rows.length} EN descriptions`);
  descriptionCache = { rows, fetchedAt: Date.now() };
  return { rows };
}

/**
 * fetchMaterialsWithStock — which materials actually have live stock records.
 *
 * VERIFIED LIVE 2026-08-10: of the 2,711 materials in the Product master
 * (fetchAllProductDescriptions above), only 863 have ANY row in
 * A_MatlStkInAcctMod. The other ~68% are master-data-only entries created by
 * API Business Hub users over the years — real records, but querying their
 * stock returns nothing. Random-sampled 15 materials from the full catalog
 * and only 4 had stock data, confirming this isn't a fluke.
 *
 * Used to filter the material browser down to materials that will actually
 * produce a real answer when clicked, instead of a coin-flip.
 */
let stockMaterialsCache: { materials: Set<string>; fetchedAt: number } | null = null;
const STOCK_MATERIALS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function fetchMaterialsWithStock(
  apiKey: string,
): Promise<{ materials: Set<string>; error?: string }> {
  if (stockMaterialsCache && Date.now() - stockMaterialsCache.fetchedAt < STOCK_MATERIALS_CACHE_TTL_MS) {
    return { materials: stockMaterialsCache.materials };
  }

  const params = new URLSearchParams({
    $select: "Material",
    $format: "json",
    $top: "5000",
  });
  const url = `${SAP_BASE}/sap/opu/odata/sap/API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod?${params}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { APIKey: apiKey, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network error";
    console.error("[SAP StockMaterials] Fetch failed:", msg);
    return { materials: new Set(), error: `Network error: ${msg}` };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[SAP StockMaterials] HTTP ${res.status}:`, body.slice(0, 500));
    return {
      materials: new Set(),
      error: `HTTP ${res.status}${res.status === 403 ? " (blocked by SAP gateway — UCON)" : ""}`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();
  const results: Record<string, unknown>[] = json?.d?.results ?? [];
  const materials = new Set(
    results
      .map((r) => String(r.Material ?? "").trim())
      .filter((m) => m.length > 0), // sandbox has some rows with a blank Material key
  );

  console.log(`[SAP StockMaterials] Cached ${materials.size} materials with stock (of ${results.length} rows)`);
  stockMaterialsCache = { materials, fetchedAt: Date.now() };
  return { materials };
}
