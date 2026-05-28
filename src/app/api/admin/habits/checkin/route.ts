import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { today, toggleCheckin } from "@/lib/habits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    habit_id?: string;
    date?: string;
  };
  if (!body.habit_id) {
    return NextResponse.json({ error: "habit_id required" }, { status: 400 });
  }
  try {
    const checkin = await toggleCheckin(body.habit_id, body.date || today());
    return NextResponse.json({ checkin });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Check-in failed" },
      { status: 500 }
    );
  }
}
