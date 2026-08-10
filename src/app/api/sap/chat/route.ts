import { NextResponse } from "next/server";
import {
  SAP_BASE,
  fetchAllProductDescriptions,
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

type SapSummary = {
  totalOnHand: number;
  totalInbound: number;
  unit: string;
  status: "Healthy" | "Low" | "Critical";
};

type ToolResults = {
  stock?: ToolOutcome<StockRow>;
  pos?: ToolOutcome<PORow>;
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
  "Click \"Browse materials\" above to see which materials actually have live stock data.";

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
 *   MatlWrhsStkQtyInMatlBaseUnit — Stock quantity (Edm.Decimal)
 *   MaterialBaseUnit      — Unit of measure (Edm.String, e.g. "PC", "EA")
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

function computeSummary(results: ToolResults): SapSummary | undefined {
  const stock = results.stock?.rows ?? [];
  const pos = results.pos?.rows ?? [];

  if (stock.length === 0 && pos.length === 0) return undefined;

  // If a queried source failed at the API level and came back with zero
  // rows, that zero is unreliable — it means "we don't know," not "confirmed
  // zero." Suppress the summary cards entirely rather than show a number
  // that could be mistaken for real data; the inline error banner explains why.
  const stockUnreliable = !!results.stock?.error && stock.length === 0;
  const posUnreliable = !!results.pos?.error && pos.length === 0;
  if (stockUnreliable || posUnreliable) return undefined;

  const totalOnHand = stock.reduce((sum, r) => sum + r.quantity, 0);
  const totalInbound = pos.reduce((sum, r) => sum + r.orderQuantity, 0);
  const unit = stock[0]?.unit || pos[0]?.unit || "EA";

  let status: SapSummary["status"];
  if (totalOnHand === 0) status = "Critical";
  else if (pos.length > 0 && totalOnHand < totalInbound) status = "Low";
  else status = "Healthy";

  return { totalOnHand, totalInbound, unit, status };
}

/* ════════════════════ LLM Prompts ════════════════════ */

const ROUTER_PROMPT = `You are a routing engine for an SAP data assistant. Given a user question, determine which tool(s) to call and identify the material being asked about.

Available tools:
- getStock: Query material stock levels by plant and storage location. Use when the question is about inventory, stock, quantity on hand, or material availability.
- getOpenPOs: Query open purchase orders. Use when the question is about purchase orders, pending orders, inbound materials, or expected deliveries.

The material can be identified TWO ways — pick whichever applies:
A) A material NUMBER — a short SAP code, typically alphanumeric with no spaces, e.g. TG10, FG126, MZ-FG-R100, RM101, SG23. Put it in "material".
B) A material NAME or description — SPECIFIC everyday words naming a real product, e.g. "pineapple", "trading goods", "the water pump", "plastic parts". Put it in "materialName". Use this whenever the text is NOT a short code — i.e. it has spaces, or reads like a product description rather than an identifier.
Never fill both "material" and "materialName" for the same request.

CRITICAL — do NOT extract a materialName from a META-question that has no specific product in it:
- "list of materials" / "what materials do we have" / "how many materials exist" / "show me all products" / "list everything in stock" — these are asking for an inventory-wide listing, which no tool supports. Leave BOTH "material" and "materialName" empty and use the error response below.
- Only put something in "materialName" when the user names an actual, specific product (a real word like "pineapple", "pump", "trading goods" — not a bare category noun like "material", "materials", "product", "item", "stock", "inventory", or "goods" used alone).

Rules:
1. Identify the material per (A) or (B) above, respecting the CRITICAL rule.
2. If the question asks about shortage, shortfall, "am I short", or compares stock vs orders, call BOTH tools.
3. If the question is only about stock/inventory, call only getStock.
4. If the question is only about purchase orders/deliveries, call only getOpenPOs.
5. Return ONLY a JSON object — no other text, no markdown fences.

Schema: { "tools": ["getStock"] | ["getOpenPOs"] | ["getStock", "getOpenPOs"], "material": "<material number or empty string>", "materialName": "<material name/description or empty string>" }

If you cannot identify a specific material number OR material name (including meta-questions per the CRITICAL rule above): { "tools": [], "material": "", "materialName": "", "error": "I couldn't identify a specific material in your question — there's no chat tool to list every material in SAP. Please include a specific material number (like TG10) or a product name (like \\"trading goods\\"). ${BROWSE_HINT}" }`;

const SYNTHESIS_PROMPT = `You are an SAP data analyst. Answer the user's question using ONLY the data below.

STRICT RULES — follow these exactly:
1. Answer ONLY using the data provided below. Do not infer, estimate, or recall any numbers.
2. Every figure in your answer MUST appear verbatim in the provided data.
3. If a value is missing or the data arrays are empty, say "That data isn't available in the sandbox" — NEVER guess.
4. Be concise and professional. Use plain English, not SAP jargon.
5. When mentioning quantities, always include the unit and location (plant/storage location).
6. If both stock and PO data are present, compare them and give a clear assessment.
7. Do NOT repeat the raw JSON. The data tables are shown separately in the UI.
8. Keep your response to 2-4 sentences maximum.
9. If a tool's data includes an "error" field, that means the live SAP API call itself failed (network issue, permission block, etc.) — this is DIFFERENT from "no records found." You MUST say the API request failed and the result could not be confirmed. NEVER say "there are no purchase orders" or "there is no stock" when an error field is present — that would misrepresent an API failure as a real business answer.
10. If "resolvedMaterial" is present in the data, the user searched by product name/description rather than material number — briefly mention which material number and description it resolved to (e.g. "TG10 (Trad.Good 10,PD,Third Party)") before answering their question.`;

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
  if (!groqKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured." },
      { status: 503 },
    );
  }

  try {
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

    let routing: { tools?: string[]; material?: string; materialName?: string; error?: string };
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
      mat = routing.material!.trim();
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
