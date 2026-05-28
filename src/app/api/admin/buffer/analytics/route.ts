import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchConnector } from "@/lib/content";
import {
  aggregateMetrics,
  getChannels,
  getSentPostsForChannel,
  type BufferSentPost,
} from "@/lib/buffer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/buffer/analytics?channelId=<id>&first=20
 *
 * - With ?channelId — returns recent sent posts + their metrics for that channel.
 * - Without channelId — fans out across every connected channel and returns
 *   a per-channel summary (post count + aggregate metrics) the dashboard can
 *   tile, plus the raw post list.
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

  const url = new URL(request.url);
  const channelId = url.searchParams.get("channelId");
  const firstParam = url.searchParams.get("first");
  const first = firstParam ? Math.max(1, Math.min(50, parseInt(firstParam, 10) || 20)) : 20;

  try {
    if (channelId) {
      const result = await getSentPostsForChannel(
        connector.bearer_token,
        channelId,
        first
      );
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 502 });
      }
      return NextResponse.json({
        channelId,
        posts: result.posts,
        summary: aggregateMetrics(result.posts),
      });
    }

    // No specific channel — pull each connected channel in parallel.
    const channels = (await getChannels(connector.bearer_token)).filter(
      (c) => !c.isDisconnected
    );
    const perChannel = await Promise.all(
      channels.map(async (c) => {
        const r = await getSentPostsForChannel(
          connector.bearer_token as string,
          c.id,
          first
        );
        return {
          channel: {
            id: c.id,
            name: c.displayName || c.name,
            service: c.service,
            avatar: c.avatar,
          },
          posts: r.posts,
          summary: aggregateMetrics(r.posts),
          error: r.error,
        };
      })
    );
    const allPosts: BufferSentPost[] = perChannel.flatMap((p) => p.posts);
    return NextResponse.json({
      channels: perChannel,
      totals: aggregateMetrics(allPosts),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Buffer request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
