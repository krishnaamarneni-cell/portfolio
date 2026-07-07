import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchConnector } from "@/lib/content";
import { getAccount, bufferGraphQL, type BufferChannel } from "@/lib/buffer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeService(raw: string): string {
  const s = raw.toLowerCase();
  if (s.startsWith("linkedin")) return "linkedin";
  if (s.startsWith("instagram")) return "instagram";
  if (s.startsWith("twitter") || s === "x") return "twitter";
  return s;
}

export async function GET() {
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

  const token = connector.bearer_token as string;
  const steps: Record<string, unknown> = {};

  try {
    // Step 1: Get account
    const account = await getAccount(token);
    steps.account = account
      ? { id: account.id, name: account.name, orgId: account.currentOrganization?.id, orgName: account.currentOrganization?.name }
      : null;

    if (!account?.currentOrganization?.id) {
      return NextResponse.json({
        profiles: [],
        _debug: { ...steps, error: "No organization found on Buffer account" },
      });
    }

    // Step 2: Query channels with full error capture
    const orgId = account.currentOrganization.id;
    const channelsResult = await bufferGraphQL<{ channels: BufferChannel[] }>(
      token,
      `query($id: OrganizationId!) {
        channels(input: { organizationId: $id }) {
          id name service serviceId displayName avatar isDisconnected
        }
      }`,
      { id: orgId }
    );

    steps.channelsRaw = {
      hasData: !!channelsResult.data,
      hasErrors: !!(channelsResult.errors?.length),
      errors: channelsResult.errors?.map((e) => e.message),
      channelCount: channelsResult.data?.channels?.length ?? 0,
      channels: channelsResult.data?.channels?.map((c) => ({
        id: c.id,
        service: c.service,
        name: c.name,
        displayName: c.displayName,
        isDisconnected: c.isDisconnected,
      })),
    };

    const channels = channelsResult.data?.channels ?? [];
    const profiles = channels
      .filter((c) => !c.isDisconnected)
      .map((c) => ({
        id: c.id,
        service: normalizeService(c.service),
        formatted_username: c.displayName || c.name,
        formatted_service:
          c.service.charAt(0).toUpperCase() + c.service.slice(1),
        avatar: c.avatar,
      }));

    return NextResponse.json({
      profiles,
      _debug: {
        ...steps,
        totalChannels: channels.length,
        connectedCount: profiles.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, _debug: steps }, { status: 502 });
  }
}
