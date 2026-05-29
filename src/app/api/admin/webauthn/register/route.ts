import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { startRegistration, finishRegistration } from "@/lib/webauthn";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET → generate registration options (challenge). */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const options = await startRegistration(session.email);
    return NextResponse.json({ options });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start" },
      { status: 500 }
    );
  }
}

/** POST → verify the attestation the browser produced. */
export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    response?: RegistrationResponseJSON;
    label?: string;
  };
  if (!body.response) {
    return NextResponse.json({ error: "response required" }, { status: 400 });
  }
  const result = await finishRegistration(body.response, body.label);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
