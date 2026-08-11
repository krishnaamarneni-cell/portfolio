import { NextResponse } from "next/server";
import {
  SAP_BASE,
  fetchAllProductDescriptions,
  fetchMaterialsWithStock,
  type ToolOutcome,
  type ProductDescriptionRow,
} from "@/lib/sap-product-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ════════════════════ Types ════════════════════ */

type StockRow = {
  material: string;
  plant: string;
  storageLocation: string;
  batch: string;
  stockType: string;
  quantity: number;
  unit: string;
};

type PORow = {
  poNumber: string;
  item: string;
  material: string;
  description: string;
  orderQuantity: number;
  unit: string;
  plant: string;
  netPrice: number;
  currency: string;
  deliveryDate: string;
};

type SalesOrderRow = {
  salesOrder: string;
  item: string;
  material: string;
  description: string;
  requestedQuantity: number;
  unit: string;
  plant: string;
  netAmount: number;
  currency: string;
  /** SAP SD process status: A = open, B = partially processed, C = complete. */
  processStatus: string;
};

type BomRow = {
  itemNumber: string;
  component: string;
  componentDescription: string;
  quantity: number;
  unit: string;
  plant: string;
};

/** Header + line items for ONE purchase order, for the PO drill-down. */
type PoDetail = {
  poNumber: string;
  poType: string;
  supplier: string;
  orderDate: string;
  currency: string;
  purchasingOrg: string;
  purchasingGroup: string;
  companyCode: string;
  items: PORow[];
};

type SapSummary = {
  totalOnHand: number;
  totalInbound: number;
  totalOutbound: number;
  /** onHand + inbound − outbound. Committed supply vs committed demand — NOT
   *  a forecast; the sandbox exposes no planning/forecast data. */
  projectedBalance: number;
  unit: string;
  status: "Healthy" | "Low" | "Critical";
  /** Plain-English reason, so the badge is never an unexplained verdict. */
  statusReason: string;
};

type ToolResults = {
  stock?: ToolOutcome<StockRow>;
  pos?: ToolOutcome<PORow>;
  salesOrders?: ToolOutcome<SalesOrderRow>;
  bom?: ToolOutcome<BomRow>;
  poDetail?: { detail?: PoDetail; error?: string };
};

/* ════════════════════ SAP API Tools ════════════════════ */

// Bare ERP category nouns — never valid as a specific product-name search.
// Someone asking "list of materials" or "how many items do we have" is asking
// a meta-question with no matching tool, not naming a product.
const GENERIC_TERM_BLOCKLIST = new Set([
  "material",
  "materials",
  "product",
  "products",
  "item",
  "items",
  "stock",
  "inventory",
  "goods",
  "everything",
  "all",
]);

// Appended to every "couldn't identify a material" decline so users asking
// meta-questions ("how many materials do we have") get pointed at the one
// place that actually answers that — the Browse materials panel — instead
// of just being told no.
const BROWSE_HINT =
  "Click \"Browse materials\" above to browse them.";

/* ════════════════════ Catalog-level (meta) queries ════════════════════
 *
 * Questions ABOUT the dataset rather than about one material — "how many
 * materials are there", "how many open POs", "list a few materials". The
 * per-material tools can't serve these, but the answers are cheap and exact,
 * so they're handled by dedicated deterministic functions.
 *
 * Every figure below comes from a real SAP call ($count or the cached
 * fetches) and is formatted in code — no LLM ever produces these numbers.
 */

type MetaQueryKind = "materialCount" | "poCount" | "listMaterials";

/** "How many materials do we have" — master data vs. actually-queryable. */
async function answerMaterialCount(apiKey: string): Promise<string | undefined> {
  const [descriptions, stockMaterials] = await Promise.all([
    fetchAllProductDescriptions(apiKey),
    fetchMaterialsWithStock(apiKey),
  ]);
  if (descriptions.error || stockMaterials.error) return undefined;

  const withStock = descriptions.rows.filter((r) => stockMaterials.materials.has(r.material)).length;
  const total = descriptions.rows.length;

  return `The sandbox has ${total.toLocaleString()} materials in its master data, and ${withStock.toLocaleString()} of those have live stock records you can actually query. (The rest are master-data-only entries with no stock or purchase-order transactions posted against them.) ${BROWSE_HINT}`;
}

/**
 * "How many open POs do we have" — sandbox-wide.
 *
 * VERIFIED LIVE 2026-08-10 via $count: 61,640 open (not completely delivered)
 * line items out of 1,071,059 total, across 207,662 PO documents. Uses $count
 * rather than fetching rows, so it stays a single cheap request.
 */
