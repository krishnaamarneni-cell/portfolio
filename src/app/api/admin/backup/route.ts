import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { exportAllData } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/admin/backup — returns a JSON dump of every admin table. The
 *  Content-Disposition header makes the browser save it as a file. */
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const bundle = await exportAllData();
  const filename = `krishna-admin-backup-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.json`;
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
