import { NextResponse } from "next/server";
import { fetchPublishedThoughts } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const thoughts = await fetchPublishedThoughts();
    return NextResponse.json({ thoughts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
