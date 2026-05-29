import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasAnyCredential, listCredentials } from "@/lib/webauthn";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET → admin's enrolled passkeys. Used by Settings UI. */
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const credentials = await listCredentials();
  return NextResponse.json({ credentials, hasAny: credentials.length > 0 });
}

/** Public head-check: does Face Lock exist? The login page calls this to
 *  decide whether to show the "Sign in with Face ID" button. */
export async function HEAD() {
  const ok = await hasAnyCredential();
  return new NextResponse(null, { status: ok ? 200 : 404 });
}
