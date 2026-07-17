import { NextResponse, type NextRequest } from "next/server";

/**
 * Never cache the admin HTML shell. The client bundles are content-hashed and
 * safe to cache, but a cached HTML document can reference stale chunks — which
 * is why the admin sometimes shows an old UI after a deploy. Forcing no-store
 * on /admin means each load fetches a fresh shell (and thus the latest chunks).
 */
export function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
