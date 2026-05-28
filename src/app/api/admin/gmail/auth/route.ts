import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildAuthUrl, getOAuthEnv } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/gmail/auth → 302 redirect to Google's consent screen. */
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const env = getOAuthEnv();
  if (!env) {
    return NextResponse.json(
      {
        error:
          "Gmail OAuth not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in your env, then add the redirect URI " +
          "(this endpoint's host + /api/admin/gmail/callback) in Google Cloud Console → OAuth client → Authorized redirect URIs.",
      },
      { status: 503 }
    );
  }
  // Lightweight CSRF state — we just want a random opaque value back.
  const state = Math.random().toString(36).slice(2);
  const authUrl = buildAuthUrl(state);
  if (!authUrl) {
    return NextResponse.json({ error: "Could not build auth URL" }, { status: 500 });
  }
  return NextResponse.redirect(authUrl);
}
