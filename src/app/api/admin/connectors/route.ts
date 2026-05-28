import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchConnectors, upsertConnector } from "@/lib/content";
import type { ConnectorInput } from "@/lib/content-types";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const connectors = await fetchConnectors();
    return NextResponse.json({ connectors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Partial<ConnectorInput>;
  try {
    body = (await request.json()) as Partial<ConnectorInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id || !body.base_url) {
    return NextResponse.json(
      { error: "id and base_url are required" },
      { status: 400 }
    );
  }
  const input: ConnectorInput = {
    id: body.id,
    label: body.label ?? body.id,
    base_url: body.base_url,
    bearer_token: body.bearer_token ?? null,
    enabled: body.enabled ?? true,
  };
  try {
    const connector = await upsertConnector(input);
    return NextResponse.json({ connector });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
