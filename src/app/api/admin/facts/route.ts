import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listFacts, upsertFact, type FactInput } from "@/lib/facts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const facts = await listFacts();
    return NextResponse.json({ facts });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: FactInput;
  try {
    body = (await request.json()) as FactInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.key?.trim() || !body.value?.trim()) {
    return NextResponse.json({ error: "key and value required" }, { status: 400 });
  }
  try {
    const fact = await upsertFact(body);
    return NextResponse.json({ fact });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 500 }
    );
  }
}
