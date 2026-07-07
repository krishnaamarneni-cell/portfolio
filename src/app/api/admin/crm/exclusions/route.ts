import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getExclusionsList,
  toggleCompanyExclusion,
  toggleContactExclusion,
} from "@/lib/crm-workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const exclusions = await getExclusionsList();
    return NextResponse.json({ exclusions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load exclusions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.action === "toggle-company" && typeof body.companyId === "string") {
    await toggleCompanyExclusion(body.companyId, body.excluded === true);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "toggle-contact" && typeof body.contactId === "string") {
    await toggleContactExclusion(body.contactId, body.excluded === true);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
