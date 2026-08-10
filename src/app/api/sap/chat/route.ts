import { NextResponse } from "next/server";

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
  stock?: StockRow[];
  pos?: PORow[];
};

/* ════════════════════ SAP API Tools ════════════════════ */

const SAP_BASE = "https://sandbox.api.sap.com/s4hanacloud";

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
async function getStock(material: string, apiKey: string): Promise<StockRow[]> {
  const candidates = [material];
  // SAP stores material numbers zero-padded to 18 chars — try both forms
  const padded = material.padStart(18, "0");
  if (padded !== material) candidates.push(padded);

  for (const mat of candidates) {
    const params = new URLSearchParams({
      $filter: `Material eq '${mat}'`,
      $format: "json",
    });
    const url = `${SAP_BASE}/sap/opu/odata/sap/API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod?${params}`;

    const res = await fetch(url, {
      headers: { APIKey: apiKey, Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[SAP Stock] HTTP ${res.status} for "${mat}":`, body);
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    const results: unknown[] = json?.d?.results ?? [];

    if (results.length > 0) {
      console.log("[SAP Stock] Raw JSON:", JSON.stringify(results, null, 2));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return results.map((r: any) => ({
        material: (r.Material ?? "").trim(),
        plant: (r.Plant ?? "").trim(),
        storageLocation: (r.StorageLocation ?? "").trim(),
        quantity: parseFloat(r.MatlWrhsStkQtyInMatlBaseUnit) || 0,
        unit: (r.MaterialBaseUnit ?? "EA").trim(),
      }));
    }
  }

  console.log(`[SAP Stock] No results for material "${material}"`);
  return [];
}

/**
 * getOpenPOs — Purchase Order API (OData V4, CE_PURCHASEORDER_0001)
 *
 * Endpoint: /sap/opu/odata4/sap/api_purchaseorder/srvd_a2x/sap/purchaseorder/0001/PurchaseOrderItem
 * Filter:   Material eq '<material>'
 * Auth:     APIKey header
 *
 * OData V4 field names (from SAP API Business Hub Try-Out tab):
 *   PurchaseOrder            — PO document number
 *   PurchaseOrderItem        — Line item number
 *   Material                 — Material number
 *   PurchaseOrderItemText    — Item description
 *   OrderQuantity            — Order quantity (Edm.Decimal)
 *   PurchaseOrderQuantityUnit— Unit of measure
 *   Plant                    — Receiving plant
 *   NetPriceAmount           — Net price (Edm.Decimal)
 *   DocumentCurrency         — Currency code
 *
 * Navigation property _PurchaseOrderScheduleLine contains:
 *   ScheduleLineDeliveryDate    — Expected delivery date
 *   ScheduleLineOrderQuantity   — Scheduled quantity
 *
 * V4 returns  { value: [...] }.
 */
async function getOpenPOs(material: string, apiKey: string): Promise<PORow[]> {
  const candidates = [material];
  const padded = material.padStart(18, "0");
  if (padded !== material) candidates.push(padded);

  for (const mat of candidates) {
    const select = [
      "PurchaseOrder",
      "PurchaseOrderItem",
      "Material",
      "PurchaseOrderItemText",
      "OrderQuantity",
      "PurchaseOrderQuantityUnit",
      "Plant",
      "NetPriceAmount",
      "DocumentCurrency",
    ].join(",");
    const expand =
      "_PurchaseOrderScheduleLine($select=ScheduleLineDeliveryDate,ScheduleLineOrderQuantity)";

    const params = new URLSearchParams({
      $filter: `Material eq '${mat}'`,
      $select: select,
      $expand: expand,
    });
    const url = `${SAP_BASE}/sap/opu/odata4/sap/api_purchaseorder/srvd_a2x/sap/purchaseorder/0001/PurchaseOrderItem?${params}`;

    const res = await fetch(url, {
      headers: { APIKey: apiKey, Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[SAP POs] HTTP ${res.status} for "${mat}":`, body);
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    const results: unknown[] = json?.value ?? [];

    if (results.length > 0) {
      console.log("[SAP POs] Raw JSON:", JSON.stringify(results, null, 2));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return results.map((r: any) => ({
        poNumber: (r.PurchaseOrder ?? "").trim(),
        item: (r.PurchaseOrderItem ?? "").trim(),
        material: (r.Material ?? "").trim(),
        description: (r.PurchaseOrderItemText ?? "").trim(),
        orderQuantity: parseFloat(r.OrderQuantity) || 0,
        unit: (r.PurchaseOrderQuantityUnit ?? "EA").trim(),
        plant: (r.Plant ?? "").trim(),
        netPrice: parseFloat(r.NetPriceAmount) || 0,
        currency: (r.DocumentCurrency ?? "USD").trim(),
        deliveryDate:
          r._PurchaseOrderScheduleLine?.[0]?.ScheduleLineDeliveryDate || "N/A",
      }));
    }
  }

  console.log(`[SAP POs] No results for material "${material}"`);
  return [];
}

/* ════════════════════ Programmatic Summary ════════════════════ */

function computeSummary(results: ToolResults): SapSummary | undefined {
  const stock = results.stock ?? [];
  const pos = results.pos ?? [];

  if (stock.length === 0 && pos.length === 0) return undefined;

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

const ROUTER_PROMPT = `You are a routing engine for an SAP data assistant. Given a user question, determine which tool(s) to call and extract the material number.

Available tools:
- getStock: Query material stock levels by plant and storage location. Use when the question is about inventory, stock, quantity on hand, or material availability.
- getOpenPOs: Query open purchase orders. Use when the question is about purchase orders, pending orders, inbound materials, or expected deliveries.

Rules:
1. Extract the material number from the question. SAP material numbers are alphanumeric (examples: TG10, FG126, MZ-FG-R100, RM101, SG23).
2. If the question asks about shortage, shortfall, "am I short", or compares stock vs orders, call BOTH tools.
3. If the question is only about stock/inventory, call only getStock.
4. If the question is only about purchase orders/deliveries, call only getOpenPOs.
5. Return ONLY a JSON object — no other text, no markdown fences.

Schema: { "tools": ["getStock"] | ["getOpenPOs"] | ["getStock", "getOpenPOs"], "material": "<material number>" }

If you cannot determine a material number: { "tools": [], "material": "", "error": "I couldn't identify a material number in your question. Please include a specific SAP material number like TG10 or FG126." }`;

const SYNTHESIS_PROMPT = `You are an SAP data analyst. Answer the user's question using ONLY the data below.

STRICT RULES — follow these exactly:
1. Answer ONLY using the data provided below. Do not infer, estimate, or recall any numbers.
2. Every figure in your answer MUST appear verbatim in the provided data.
3. If a value is missing or the data arrays are empty, say "That data isn't available in the sandbox" — NEVER guess.
4. Be concise and professional. Use plain English, not SAP jargon.
5. When mentioning quantities, always include the unit and location (plant/storage location).
6. If both stock and PO data are present, compare them and give a clear assessment.
7. Do NOT repeat the raw JSON. The data tables are shown separately in the UI.
8. Keep your response to 2-4 sentences maximum.`;

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

    let routing: { tools?: string[]; material?: string; error?: string };
    try {
      routing = JSON.parse(routerRaw);
    } catch {
      routing = {
        tools: [],
        material: "",
        error: "I had trouble understanding that. Could you rephrase your question with a specific material number?",
      };
    }

    if (!routing.tools?.length || !routing.material?.trim()) {
      return NextResponse.json({
        answer:
          routing.error ||
          "Please include a material number in your question — for example, 'What's the stock for TG10?'",
        data: {},
      });
    }

    /* ── Step 2: CALL SAP TOOLS (in parallel) ── */
    const mat = routing.material.trim();
    const results: ToolResults = {};
    const toolPromises: Promise<void>[] = [];

    if (routing.tools.includes("getStock")) {
      toolPromises.push(
        getStock(mat, sapKey).then((rows) => {
          results.stock = rows;
        }),
      );
    }
    if (routing.tools.includes("getOpenPOs")) {
      toolPromises.push(
        getOpenPOs(mat, sapKey).then((rows) => {
          results.pos = rows;
        }),
      );
    }

    await Promise.all(toolPromises);

    /* ── Step 3: COMPUTE SUMMARY — programmatic, never LLM ── */
    const summary = computeSummary(results);

    /* ── Step 4: SYNTHESIS — ground answer in raw data (LLM call #2) ── */
    const synthCompletion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        { role: "system", content: SYNTHESIS_PROMPT },
        {
          role: "user",
          content: `Question: ${message}\n\nRAW DATA FROM SAP APIS:\n${JSON.stringify(results, null, 2)}`,
        },
      ],
    });

    const answer =
      synthCompletion.choices[0]?.message?.content ??
      "Unable to generate a response from the data.";
    console.log("[SAP Synthesis] Answer:", answer);

    return NextResponse.json({
      answer,
      data: { stock: results.stock, pos: results.pos, summary },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred";
    console.error("[SAP Chat] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
