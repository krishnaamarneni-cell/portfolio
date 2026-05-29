import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteCredential } from "@/lib/webauthn";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  await deleteCredential(id);
  return NextResponse.json({ ok: true });
}
