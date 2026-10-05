import { requireSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Open-tracking pixel for bulk sends.
 *
 * Deliberately unauthenticated — it is fetched by the recipient's mail client,
 * which has no session. The id is a random UUID generated per send, so it
 * reveals nothing and grants nothing: the only thing a guessed id could do is
 * inflate one row's open count.
 *
 * Path is /api/t/o/<id>.gif rather than something like /api/track/open. Spam
 * filters score obvious tracking paths, and this mail already has a hidden
 * image and an attachment working against it.
 *
 * It always returns the image, even when recording fails. A broken pixel shows
 * up in the recipient's mail as a missing-image placeholder, which is worse
 * than losing one open event.
 */

// 1x1 transparent GIF.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

/** Loads this soon after sending are scanners, not people. */
const PREFETCH_WINDOW_MS = 10_000;

function pixelResponse(): Response {
  return new Response(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      // Gmail and others cache proxied images; without this a second open by
      // the same person would never reach us.
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const sendId = id.replace(/\.(gif|png|jpg)$/i, "");
    if (!/^[0-9a-f-]{36}$/i.test(sendId)) return pixelResponse();

    const db = requireSupabaseAdmin();
    const { data: row } = await db
      .from("bulk_sends")
      .select("sent_at, open_count, prefetch_count, opened_at")
      .eq("id", sendId)
      .maybeSingle();
    if (!row) return pixelResponse();

    const now = new Date();
    const sinceSend = now.getTime() - new Date(row.sent_at).getTime();
    const isPrefetch = sinceSend < PREFETCH_WINDOW_MS;

    await db
      .from("bulk_sends")
      .update(
        isPrefetch
          ? { prefetch_count: (row.prefetch_count ?? 0) + 1 }
          : {
              open_count: (row.open_count ?? 0) + 1,
              // First human-looking load wins; later ones only move the last seen.
              opened_at: row.opened_at ?? now.toISOString(),
              last_opened_at: now.toISOString(),
            },
      )
      .eq("id", sendId);
  } catch {
    // Never let a tracking failure break the image.
  }
  return pixelResponse();
}
