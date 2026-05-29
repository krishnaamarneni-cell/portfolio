import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

/**
 * Simple per-IP rate limiter backed by a Supabase table.
 *
 * Window: rolling N seconds. If `count` exceeds `max` inside the current
 * window, returns { allowed: false, retryAfter }. The window resets when its
 * `window_start` is older than `windowSeconds`.
 *
 * Why DB-backed instead of in-memory: serverless functions cold-start, so an
 * in-memory map drops state between invocations and brute-force attempts
 * would slip through.
 */

export async function checkRateLimit(opts: {
  ip: string;
  max: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  const supabase = requireSupabaseAdmin();
  const now = new Date();
  const ip = opts.ip || "unknown";

  // Read current row. If none, treat as fresh window.
  const { data } = await supabase
    .from("login_attempts")
    .select("count, window_start")
    .eq("ip", ip)
    .maybeSingle();

  const windowStart = data?.window_start ? new Date(data.window_start) : null;
  const windowEnd = windowStart
    ? new Date(windowStart.getTime() + opts.windowSeconds * 1000)
    : null;
  const stillInWindow = windowEnd && windowEnd.getTime() > now.getTime();
  const currentCount = stillInWindow ? data?.count ?? 0 : 0;
  const nextCount = currentCount + 1;
  const newWindowStart = stillInWindow ? windowStart!.toISOString() : now.toISOString();

  await supabase.from("login_attempts").upsert({
    ip,
    count: nextCount,
    window_start: newWindowStart,
    last_attempt: now.toISOString(),
  });

  if (nextCount > opts.max) {
    const retryAfter = windowEnd
      ? Math.max(1, Math.ceil((windowEnd.getTime() - now.getTime()) / 1000))
      : opts.windowSeconds;
    return { allowed: false, remaining: 0, retryAfter };
  }
  return { allowed: true, remaining: opts.max - nextCount, retryAfter: 0 };
}

/** Pull the client IP from request headers — Vercel forwards X-Forwarded-For. */
export function clientIpFromRequest(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
