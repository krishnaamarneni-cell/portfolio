import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  listCompanies,
  upsertCompanyFromDomain,
  updateCompany,
  deleteCompany,
  autoLinkContacts,
} from "@/lib/companies";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const companies = await listCompanies();
    return NextResponse.json({ companies });
  } catch (e) {
    return NextResponse.json({ companies: [], error: String(e) });
  }
}

export async function POST(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (body.action === "auto-link") {
    const result = await autoLinkContacts();
    return NextResponse.json(result);
  }

  if (body.action === "create") {
    const company = await upsertCompanyFromDomain(
      body.domain as string,
      body.name as string | undefined
    );
    return NextResponse.json({ company });
  }

  if (body.action === "update" && typeof body.id === "string") {
    const { action: _, id: __, ...patch } = body;
    const company = await updateCompany(body.id, patch);
    return NextResponse.json({ company });
  }

  if (body.action === "delete" && typeof body.id === "string") {
    await deleteCompany(body.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
