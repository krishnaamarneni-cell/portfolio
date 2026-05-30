import { NextResponse } from "next/server";
import { exchangeCodeForTokens, saveTokens } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/gmail/callback?code=…  Google redirects back here.
 *
 *  NOTE: We intentionally skip getSession() here. Google's redirect is a
 *  cross-origin GET that may not carry the admin session cookie (SameSite,
 *  Secure flags). The OAuth code exchange itself is the auth gate — a
 *  valid code can only come from our client_id + redirect_uri. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  const adminUrl = new URL("/admin?tab=connectors", url);

  if (err) {
    adminUrl.searchParams.set("gmail_error", err);
    return NextResponse.redirect(adminUrl);
  }
  if (!code) {
    adminUrl.searchParams.set("gmail_error", "missing code");
    return NextResponse.redirect(adminUrl);
  }

  const tokens = await exchangeCodeForTokens(code);
  if (tokens.error || !tokens.access_token) {
    adminUrl.searchParams.set("gmail_error", tokens.error || "token exchange failed");
    return NextResponse.redirect(adminUrl);
  }

  // Pull profile email so the UI can show "connected as you@gmail.com".
  let email: string | undefined;
  try {
    const meR = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: "no-store",
    });
    if (meR.ok) {
      const me = (await meR.json()) as { email?: string };
      email = me.email;
    }
  } catch {}

  await saveTokens({
    email,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
    scope: tokens.scope,
  });

  adminUrl.searchParams.set("gmail", "connected");
  if (email) adminUrl.searchParams.set("gmail_email", email);
  return NextResponse.redirect(adminUrl);
}
