import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth";
import { startTotpSetup } from "@/lib/totp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Generate a fresh secret + provisioning URI. Does NOT enable 2FA yet — the
 *  client must call /enable with a valid first code from the authenticator. */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { secret, uri } = await startTotpSetup(session.email);
  // Render the QR code as a data URI so the UI can show it inline.
  const qrDataUrl = await QRCode.toDataURL(uri, {
    margin: 1,
    width: 240,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return NextResponse.json({ secret, uri, qrDataUrl });
}
