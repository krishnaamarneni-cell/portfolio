import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Static index of imported knowledge docs. Lives next to the markdown so
 *  the browser can flip through them without an extra round-trip. */
const INDEX = [
  { slug: "h1b-reference", title: "H-1B and STEM OPT reference", category: "visa" },
  { slug: "fed-policy", title: "US Fed policy primer", category: "macro" },
  { slug: "trade-wars", title: "Trade-war framework", category: "macro" },
  { slug: "portfolio-theory", title: "Portfolio theory", category: "finance" },
  { slug: "stock-fundamentals", title: "Stock fundamentals", category: "finance" },
  { slug: "options-basics", title: "Options basics", category: "finance" },
  { slug: "margin-of-safety", title: "Margin of safety (Graham/Buffett)", category: "finance" },
  { slug: "moat-concept", title: "Economic moat", category: "finance" },
  { slug: "pe-ratio", title: "P/E ratio", category: "finance" },
  { slug: "us-housing-market", title: "US housing market", category: "real_estate" },
  { slug: "sap-market", title: "SAP consulting market", category: "career" },
  { slug: "ai-replacing-consultants", title: "AI replacing consultants", category: "career" },
];

export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ docs: INDEX });
  }
  const safe = slug.replace(/[^a-z0-9-]/gi, "");
  if (!INDEX.some((d) => d.slug === safe)) {
    return NextResponse.json({ error: "Unknown slug" }, { status: 404 });
  }
  const filePath = path.join(process.cwd(), "public", "knowledge", `${safe}.md`);
  try {
    const body = await fs.readFile(filePath, "utf8");
    const meta = INDEX.find((d) => d.slug === safe);
    return NextResponse.json({ ...meta, body });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
