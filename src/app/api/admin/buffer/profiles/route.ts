import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchConnector } from "@/lib/content";
import { bufferGraphQL, type BufferChannel } from "@/lib/buffer";

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
    // Step 1: Introspect Account type to find the right organization field
    const introResult = await bufferGraphQL<{
      __type?: { fields?: Array<{ name: string }> };
    }>(
      token,
      `{ __type(name: "Account") { fields { name } } }`
    );
    const accountFields = (introResult.data?.__type?.fields ?? []).map(
      (f) => f.name
    );
    steps.accountFields = accountFields;

    // Step 2: Build account query with the org field that actually exists
    const orgFieldCandidates = [
      "currentOrganization",
      "organization",
      "organizations",
    ];
    const orgField = orgFieldCandidates.find((f) => accountFields.includes(f));
    steps.orgField = orgField ?? "none found";

    // Also check if there's a top-level organizations query
    const rootIntro = await bufferGraphQL<{
      __schema?: { queryType?: { fields?: Array<{ name: string }> } };
    }>(
      token,
      `{ __schema { queryType { fields { name } } } }`
    );
    const rootQueries = (rootIntro.data?.__schema?.queryType?.fields ?? []).map(
      (f) => f.name
    );
    steps.rootQueries = rootQueries.filter((q) =>
      /org|channel|profile|account/i.test(q)
    );

    // Step 3: Fetch account with whichever org field exists
    let orgId: string | null = null;
    const orgSub =
      orgField === "organizations"
        ? `${orgField} { id name }`
        : orgField
          ? `${orgField} { id name }`
          : "";
    const accountQuery = `{ account { id name email ${orgSub} } }`;
    const accountResult = await bufferGraphQL<{
      account?: Record<string, unknown>;
    }>(token, accountQuery);
    steps.account = accountResult.data?.account ?? null;
    steps.accountErrors = accountResult.errors?.map((e) => e.message);

    if (accountResult.data?.account && orgField) {
      const orgData = accountResult.data.account[orgField];
      if (Array.isArray(orgData) && orgData.length > 0) {
        orgId = orgData[0].id;
      } else if (orgData && typeof orgData === "object") {
        orgId = (orgData as { id?: string }).id ?? null;
      }
    }
    steps.orgId = orgId;

    // Step 4: Try fetching channels — with org ID if we have one,
    // or try without if a direct channels query exists
    let channels: BufferChannel[] = [];

    if (orgId) {
      const channelsResult = await bufferGraphQL<{
        channels: BufferChannel[];
      }>(
        token,
        `query($id: OrganizationId!) {
          channels(input: { organizationId: $id }) {
            id name service serviceId displayName avatar isDisconnected
          }
        }`,
        { id: orgId }
      );
      steps.channelsResult = {
        errors: channelsResult.errors?.map((e) => e.message),
        count: channelsResult.data?.channels?.length ?? 0,
      };
      channels = channelsResult.data?.channels ?? [];
    }

    // Fallback: try querying channels without org ID
    if (channels.length === 0 && rootQueries.includes("channels")) {
      const fallback = await bufferGraphQL<{
        channels: BufferChannel[];
      }>(
        token,
        `{ channels { id name service serviceId displayName avatar isDisconnected } }`
      );
      steps.channelsFallback = {
        errors: fallback.errors?.map((e) => e.message),
        count: fallback.data?.channels?.length ?? 0,
      };
      channels = fallback.data?.channels ?? [];
    }

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
      _debug: { ...steps, profileCount: profiles.length },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message, _debug: steps },
      { status: 502 }
    );
  }
}
