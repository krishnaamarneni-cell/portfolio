import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createHabit, habitsWithStreaks } from "@/lib/habits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const habits = await habitsWithStreaks();
    return NextResponse.json({ habits });
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
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    emoji?: string;
    cadence?: "daily" | "weekdays" | "weekly";
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  try {
    const habit = await createHabit({
      name: body.name.trim(),
      emoji: body.emoji,
      cadence: body.cadence,
    });
    return NextResponse.json({ habit });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 500 }
    );
  }
}