async function fetchOpenPoCount(apiKey: string): Promise<number | undefined> {
  const params = new URLSearchParams({ $filter: "IsCompletelyDelivered eq false" });
  const url = `${SAP_BASE}/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrderItem/$count?${params}`;
  try {
    const res = await fetch(url, {
      headers: { APIKey: apiKey, Accept: "text/plain" },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[SAP PO count] HTTP ${res.status}`);
      return undefined;
    }
    const text = (await res.text()).trim();
    const n = parseInt(text, 10);
    return Number.isFinite(n) ? n : undefined;
  } catch (err) {
    console.error("[SAP PO count] Fetch failed:", err instanceof Error ? err.message : err);
    return undefined;
  }
}

async function answerPoCount(apiKey: string): Promise<string | undefined> {
  const open = await fetchOpenPoCount(apiKey);
  if (open === undefined) return undefined;
  return `There are ${open.toLocaleString()} open purchase order line items across the whole sandbox — these are items not yet completely delivered. Bear in mind this is SAP's shared public sandbox, so that figure covers every user's accumulated demo data, not one company's. Ask about a specific material (e.g. "open POs for TG10") to see the actual orders.`;
}

/** "List me any 5 materials" — a real sample, drawn from ones that have data. */
async function answerListMaterials(
  apiKey: string,
  limit: number,
): Promise<string | undefined> {
  const [descriptions, stockMaterials] = await Promise.all([
    fetchAllProductDescriptions(apiKey),
    fetchMaterialsWithStock(apiKey),
  ]);
  if (descriptions.error || stockMaterials.error) return undefined;

  // Only materials with live stock data — listing master-data-only entries
  // would hand the user material numbers that return nothing when queried.
  const withStock = descriptions.rows.filter((r) => stockMaterials.materials.has(r.material));
  if (withStock.length === 0) return undefined;

  const n = Math.min(Math.max(limit, 1), 25);
  const sample = withStock.slice(0, n);
  const list = sample.map((r) => `${r.material} — ${r.description || "(no description)"}`).join("\n");

  return `Here are ${sample.length} materials that have live stock data (out of ${withStock.length.toLocaleString()}):\n\n${list}\n\nAsk about any of them — e.g. "What's the stock for ${sample[0].material}?"`;
}

async function answerMetaQuery(
  kind: MetaQueryKind,
  apiKey: string,
  limit?: number,
): Promise<string | undefined> {
  switch (kind) {
    case "materialCount":
      return answerMaterialCount(apiKey);
    case "poCount":
      return answerPoCount(apiKey);
    case "listMaterials":
      return answerListMaterials(apiKey, limit ?? 5);
    default:
      return undefined;
  }
}

/**
 * Finds a token that looks like a material code — any word containing a digit
 * alongside letters/underscores/hyphens (TG10, CH_C_107, chc107, FG126).
 *
 * CASE-INSENSITIVE deliberately: a case-sensitive version silently missed
 * "chc107" in "HOW MANY OPEN pos we have for chc107", so the message was
 * treated as a sandbox-wide count question instead of a lookup for that
 * material. A bare number ("top 5") needs 2+ chars to match, so counts and
 * limits aren't mistaken for codes.
 */
function extractMaterialCodeCandidate(message: string): string | undefined {
  const match = message.match(/\b[a-z0-9][a-z0-9_-]*\d[a-z0-9_-]*\b/i);
  return match?.[0];
}

/** Infers which tools a message wants, used when a meta-classification is
 *  overridden because the message actually names a material. */
function inferToolsFromMessage(message: string): string[] {
  const m = message.toLowerCase();
  const wantsPo = /\b(po|pos|purchase order|purchase orders|delivery|deliveries|inbound|ordered)\b/.test(m);
  const wantsStock = /\b(stock|inventory|on hand|available|quantity|qty)\b/.test(m);
  if (wantsPo && !wantsStock) return ["getOpenPOs"];
  if (wantsStock && !wantsPo) return ["getStock"];
  return ["getStock", "getOpenPOs"];
}

/**
 * Fast-path detector for the most common catalog-count phrasings, so the
 * obvious cases skip both LLM calls. The router (which tolerates typos and
 * paraphrases far better than a regex — real messages included "materail"
 * and "materails") is the general path; this is just an optimisation, so it
 * stays deliberately conservative.
 */
function detectMetaQueryFast(message: string): MetaQueryKind | undefined {
  const m = message.toLowerCase();
  // A specific material code means they want THAT material, not a catalog stat.
  if (extractMaterialCodeCandidate(message)) return undefined;

  const asksQuantity = /\b(how many|how much|number of|count of|total)\b/.test(m);
  if (!asksQuantity) return undefined;

  if (/\b(po|pos|purchase orders?)\b/.test(m)) return "poCount";
  if (/\b(materials?|products?|items?|skus?)\b/.test(m)) return "materialCount";
  return undefined;
}

/**
 * getStock — Material Stock API (OData V2)
 *
 * Endpoint: /sap/opu/odata/sap/API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod
 * Filter:   Material eq '<material>'
 * Auth:     APIKey header
 *
 * OData V2 field names (from SAP API Business Hub Try-Out tab):
 *   Material              — Material number (key, Edm.String)
 *   Plant                 — Plant code (key, Edm.String)
 *   StorageLocation       — Storage location (key, Edm.String)
 *   Batch                 — Batch number (key, Edm.String)
 *   InventoryStockType    — 01 unrestricted, 02 quality inspection, 03 blocked
 *   MatlWrhsStkQtyInMatlBaseUnit — Stock quantity (Edm.Decimal)
 *   MaterialBaseUnit      — Unit of measure (Edm.String, e.g. "PC", "EA")
 *
 * Batch and InventoryStockType are part of the composite key and MUST be
 * surfaced: CH_C_104 returns two rows at the same plant/storage location that
 * differ only by batch (9999991 vs 0000000189). Without those columns the
 * rows look like duplicated data — the synthesis model actually flagged them
 * as "might be duplicate data", which they are not.
 *
 * The response wraps results in  { d: { results: [...] } }  (V2 JSON format).
 * Material numbers may be zero-padded to 18 characters; we try raw first,
 * then padded, and return the first match.
 */
async function getStock(material: string, apiKey: string): Promise<ToolOutcome<StockRow>> {
  const candidates = [material];
  // SAP stores material numbers zero-padded to 18 chars — try both forms
  const padded = material.padStart(18, "0");
  if (padded !== material) candidates.push(padded);

  const httpErrors: string[] = [];

  for (const mat of candidates) {
    const params = new URLSearchParams({
      $filter: `Material eq '${mat}'`,
      $format: "json",
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
      console.error(`[SAP Stock] Fetch failed for "${mat}":`, msg);
      httpErrors.push(`Network error: ${msg}`);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[SAP Stock] HTTP ${res.status} for "${mat}":`, body);
      httpErrors.push(`HTTP ${res.status}${res.status === 403 ? " (blocked by SAP gateway — UCON)" : ""}`);
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    const results: unknown[] = json?.d?.results ?? [];

    if (results.length > 0) {
      console.log("[SAP Stock] Raw JSON:", JSON.stringify(results, null, 2));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {
        rows: results.map((r: any) => ({
          material: (r.Material ?? "").trim(),
          plant: (r.Plant ?? "").trim(),
          storageLocation: (r.StorageLocation ?? "").trim(),
          batch: (r.Batch ?? "").trim(),
          stockType: (r.InventoryStockType ?? "").trim(),
          quantity: parseFloat(r.MatlWrhsStkQtyInMatlBaseUnit) || 0,
          unit: (r.MaterialBaseUnit ?? "EA").trim(),
        })),
      };
    }
    // 200 OK with zero rows — genuinely no stock for this candidate. Keep trying
    // the other candidate form, but this is NOT an error.
  }

  if (httpErrors.length === candidates.length) {
    // Every single attempt failed at the HTTP level — a real API error, not
    // an empty result. Surface it distinctly so downstream code never claims
    // "no stock" when the truth is "the API call failed."
    const error = `SAP Material Stock API request failed — ${httpErrors[httpErrors.length - 1]}`;
    console.log(`[SAP Stock] All candidates failed for "${material}": ${error}`);
    return { rows: [], error };
  }

  console.log(`[SAP Stock] No results for material "${material}"`);
  return { rows: [] };
}

/**
 * getOpenPOs — Purchase Order API
 *
 * PRIMARY — OData V2 (API_PURCHASEORDER_PROCESS_SRV / A_PurchaseOrderItem):
 *   Endpoint: /sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrderItem
 *   VERIFIED LIVE 2026-08-10: HTTP 200, real data. Material TG10 alone has
 *   425 historical PO line items in the shared public sandbox — filtering
 *   on `IsCompletelyDelivered eq false` narrows that to the 10 that are
 *   genuinely still open (also verified live). Without that filter every
 *   historical order ever placed against the material comes back, which is
 *   not what "open POs" means.
 *
 * FALLBACK — OData V4 (CE_PURCHASEORDER_0001):
 *   Endpoint: /sap/opu/odata4/sap/api_purchaseorder/srvd_a2x/sap/purchaseorder/0001/PurchaseOrderItem
 *   NOTE: verified live against the sandbox on 2026-08-10 — this endpoint
 *   returns "403 Forbidden — blocked by UCON" (SAP's own connectivity
 *   whitelist rejects the request before it reaches application data).
 *   Kept as a fallback only, in case a given sandbox tenant enables it.
 *
 * Field names (from SAP API Business Hub Try-Out tab — same underlying CDS
 * view backs both V2 and V4, so property names match):
 *   PurchaseOrder             — PO document number
 *   PurchaseOrderItem         — Line item number
 *   Material                  — Material number
 *   PurchaseOrderItemText     — Item description
 *   OrderQuantity             — Order quantity (Edm.Decimal)
 *   PurchaseOrderQuantityUnit — Unit of measure
 *   Plant                     — Receiving plant
 *   NetPriceAmount            — Net price (Edm.Decimal)
 *   DocumentCurrency          — Currency code
 *
 * Navigation to schedule lines differs by version — V2 nav property name
 * isn't 100% verified, so $expand is attempted and silently dropped on
 * failure (delivery date then shows "N/A" rather than failing the request).
 *
 * V2 wraps results in { d: { results: [...] } }; V4 returns { value: [...] }.
 */
type PoAttempt = { url: string; version: "v2" | "v4" };

function buildPoAttempts(mat: string): PoAttempt[] {
  const v2Select = [
    "PurchaseOrder",
    "PurchaseOrderItem",
    "Material",
    "PurchaseOrderItemText",
    "OrderQuantity",
    "PurchaseOrderQuantityUnit",
    "Plant",
    "NetPriceAmount",
    "DocumentCurrency",
    "IsCompletelyDelivered",
  ].join(",");
  // "Open" means not yet fully delivered — without this filter TG10 alone
  // returns 425 historical line items (verified live 2026-08-10); only 10
  // of those are actually pending delivery.
  const v2Params = new URLSearchParams({
    $filter: `Material eq '${mat}' and IsCompletelyDelivered eq false`,
    $select: v2Select,
    $format: "json",
  });
  const v2Url = `${SAP_BASE}/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrderItem?${v2Params}`;

  const v4Select = v2Select;
  const v4Expand =
    "_PurchaseOrderScheduleLine($select=ScheduleLineDeliveryDate,ScheduleLineOrderQuantity)";
  const v4Params = new URLSearchParams({
    $filter: `Material eq '${mat}'`,
    $select: v4Select,
    $expand: v4Expand,
  });
  const v4Url = `${SAP_BASE}/sap/opu/odata4/sap/api_purchaseorder/srvd_a2x/sap/purchaseorder/0001/PurchaseOrderItem?${v4Params}`;

  return [
    { url: v2Url, version: "v2" },
    { url: v4Url, version: "v4" },
  ];
}

function parsePoRow(r: Record<string, unknown>): PORow {
  const num = (v: unknown) => parseFloat(String(v ?? "")) || 0;
  const str = (v: unknown) => String(v ?? "").trim();
  const scheduleLine = r._PurchaseOrderScheduleLine as
    | { ScheduleLineDeliveryDate?: string }[]
    | undefined;
  return {
    poNumber: str(r.PurchaseOrder),
    item: str(r.PurchaseOrderItem),
    material: str(r.Material),
    description: str(r.PurchaseOrderItemText),
    orderQuantity: num(r.OrderQuantity),
    unit: str(r.PurchaseOrderQuantityUnit) || "EA",
    plant: str(r.Plant),
    netPrice: num(r.NetPriceAmount),
    currency: str(r.DocumentCurrency) || "USD",
    deliveryDate: scheduleLine?.[0]?.ScheduleLineDeliveryDate || "N/A",
  };
}

async function getOpenPOs(material: string, apiKey: string): Promise<ToolOutcome<PORow>> {
  const candidates = [material];
  const padded = material.padStart(18, "0");
  if (padded !== material) candidates.push(padded);

  const httpErrors: string[] = [];
  let attemptCount = 0;

  for (const mat of candidates) {
    for (const attempt of buildPoAttempts(mat)) {
      attemptCount++;
      let res: Response;
      try {
        res = await fetch(attempt.url, {
          headers: { APIKey: apiKey, Accept: "application/json" },
          cache: "no-store",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "network error";
        console.error(`[SAP POs] Fetch failed (${attempt.version}) for "${mat}":`, msg);
        httpErrors.push(`Network error: ${msg}`);
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[SAP POs] HTTP ${res.status} (${attempt.version}) for "${mat}":`, body.slice(0, 500));
        httpErrors.push(
          `HTTP ${res.status}${res.status === 403 ? " (blocked by SAP gateway — UCON)" : ""} on ${attempt.version.toUpperCase()}`,
        );
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      const results: Record<string, unknown>[] =
        attempt.version === "v2" ? (json?.d?.results ?? []) : (json?.value ?? []);

      if (results.length > 0) {
        console.log(`[SAP POs] Raw JSON (${attempt.version}):`, JSON.stringify(results, null, 2));
        return { rows: results.map(parsePoRow) };
      }
      // 200 OK, zero rows — genuinely no open POs for this candidate/version.
    }
  }

  if (httpErrors.length === attemptCount) {
    const error = `SAP Purchase Order API request failed — ${httpErrors[httpErrors.length - 1]}`;
    console.log(`[SAP POs] All attempts failed for "${material}": ${error}`);
    return { rows: [], error };
  }

  console.log(`[SAP POs] No results for material "${material}"`);
  return { rows: [] };
}

/**
 * getSalesOrders — open sales orders = OUTBOUND demand (OData V2).
 *
 * Endpoint: /sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrderItem
 * VERIFIED LIVE 2026-08-10: HTTP 200 with real data. TG10 has 17 sales order
 * items, 14 of them still open.
 *
 * Field names confirmed against a live response:
 *   SalesOrder, SalesOrderItem, Material, SalesOrderItemText
 *   RequestedQuantity / RequestedQuantityUnit — customer-requested qty
 *   ProductionPlant                           — the plant field (NOT "Plant")
 *   NetAmount / TransactionCurrency
 *   SDProcessStatus — A = open, B = partially processed, C = complete
 *
 * "Open" is SDProcessStatus ne 'C', mirroring how getOpenPOs filters on
 * IsCompletelyDelivered — without it every historical order comes back.
 */
async function getSalesOrders(material: string, apiKey: string): Promise<ToolOutcome<SalesOrderRow>> {
  const candidates = [material];
  const padded = material.padStart(18, "0");
  if (padded !== material) candidates.push(padded);

  const httpErrors: string[] = [];

  for (const mat of candidates) {
    const params = new URLSearchParams({
      $filter: `Material eq '${mat}' and SDProcessStatus ne 'C'`,
      $select: [
        "SalesOrder",
        "SalesOrderItem",
        "Material",
        "SalesOrderItemText",
        "RequestedQuantity",
        "RequestedQuantityUnit",
        "ProductionPlant",
        "NetAmount",
        "TransactionCurrency",
        "SDProcessStatus",
      ].join(","),
      $format: "json",
      $top: "50",
    });
    const url = `${SAP_BASE}/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrderItem?${params}`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { APIKey: apiKey, Accept: "application/json" },
        cache: "no-store",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network error";
      console.error(`[SAP SOs] Fetch failed for "${mat}":`, msg);
      httpErrors.push(`Network error: ${msg}`);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[SAP SOs] HTTP ${res.status} for "${mat}":`, body.slice(0, 400));
      httpErrors.push(`HTTP ${res.status}${res.status === 403 ? " (blocked by SAP gateway — UCON)" : ""}`);
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    const results: Record<string, unknown>[] = json?.d?.results ?? [];

    if (results.length > 0) {
      console.log("[SAP SOs] Raw JSON:", JSON.stringify(results, null, 2));
      const str = (v: unknown) => String(v ?? "").trim();
      const num = (v: unknown) => parseFloat(String(v ?? "")) || 0;
      return {
        rows: results.map((r) => ({
          salesOrder: str(r.SalesOrder),
          item: str(r.SalesOrderItem),
          material: str(r.Material),
          description: str(r.SalesOrderItemText),
          requestedQuantity: num(r.RequestedQuantity),
          unit: str(r.RequestedQuantityUnit) || "EA",
          plant: str(r.ProductionPlant),
          netAmount: num(r.NetAmount),
          currency: str(r.TransactionCurrency) || "USD",
          processStatus: str(r.SDProcessStatus),
        })),
      };
    }
  }

  if (httpErrors.length === candidates.length) {
    const error = `SAP Sales Order API request failed — ${httpErrors[httpErrors.length - 1]}`;
    console.log(`[SAP SOs] All candidates failed for "${material}": ${error}`);
    return { rows: [], error };
  }

  console.log(`[SAP SOs] No open sales orders for material "${material}"`);
  return { rows: [] };
}

/**
 * getBOM — bill of materials: the components needed to make a finished good.
 *
 * Endpoint: /sap/opu/odata/sap/API_BILL_OF_MATERIAL_SRV;v=0002/MaterialBOMItem
 * VERIFIED LIVE 2026-08-10: HTTP 200. SG23 @ plant 1010 returns RM13 and RM14
 * (100 PC each).
 *
 * Field names confirmed against the live $metadata:
 *   BillOfMaterialComponent      — the component material number
 *   ComponentDescription         — component text
 *   BillOfMaterialItemQuantity   — qty of the component per assembly
 *   BillOfMaterialItemUnit, BillOfMaterialItemNumber, Plant
 *
 * A material can have several BOM variants/versions, so the same component
 * can appear more than once with identical values. Exact duplicates are
 * collapsed; genuinely different quantities are kept, since those represent
 * real alternative BOMs rather than noise.
 */
async function getBOM(material: string, apiKey: string): Promise<ToolOutcome<BomRow>> {
  const params = new URLSearchParams({
    $filter: `Material eq '${material}'`,
    $format: "json",
    $top: "100",
  });
  const url = `${SAP_BASE}/sap/opu/odata/sap/API_BILL_OF_MATERIAL_SRV;v=0002/MaterialBOMItem?${params}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { APIKey: apiKey, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network error";
    console.error(`[SAP BOM] Fetch failed for "${material}":`, msg);
    return { rows: [], error: `Network error: ${msg}` };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[SAP BOM] HTTP ${res.status} for "${material}":`, body.slice(0, 400));
    return {
      rows: [],
      error: `HTTP ${res.status}${res.status === 403 ? " (blocked by SAP gateway — UCON)" : ""}`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();
  const results: Record<string, unknown>[] = json?.d?.results ?? [];

  if (results.length === 0) {
    console.log(`[SAP BOM] No BOM for material "${material}"`);
    return { rows: [] };
  }

  console.log("[SAP BOM] Raw JSON:", JSON.stringify(results, null, 2));
  const str = (v: unknown) => String(v ?? "").trim();
  const num = (v: unknown) => parseFloat(String(v ?? "")) || 0;

  const seen = new Set<string>();
  const rows: BomRow[] = [];
  for (const r of results) {
    const row: BomRow = {
      itemNumber: str(r.BillOfMaterialItemNumber),
      component: str(r.BillOfMaterialComponent),
      componentDescription: str(r.ComponentDescription),
      quantity: num(r.BillOfMaterialItemQuantity),
      unit: str(r.BillOfMaterialItemUnit) || "EA",
      plant: str(r.Plant),
    };
    const key = `${row.component}|${row.plant}|${row.quantity}|${row.unit}`;
    if (seen.has(key)) continue; // same component from another BOM variant
    seen.add(key);
    rows.push(row);
  }
  return { rows };
}

/**
 * getPODetail — everything about ONE purchase order (header + all its items).
 *
 * Endpoints (both OData V2, both verified live 2026-08-10):
 *   A_PurchaseOrder     — header: supplier, PO type, date, purchasing org/group
 *   A_PurchaseOrderItem — every line on that PO, delivered or not
 *
 * Unlike getOpenPOs (which filters to undelivered lines for ONE material),
 * this returns the whole document, so a PO drill-down shows the full order
 * rather than just the part that matched a material search.
 */
async function getPODetail(
  poNumber: string,
  apiKey: string,
): Promise<{ detail?: PoDetail; error?: string }> {
  const enc = encodeURIComponent(`PurchaseOrder eq '${poNumber}'`);
  const headerUrl = `${SAP_BASE}/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder?$filter=${enc}&$format=json`;
  const itemsUrl = `${SAP_BASE}/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrderItem?$filter=${enc}&$format=json&$top=100`;

  let headerRes: Response;
  let itemsRes: Response;
  try {
    [headerRes, itemsRes] = await Promise.all([
      fetch(headerUrl, { headers: { APIKey: apiKey, Accept: "application/json" }, cache: "no-store" }),
      fetch(itemsUrl, { headers: { APIKey: apiKey, Accept: "application/json" }, cache: "no-store" }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network error";
    console.error(`[SAP PO detail] Fetch failed for "${poNumber}":`, msg);
    return { error: `Network error: ${msg}` };
  }

  if (!headerRes.ok) {
    console.error(`[SAP PO detail] Header HTTP ${headerRes.status} for "${poNumber}"`);
    return {
      error: `HTTP ${headerRes.status}${headerRes.status === 403 ? " (blocked by SAP gateway — UCON)" : ""}`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headerJson: any = await headerRes.json();
  const headerRows: Record<string, unknown>[] = headerJson?.d?.results ?? [];
  if (headerRows.length === 0) {
    console.log(`[SAP PO detail] No such purchase order "${poNumber}"`);
    return {};
  }

  const h = headerRows[0];
  const str = (v: unknown) => String(v ?? "").trim();

  let items: PORow[] = [];
  if (itemsRes.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemsJson: any = await itemsRes.json();
    const itemRows: Record<string, unknown>[] = itemsJson?.d?.results ?? [];
    items = itemRows.map(parsePoRow);
  } else {
    console.error(`[SAP PO detail] Items HTTP ${itemsRes.status} for "${poNumber}"`);
  }

  const detail: PoDetail = {
    poNumber: str(h.PurchaseOrder),
    poType: str(h.PurchaseOrderType),
    supplier: str(h.Supplier),
    orderDate: parseSapDate(h.PurchaseOrderDate),
    currency: str(h.DocumentCurrency),
    purchasingOrg: str(h.PurchasingOrganization),
    purchasingGroup: str(h.PurchasingGroup),
    companyCode: str(h.CompanyCode),
    items,
  };

  console.log("[SAP PO detail] Raw JSON:", JSON.stringify({ header: h, itemCount: items.length }, null, 2));
  return { detail };
}

/** SAP V2 serialises dates as "/Date(1533168000000)/". */
function parseSapDate(v: unknown): string {
  const m = String(v ?? "").match(/\/Date\((\d+)\)\//);
  if (!m) return "N/A";
  return new Date(Number(m[1])).toISOString().slice(0, 10);
}

/**
 * canonicaliseMaterialCode — maps a user-typed code onto the real SAP one.
 *
 * SAP material numbers are exact strings, but people type them without
 * punctuation or in the wrong case ("chc107" for "CH_C_107"), which would
 * otherwise query a material that doesn't exist and honestly-but-uselessly
 * report no data. Compares on a normalised form (strip non-alphanumerics,
 * uppercase) against the cached catalog and returns SAP's canonical spelling.
 *
 * Returns the input unchanged if the catalog can't be reached or nothing
 * matches — callers then query it as typed rather than silently substituting
 * some other material.
 */
async function canonicaliseMaterialCode(input: string, apiKey: string): Promise<string> {
  const normalise = (s: string) => s.replace(/[^a-z0-9]/gi, "").toUpperCase();
  const target = normalise(input);
  if (!target) return input;

  const catalog = await fetchAllProductDescriptions(apiKey);
  if (catalog.error || catalog.rows.length === 0) return input;

  // Exact match wins outright — never rewrite a code SAP already knows.
  if (catalog.rows.some((r) => r.material === input)) return input;

  const matches = catalog.rows.filter((r) => normalise(r.material) === target);
  // Only rewrite when it's unambiguous; multiple hits means we'd be guessing.
  if (matches.length === 1) {
    console.log(`[SAP Chat] Canonicalised material "${input}" -> "${matches[0].material}"`);
    return matches[0].material;
  }
  return input;
}

/**
 * resolveMaterialByName — case-insensitive search over the cached product
 * description list (see src/lib/sap-product-cache.ts for the SAP API details:
 * `substringof(...)` is case-sensitive on this gateway and `tolower()` is
 * rejected server-side, so matching happens in JS against the cached rows).
 *
 * Used when the router extracts a product NAME instead of a material NUMBER
 * (e.g. "pineapple", "trading goods") — resolves it to real material number(s)
 * before getStock/getOpenPOs can run. Ambiguous matches are surfaced to the
 * user rather than guessed.
 */
async function resolveMaterialByName(
  name: string,
  apiKey: string,
): Promise<ToolOutcome<ProductDescriptionRow>> {
  const all = await fetchAllProductDescriptions(apiKey);
  if (all.error) return all;

  const needle = name.trim().toLowerCase();
  const matches = all.rows
    .filter((r) => r.description.toLowerCase().includes(needle))
    .slice(0, 15); // cap so a broad term doesn't dump hundreds of candidates

  console.log(`[SAP ProductDescription] "${name}" matched ${matches.length} materials`);
  return { rows: matches };
}

/* ════════════════════ Programmatic Summary ════════════════════ */

/**
 * computeSummary — supply vs demand, computed in code (never by the LLM).
 *
 * The status badge is a PROJECTED AVAILABLE BALANCE:
 *     on hand + inbound (open POs) − outbound (open sales orders)
 *
 * This is deliberately NOT called a forecast. The sandbox exposes no planning,
 * MRP or forecast data, so the honest question this can answer is "does
 * committed supply cover committed demand", not "will we run out next month".
 * statusReason spells out the arithmetic so the badge is never an
 * unexplained verdict.
 *
 * The earlier logic ("Low" when onHand < inbound) was meaningless — having
 * more on order than in stock says nothing about whether you're short.
 */
function computeSummary(results: ToolResults): SapSummary | undefined {
  const stock = results.stock?.rows ?? [];
  const pos = results.pos?.rows ?? [];
  const sos = results.salesOrders?.rows ?? [];

  if (stock.length === 0 && pos.length === 0 && sos.length === 0) return undefined;

  // If a queried source failed at the API level and came back with zero
  // rows, that zero is unreliable — it means "we don't know," not "confirmed
  // zero." Suppress the summary cards entirely rather than show a number
  // that could be mistaken for real data; the inline error banner explains why.
  const stockUnreliable = !!results.stock?.error && stock.length === 0;
  const posUnreliable = !!results.pos?.error && pos.length === 0;
  const soUnreliable = !!results.salesOrders?.error && sos.length === 0;
  if (stockUnreliable || posUnreliable || soUnreliable) return undefined;

  const totalOnHand = stock.reduce((sum, r) => sum + r.quantity, 0);
  const totalInbound = pos.reduce((sum, r) => sum + r.orderQuantity, 0);
  const totalOutbound = sos.reduce((sum, r) => sum + r.requestedQuantity, 0);
  const projectedBalance = totalOnHand + totalInbound - totalOutbound;
  const unit = stock[0]?.unit || pos[0]?.unit || sos[0]?.unit || "EA";

  const fmt = (n: number) => `${n.toLocaleString()} ${unit}`;

  let status: SapSummary["status"];
  let statusReason: string;

  // Demand was never queried — say what the number is rather than implying
  // a supply-vs-demand verdict we have no basis for.
  if (results.salesOrders === undefined) {
    if (totalOnHand === 0) {
      status = "Critical";
      statusReason = "No stock on hand.";
    } else {
      status = "Healthy";
      statusReason = `${fmt(totalOnHand)} on hand. Demand not checked — ask "am I short on this?" to compare against open sales orders.`;
    }
    return { totalOnHand, totalInbound, totalOutbound, projectedBalance, unit, status, statusReason };
  }

  if (projectedBalance < 0) {
    status = "Critical";
    statusReason = `Short by ${fmt(Math.abs(projectedBalance))}: ${fmt(totalOnHand)} on hand + ${fmt(totalInbound)} inbound doesn't cover ${fmt(totalOutbound)} of committed demand.`;
  } else if (totalOnHand < totalOutbound) {
    // Covered only once the POs land — genuinely at risk if they slip.
    status = "Low";
    statusReason = `Covered only after inbound arrives: ${fmt(totalOnHand)} on hand is below ${fmt(totalOutbound)} of demand; ${fmt(totalInbound)} on open POs closes the gap.`;
  } else {
    status = "Healthy";
    statusReason = `${fmt(totalOnHand)} on hand covers ${fmt(totalOutbound)} of committed demand, leaving ${fmt(projectedBalance)} projected.`;
  }

  return { totalOnHand, totalInbound, totalOutbound, projectedBalance, unit, status, statusReason };
}

/* ════════════════════ LLM Prompts ════════════════════ */

const ROUTER_PROMPT = `You are a routing engine for an SAP data assistant. Given a user question, determine which tool(s) to call and identify the material being asked about.

Available tools:
- getStock: Material stock levels by plant / storage location. Use for inventory, stock, quantity on hand, availability.
- getOpenPOs: Open purchase orders = INBOUND supply. Use for purchase orders, pending orders, incoming material, expected deliveries.
- getSalesOrders: Open sales orders = OUTBOUND demand. Use for sales orders, customer orders, demand, outbound, what's committed to customers, what's going out.
- getBOM: Bill of materials — the components/raw materials needed to make one unit of a finished good. Use for BOM, bill of materials, components, ingredients, raw materials, "what goes into X", "what do I need to make X".
- getPODetail: Full detail of ONE purchase order document (supplier, date, all its line items). Use ONLY when the user names a purchase order NUMBER — SAP PO numbers are 10 digits starting with 45 (e.g. 4500011058). Put that number in "poNumber". This is a document lookup, not a material lookup, so leave "material" empty.

The material can be identified TWO ways — pick whichever applies:
A) A material NUMBER — a short SAP code, typically alphanumeric with no spaces, e.g. TG10, FG126, MZ-FG-R100, RM101, SG23. Put it in "material".
B) A material NAME or description — SPECIFIC everyday words naming a real product, e.g. "pineapple", "trading goods", "the water pump", "plastic parts". Put it in "materialName". Use this whenever the text is NOT a short code — i.e. it has spaces, or reads like a product description rather than an identifier.
Never fill both "material" and "materialName" for the same request.

CRITICAL — a META-question is about the DATASET, not about one product. These are answered separately, so set "metaQuery" and leave BOTH "material" and "materialName" empty:
- "how many materials do we have" / "list of materials" / "total materials in sap" / "what materials exist" → metaQuery: "materialCount"
- "how many open POs do we have" / "total purchase orders" / "how many POs are there" → metaQuery: "poCount"
- "list me any 5 materials" / "give me the top 5 material numbers" / "show me some materials" / "give me examples" → metaQuery: "listMaterials", and put the requested count in "limit" (default 5 if unstated)
Users often misspell these ("materail", "materails", "meterials") — match on intent, not exact spelling.

OVERRIDING RULE — if ANY material code appears anywhere in the CURRENT message (e.g. TG10, CH_C_107, chc107, FG126, 221), it is NEVER a meta-question. Leave "metaQuery" empty and treat it as a normal lookup for that material, whatever else the wording resembles:
- "How many open POs do we have for CH_C_107" → NOT poCount. It is getOpenPOs for CH_C_107.
- "CH_C_104 any open POs" → NOT listMaterials. It is getOpenPOs for CH_C_104.
Judge ONLY the current message. Earlier turns in the conversation may have been meta-questions; that does NOT make this one a meta-question. Never carry a previous metaQuery forward.
Only put something in "materialName" when the user names an actual, specific product (a real word like "pineapple", "pump", "trading goods" — not a bare category noun like "material", "materials", "product", "item", "stock", "inventory", or "goods" used alone).

Rules:
1. If the question is a META-question per the CRITICAL rule, set "metaQuery" (and "limit" for listMaterials), leave "tools" empty, and stop.
2. Otherwise identify the material per (A) or (B) above.
3. Shortage questions ("am I short", "will I run out", "do I have enough", "coverage") need supply AND demand: call getStock, getOpenPOs AND getSalesOrders.
4. If the question is only about stock/inventory, call only getStock.
5. If the question is only about purchase orders/inbound for a SPECIFIC material, call only getOpenPOs.
6. If the question is only about sales orders/demand/outbound, call only getSalesOrders.
7. If the question is about components/BOM/raw materials/"what's it made of", call getBOM. If they also ask whether they can build it, add getStock so component availability can be discussed.
8. If the user names a 10-digit purchase order number (starts with 45), call getPODetail and set "poNumber" — do not treat that number as a material.
9. "Show me everything for X" / "drill into X" / "full picture for X" → call getStock, getOpenPOs, getSalesOrders AND getBOM.
10. Return ONLY a JSON object — no other text, no markdown fences.

Schema: { "tools": array containing any of "getStock", "getOpenPOs", "getSalesOrders", "getBOM", "getPODetail" (or empty), "material": "<material number or empty string>", "materialName": "<material name/description or empty string>", "poNumber": "<purchase order number or empty string>", "metaQuery": "materialCount" | "poCount" | "listMaterials" | "", "limit": <number, only for listMaterials> }

If you cannot identify a specific material AND it isn't a meta-question: { "tools": [], "material": "", "materialName": "", "metaQuery": "", "error": "I couldn't identify a specific material in your question. Please include a specific material number (like TG10) or a product name (like \\"trading goods\\"). ${BROWSE_HINT}" }`;

const SYNTHESIS_PROMPT = `You are an SAP data analyst. Answer the user's question using ONLY the data below.

STRICT RULES — follow these exactly:
1. Answer ONLY using the data provided below. Do not infer, estimate, or recall any numbers.
2. Every figure in your answer MUST appear verbatim in the provided data.
3. An EMPTY array with no "error" field is a REAL ANSWER, not missing data — SAP responded successfully and the count is genuinely zero. Say so plainly and specifically: "There are no open purchase orders for CH_C_104" or "CH_C_104 has no stock on hand." Do NOT say "that data isn't available" for an empty array — that wrongly implies the lookup failed when it actually succeeded and returned zero.
3b. Only say "That data isn't available in the sandbox" when the answer genuinely isn't in the data at all — e.g. the user asked for a field the API doesn't return (blocked stock, batch numbers). NEVER guess a value.
4. Be concise and professional. Use plain English, not SAP jargon.
5. When mentioning quantities, always include the unit and location (plant/storage location).
6. If both stock and PO data are present, compare them and give a clear assessment.
7. Do NOT repeat the raw JSON. The data tables are shown separately in the UI.
8. Keep your response to 2-4 sentences maximum.
9. If a tool's data includes an "error" field, that means the live SAP API call itself failed (network issue, permission block, etc.) — this is DIFFERENT from "no records found." You MUST say the API request failed and the result could not be confirmed. NEVER say "there are no purchase orders" or "there is no stock" when an error field is present — that would misrepresent an API failure as a real business answer.
10. If "resolvedMaterial" is present in the data, the user searched by product name/description rather than material number — briefly mention which material number and description it resolved to (e.g. "TG10 (Trad.Good 10,PD,Third Party)") before answering their question.
11. Stock rows are keyed by plant, storage location, BATCH and stock type. Two rows with the same plant and storage location but different batches are SEPARATE real records, NOT duplicates — never describe them as duplicated or double-counted data. Sum them for the total.
12. "pos" is INBOUND supply (open purchase orders); "salesOrders" is OUTBOUND demand (open sales orders). Never mix them up. If a "summary" object is present, its statusReason already states the supply-vs-demand arithmetic — echo that reasoning rather than inventing your own verdict.
13. Any shortage judgement must compare on-hand + inbound against outbound demand. If salesOrders was not queried, say demand wasn't checked — do NOT declare the material healthy or sufficient on stock alone.
14. This data is committed supply and demand, NOT a forecast — the sandbox exposes no planning or forecast data. Never describe any figure as a forecast, projection of future consumption, or prediction.
15. "bom" lists the components needed to make ONE unit of the finished good. Quantities are per assembly. Do not claim a component is in stock unless stock data for that component is actually present in the data. Report small quantities exactly as given (0.001 KG is 0.001 KG, never "0").
16. "poDetail" is one full purchase order document: its header (supplier, order date, purchasing org) plus EVERY line item, including already-delivered ones. Summarise the order — supplier, date, how many items, and which are still outstanding. Note that unlike a material's "open POs" view, this includes delivered lines too.`;

/* ════════════════════ Route Handler ════════════════════ */

type HistoryMsg = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  let body: { message?: string; history?: HistoryMsg[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const sapKey = process.env.SAP_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!sapKey) {
    return NextResponse.json(
      { error: "SAP_API_KEY is not configured. Add it to your environment variables." },
      { status: 503 },
    );
  }

  try {
    /* ── Step 0: META QUERY (fast path) — the obvious "how many …" phrasings
     *  are answerable from cheap $count / cached fetches, so short-circuit
     *  before either LLM call. Runs before the Groq key check because it needs
     *  neither. Anything this conservative detector misses (typos, "list me 5")
     *  still gets caught by the router's metaQuery field below. ── */
    const fastMeta = detectMetaQueryFast(message);
    if (fastMeta) {
      const metaAnswer = await answerMetaQuery(fastMeta, sapKey);
      if (metaAnswer) {
        console.log(`[SAP Chat] Answered meta query (fast: ${fastMeta})`);
        return NextResponse.json({ answer: metaAnswer, data: {} });
      }
      // Fetch failed — fall through to the normal flow rather than guess.
    }

    if (!groqKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured." },
        { status: 503 },
      );
    }

    const { default: Groq } = await import("groq-sdk");
    const groq = new Groq({ apiKey: groqKey });

    /* ── Step 1: ROUTER — decide which tools + extract material (LLM call #1) ── */
    const history = (body.history ?? []).slice(-6);
    const routerCompletion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0,
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ROUTER_PROMPT },
        ...history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: message },
      ],
    });

    const routerRaw = routerCompletion.choices[0]?.message?.content ?? "{}";
    console.log("[SAP Router] Output:", routerRaw);

    let routing: {
      tools?: string[];
      material?: string;
      materialName?: string;
      poNumber?: string;
      metaQuery?: string;
      limit?: number;
      error?: string;
    };
    try {
      routing = JSON.parse(routerRaw);
    } catch {
      routing = {
        tools: [],
        material: "",
        materialName: "",
        error: `I had trouble understanding that. Could you rephrase your question with a specific material number or name? ${BROWSE_HINT}`,
      };
    }

    /* ── Step 1a: META QUERY (router path) — catches the phrasings the fast
     *  detector deliberately doesn't, e.g. "list me any 5 materails". The LLM
     *  only classifies intent; every number in the answer still comes from a
     *  deterministic SAP call. ── */
    let routedMeta = routing.metaQuery?.trim();

    // Guard: if the message names a material, it is NEVER a catalog-level
    // question — applies to EVERY metaQuery kind, not just the counts.
    //   - "how many open POs we have CH_C_107" was answered with the
    //     sandbox-wide poCount, ignoring the material.
    //   - "CH_C_104 any open POs" was answered with the listMaterials sample,
    //     because the previous turn asked for a list and the small router
    //     model carried that classification forward through the history.
    // Both replace the user's actual question with a different one, so the
    // presence of a code overrides the classification outright.
    if (routedMeta) {
      const codeInMessage = extractMaterialCodeCandidate(message);
      if (codeInMessage) {
        console.log(
          `[SAP Chat] Overriding metaQuery "${routedMeta}" — message names material "${codeInMessage}"`,
        );
        routedMeta = "";
        if (!routing.material?.trim()) routing.material = codeInMessage;
        if (!routing.tools?.length) routing.tools = inferToolsFromMessage(message);
      }
    }

    if (
      routedMeta === "materialCount" ||
      routedMeta === "poCount" ||
      routedMeta === "listMaterials"
    ) {
      const metaAnswer = await answerMetaQuery(routedMeta, sapKey, routing.limit);
      if (metaAnswer) {
        console.log(`[SAP Chat] Answered meta query (router: ${routedMeta})`);
        return NextResponse.json({ answer: metaAnswer, data: {} });
      }
      return NextResponse.json({
        answer: `I couldn't reach SAP to answer that just now — please try again. ${BROWSE_HINT}`,
        data: {},
      });
    }

    /* ── Step 1c: PO DOCUMENT DRILL-DOWN — a purchase order number is a
     *  document lookup, not a material lookup, so it short-circuits the
     *  material path entirely. Detected from the message as well as the
     *  router output: a 10-digit 45… number is unambiguous. ── */
    const poFromMessage = message.match(/\b45\d{8}\b/)?.[0];
    const poNumber = routing.poNumber?.trim() || poFromMessage;
    if (poNumber && (routing.tools?.includes("getPODetail") || poFromMessage)) {
      const { detail, error } = await getPODetail(poNumber, sapKey);
      if (error) {
        return NextResponse.json({
          answer: `I couldn't load purchase order ${poNumber} — the SAP request failed: ${error}`,
          data: { poDetailError: error },
        });
      }
      if (!detail) {
        return NextResponse.json({
          answer: `No purchase order ${poNumber} exists in the sandbox.`,
          data: {},
        });
      }
      const synth = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: "system", content: SYNTHESIS_PROMPT },
          {
            role: "user",
            content: `Question: ${message}\n\nRAW DATA FROM SAP APIS:\n${JSON.stringify({ poDetail: detail }, null, 2)}`,
          },
        ],
      });
      const poAnswer =
        synth.choices[0]?.message?.content ?? "Unable to summarise that purchase order.";
      console.log("[SAP Synthesis] PO detail answer:", poAnswer);
      return NextResponse.json({ answer: poAnswer, data: { poDetail: detail } });
    }

    const hasMaterial = !!routing.material?.trim();
    const hasMaterialName = !!routing.materialName?.trim();

    if (!routing.tools?.length || (!hasMaterial && !hasMaterialName)) {
      return NextResponse.json({
        answer:
          routing.error ||
          `Please include a material number or product name in your question — for example, "What's the stock for TG10?" ${BROWSE_HINT}`,
        data: {},
      });
    }

    /* ── Step 1b: NAME RESOLUTION — only runs when the router found a name,
     *  not a number. Deterministic, no LLM: exactly one match resolves and
     *  the normal flow continues; zero or multiple matches short-circuit
     *  with a direct answer, never guessing which material was meant. ── */
    let mat: string;
    let resolvedFrom: { name: string; description: string } | undefined;

    if (hasMaterial) {
      // Canonicalise first — users type "chc107" for "CH_C_107", and querying
      // the typed form would report "no data" for a material that does exist.
      mat = await canonicaliseMaterialCode(routing.material!.trim(), sapKey);
    } else {
      const nameQuery = routing.materialName!.trim();

      // Defense-in-depth against the router misreading a meta-question
      // ("list of materials", "how many materials do we have") as a product
      // name search — a bare category word will coincidentally substring-match
      // some real description (verified live: "materials" alone matched "Oil
      // contaminated operating materials", a false single-match resolution).
      // Caught here deterministically so it can't slip through even if the
      // router LLM misclassifies it.
      if (GENERIC_TERM_BLOCKLIST.has(nameQuery.toLowerCase())) {
        return NextResponse.json({
          answer: `"${nameQuery}" is too generic to search for — there's no chat tool to list every material in SAP. Try a specific product name (e.g. "trading goods") or the exact material number (e.g. TG10). ${BROWSE_HINT}`,
          data: {},
        });
      }

      const resolution = await resolveMaterialByName(nameQuery, sapKey);

      if (resolution.error) {
        return NextResponse.json({
          answer: `I couldn't look up "${nameQuery}" — the SAP Product API request failed: ${resolution.error}`,
          data: {},
        });
      }
      if (resolution.rows.length === 0) {
        return NextResponse.json({
          answer: `I couldn't find any material matching "${nameQuery}" in the sandbox. Try a different word, or use the exact material number if you know it (e.g. TG10).`,
          data: {},
        });
      }
      if (resolution.rows.length > 1) {
        const list = resolution.rows
          .map((r) => `${r.material} — ${r.description}`)
          .join("\n");
        return NextResponse.json({
          answer: `"${nameQuery}" matches ${resolution.rows.length} materials. Which one did you mean?\n\n${list}\n\nAsk again with the material number, e.g. "What's the stock for ${resolution.rows[0].material}?"`,
          data: {},
        });
      }

      mat = resolution.rows[0].material;
      resolvedFrom = { name: nameQuery, description: resolution.rows[0].description };
      console.log(`[SAP Chat] Resolved "${nameQuery}" -> ${mat} (${resolvedFrom.description})`);
    }

    /* ── Step 2: CALL SAP TOOLS (in parallel) ── */
    const results: ToolResults = {};
    const toolPromises: Promise<void>[] = [];

    if (routing.tools.includes("getStock")) {
      toolPromises.push(
        getStock(mat, sapKey).then((outcome) => {
          results.stock = outcome;
        }),
      );
    }
    if (routing.tools.includes("getOpenPOs")) {
      toolPromises.push(
        getOpenPOs(mat, sapKey).then((outcome) => {
          results.pos = outcome;
        }),
      );
    }
    if (routing.tools.includes("getSalesOrders")) {
      toolPromises.push(
        getSalesOrders(mat, sapKey).then((outcome) => {
          results.salesOrders = outcome;
        }),
      );
    }
    if (routing.tools.includes("getBOM")) {
      toolPromises.push(
        getBOM(mat, sapKey).then((outcome) => {
          results.bom = outcome;
        }),
      );
    }

    await Promise.all(toolPromises);

    /* ── Step 3: COMPUTE SUMMARY — programmatic, never LLM ── */
    const summary = computeSummary(results);

    /* ── Step 4: SYNTHESIS — ground answer in raw data (LLM call #2) ── */
    const synthesisData = resolvedFrom
      ? { resolvedMaterial: resolvedFrom, ...results }
      : results;
    const synthCompletion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        { role: "system", content: SYNTHESIS_PROMPT },
        {
          role: "user",
          content: `Question: ${message}\n\nRAW DATA FROM SAP APIS:\n${JSON.stringify(synthesisData, null, 2)}`,
        },
      ],
    });

    const answer =
      synthCompletion.choices[0]?.message?.content ??
      "Unable to generate a response from the data.";
    console.log("[SAP Synthesis] Answer:", answer);

    return NextResponse.json({
      answer,
      data: {
        stock: results.stock?.rows,
        stockError: results.stock?.error,
        pos: results.pos?.rows,
        posError: results.pos?.error,
        salesOrders: results.salesOrders?.rows,
        salesOrdersError: results.salesOrders?.error,
        bom: results.bom?.rows,
        bomError: results.bom?.error,
        summary,
        resolvedFrom,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred";
    console.error("[SAP Chat] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
