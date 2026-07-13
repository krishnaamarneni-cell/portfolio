import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "public-assets";
const FOLDER = "social";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(FOLDER, { limit: 100, sortBy: { column: "created_at", order: "desc" } });

    if (error) {
      return NextResponse.json({ images: [], error: error.message });
    }

    const images = (data ?? [])
      .filter((f) => f.name && !f.name.startsWith("."))
      .map((f) => {
        const { data: urlData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(`${FOLDER}/${f.name}`);
        return {
          name: f.name,
          url: urlData.publicUrl,
          created_at: f.created_at,
        };
      });

    return NextResponse.json({ images });
  } catch (err) {
    return NextResponse.json({
      images: [],
      error: err instanceof Error ? err.message : "Failed to list images",
    });
  }
}
