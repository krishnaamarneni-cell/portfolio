import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  listContacts,
  upsertContact,
  deleteContact,
  toggleStar,
  markEmailed,
  updateContactType,
  updateContactFields,
  listContactsFiltered,
  type ContactType,
} from "@/lib/contacts";
import { classifyAddress } from "@/lib/unsendable";

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
  if (
    body.action === "set_type" &&
    typeof body.id === "string" &&
    typeof body.contact_type === "string"
  ) {
    const validTypes = [
      "recruiter", "hiring_manager", "visa", "personal",
      "colleague", "business", "vendor", "unknown",
    ];
    if (!validTypes.includes(body.contact_type as string)) {
      return NextResponse.json({ error: "invalid contact_type" }, { status: 400 });
    }
    await updateContactType(body.id, body.contact_type as ContactType);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update_fields" && typeof body.id === "string") {
    const contact = await updateContactFields(body.id, body.patch as Record<string, unknown>);
    return NextResponse.json({ contact });
  }

  if (body.action === "filtered") {
    const contacts = await listContactsFiltered(body.filters as Record<string, unknown>);
    return NextResponse.json({ contacts });
  }

  if (body.action === "delete-junk") {
    const { requireSupabaseAdmin } = await import("@/lib/supabase");
    const db = requireSupabaseAdmin();
    const { data } = await db
      .from("recruiter_contacts")
      .select("id, email, name")
      .limit(5000);

    const junk = (data ?? []).filter(
      (c: { id: string; email: string; name: string | null }) =>
        classifyAddress(c.email).unsendable
    );

    if (junk.length === 0) {
      return NextResponse.json({ deleted: 0, samples: [] });
    }

    await db
      .from("recruiter_contacts")
      .delete()
      .in("id", junk.map((j: { id: string }) => j.id));

    return NextResponse.json({
      deleted: junk.length,
      samples: junk.slice(0, 20).map((j: { email: string }) => j.email),
    });
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
