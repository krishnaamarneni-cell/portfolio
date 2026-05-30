import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  listContacts,
  upsertContact,
  deleteContact,
  toggleStar,
  markEmailed,
} from "@/lib/contacts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET — list all recruiter contacts. */
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const contacts = await listContacts();
  return NextResponse.json({ contacts });
}

/** POST — upsert a contact, or toggle star, or mark emailed, or delete. */
export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  // Action dispatch.
  if (body.action === "delete" && typeof body.id === "string") {
    await deleteContact(body.id);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "star" && typeof body.id === "string") {
    await toggleStar(body.id, !!body.starred);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "emailed" && typeof body.id === "string") {
    await markEmailed(body.id);
    return NextResponse.json({ ok: true });
  }

  // Default: upsert.
  if (typeof body.email !== "string" || !body.email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }
  const contact = await upsertContact({
    name: (body.name as string) ?? "",
    email: body.email as string,
    company: (body.company as string) ?? null,
    role_pitched: (body.role_pitched as string) ?? null,
    match_pct: typeof body.match_pct === "number" ? body.match_pct : null,
    source: (body.source as string) ?? "manual",
    notes: (body.notes as string) ?? null,
  });
  return NextResponse.json({ contact });
}
