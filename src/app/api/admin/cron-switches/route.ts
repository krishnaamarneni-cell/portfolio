import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listCronSwitches, setCronSwitch } from "@/lib/cron-switches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await listCronSwitches());
}

export async function PUT(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    key?: string;
    enabled?: boolean;
  };
  if (!body.key || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "key and enabled are required" }, { status: 400 });
  }

  const error = await setCronSwitch(body.key, body.enabled);
  if (error) {
    return NextResponse.json(
      {
        error: /does not exist|schema cache|relation/i.test(error)
          ? "Run supabase/cron_switches.sql in Supabase first."
          : error,
      },
      { status: 500 },
    );
  }
  // Returned so the card redraws from stored state rather than from what it
  // hoped the write did.
  return NextResponse.json(await listCronSwitches());
}
