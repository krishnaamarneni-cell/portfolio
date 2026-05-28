import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchConnector } from "@/lib/content";
import {
  aggregateMetrics,
  getAllSentPosts,
  getChannels,
} from "@/lib/buffer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/buffer/analytics?channelId=<id>&first=20
 *
 * - With ?channelId — returns recent sent posts + their metrics for that channel.
 * - Without channelId — fans out across every connected channel and returns
 *   a per-channel summary the dashboard can tile, plus the raw post list.
 *
 * Buffer's PostsInput only filters by organizationId, so we fetch the org's
 * full sent-post list once and partition client-side rather than N round-trips.
 */
export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const connector = await fetchConnector("buffer");
  if (!connector || !connector.bearer_token) {
    return NextResponse.json(
      {
        error:
          "Buffer connector not set up. Go to Connectors → Add Buffer → paste your access token.",
      },
      { status: 503 }
    );
  }
  const token = connector.bearer_token;

  const url = new URL(request.url);
  const channelId = url.searchParams.get("channelId");
  const firstParam = url.searchParams.get("first");
  const first = firstParam
    ? Math.max(1, Math.min(100, parseInt(firstParam, 10) || 20))
    : 20;

  try {
    const all = await getAllSentPosts(token);
    if ("error" in all) {
      return NextResponse.json({ error: all.error }, { status: 502 });
    }

    if (channelId) {
      const posts = all.posts
        .filter((p) => p.channel?.id === channelId)
        .slice(0, first);
      return NextResponse.json({
        channelId,
        posts,
        summary: aggregateMetrics(posts),
      });
    }

    // Per-channel buckets. Group by channel id we got back, then map onto the
    // full channel list so empty channels still render.
    const channels = (await getChannels(token)).filter((c) => !c.isDisconnected);
    const perChannel = channels.map((c) => {
      const posts = all.posts
        .filter((p) => p.channel?.id === c.id)
        .slice(0, first);
      return {
        channel: {
          id: c.id,
          name: c.displayName || c.name,
          service: c.service,
          avatar: c.avatar,
        },
        posts,
        summary: aggregateMetrics(posts),
      };
    });
    return NextResponse.json({
      channels: perChannel,
      totals: aggregateMetrics(all.posts.slice(0, first * channels.length)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Buffer request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
