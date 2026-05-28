import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchSiteContent, updateSiteContent } from "@/lib/content";
import type { SiteContent } from "@/lib/site-content-types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const content = await fetchSiteContent();
    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Partial<SiteContent>;
  try {
    body = (await request.json()) as Partial<SiteContent>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const content = await updateSiteContent(body);
    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
