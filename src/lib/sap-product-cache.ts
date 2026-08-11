export const SAP_BASE = "https://sandbox.api.sap.com/s4hanacloud";

export type ToolOutcome<T> = {
  rows: T[];
  /** Set only when every candidate call failed at the HTTP level — a real
   *  API error, distinct from a genuinely empty (200 OK, zero rows) result. */
  error?: string;
};

export type ProductDescriptionRow = {
  material: string;
  description: string;
  /** SAP material type (MTART): FERT finished good, HALB semi-finished,
   *  ROH raw material, HAWA trading good, SERV service, … Empty if the
   *  Product master lookup failed — never guessed. */
  productType?: string;
};

/** Human-readable labels for the material types that actually matter here.
 *  VERIFIED LIVE 2026-08-10 across all 2,711 sandbox products:
 *  ROH 794, FERT 707, HALB 345, HAWA 307, SERV 306, then a long tail. */
export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  FERT: "Finished good",
  HALB: "Semi-finished",
  ROH: "Raw material",
  HAWA: "Trading good",
  SERV: "Service",
  VERP: "Packaging",
  HIBE: "Operating supply",
  ERSA: "Spare part",
  KMAT: "Configurable",
  UNBW: "Non-valuated",
  NLAG: "Non-stock",
  LEIH: "Returnable packaging",
  PIPE: "Pipeline",
  VEHI: "Vehicle",
};

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
 * Descriptions and material types live in two different entities, so both are
 * fetched and merged here — A_ProductDescription has the text but no type,
 * A_Product has the type but no language-specific text.
 *
 * Shared module-level cache: both /api/sap/chat and /api/sap/materials import
 * this so they hit SAP once per TTL window instead of duplicating the fetch.
 */
let descriptionCache: { rows: ProductDescriptionRow[]; fetchedAt: number } | null = null;
const DESCRIPTION_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/** Product -> material type (FERT/ROH/HALB/…). Best-effort: on failure the
 *  browser just shows no type badge rather than the whole call failing. */
async function fetchProductTypes(apiKey: string): Promise<Map<string, string>> {
  const params = new URLSearchParams({
    $select: "Product,ProductType",
    $format: "json",
    $top: "5000",
  });
  const url = `${SAP_BASE}/sap/opu/odata/sap/API_PRODUCT_SRV/A_Product?${params}`;
  try {
    const res = await fetch(url, {
      headers: { APIKey: apiKey, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[SAP ProductType] HTTP ${res.status} — continuing without types`);
      return new Map();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    const results: Record<string, unknown>[] = json?.d?.results ?? [];
    const map = new Map<string, string>();
    for (const r of results) {
      const p = String(r.Product ?? "").trim();
      const t = String(r.ProductType ?? "").trim();
      if (p && t) map.set(p, t);
    }
    console.log(`[SAP ProductType] Cached types for ${map.size} products`);
    return map;
  } catch (err) {
    console.error("[SAP ProductType] Fetch failed — continuing without types:", err);
    return new Map();
  }
}

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
  let types: Map<string, string>;
  try {
    [res, types] = await Promise.all([
      fetch(url, {
        headers: { APIKey: apiKey, Accept: "application/json" },
        cache: "no-store",
      }),
      fetchProductTypes(apiKey),
    ]);
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
  const rows: ProductDescriptionRow[] = results.map((r) => {
    const material = String(r.Product ?? "").trim();
    return {
      material,
      description: String(r.ProductDescription ?? "").trim(),
      productType: types.get(material) || undefined,
    };
  });

  console.log(`[SAP ProductDescription] Cached ${rows.length} EN descriptions`);
  descriptionCache = { rows, fetchedAt: Date.now() };
  return { rows };
}

/**
 * fetchMaterialsWithBOM — which materials actually have a bill of materials.
 *
 * VERIFIED LIVE 2026-08-10: 799 BOM header rows covering 443 distinct
 * materials. Crucially, material TYPE alone is not a reliable signal — of the
 * 707 products typed FERT (finished good), plenty have no BOM at all
 * (200001001 and 200001002 both return zero components), while FG126 returns
 * 12. So "can I explode this into components" is answered from the BOM data
 * itself, not inferred from the type.
 */
let bomMaterialsCache: { materials: Set<string>; fetchedAt: number } | null = null;
const BOM_MATERIALS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function fetchMaterialsWithBOM(
  apiKey: string,
): Promise<{ materials: Set<string>; error?: string }> {
  if (bomMaterialsCache && Date.now() - bomMaterialsCache.fetchedAt < BOM_MATERIALS_CACHE_TTL_MS) {
    return { materials: bomMaterialsCache.materials };
  }

  const params = new URLSearchParams({
    $select: "Material,Plant",
    $format: "json",
    $top: "5000",
  });
  const url = `${SAP_BASE}/sap/opu/odata/sap/API_BILL_OF_MATERIAL_SRV;v=0002/MaterialBOM?${params}`;

  try {
    const res = await fetch(url, {
      headers: { APIKey: apiKey, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[SAP BOMMaterials] HTTP ${res.status}`);
      return {
        materials: new Set(),
        error: `HTTP ${res.status}${res.status === 403 ? " (blocked by SAP gateway — UCON)" : ""}`,
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    const results: Record<string, unknown>[] = json?.d?.results ?? [];
    const materials = new Set(
      results.map((r) => String(r.Material ?? "").trim()).filter((m) => m.length > 0),
    );
    console.log(`[SAP BOMMaterials] Cached ${materials.size} materials with a BOM`);
    bomMaterialsCache = { materials, fetchedAt: Date.now() };
    return { materials };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network error";
    console.error("[SAP BOMMaterials] Fetch failed:", msg);
    return { materials: new Set(), error: `Network error: ${msg}` };
  }
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
