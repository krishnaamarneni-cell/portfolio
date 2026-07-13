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

const MAX_BYTES = 10 * 1024 * 1024;

function extFromContentType(ct: string): string {
  if (ct.includes("png")) return ".png";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("gif")) return ".gif";
  if (ct.includes("svg")) return ".svg";
  return ".jpg";
}

/**
 * POST { url } — fetch a remote/generated image and persist it into the saved
 * library bucket so it shows up in the thumbnail strip.
 */
export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { url?: string };
  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = (body.url ?? "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "A valid image URL is required" }, { status: 400 });
  }

  try {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) {
      return NextResponse.json({ error: `Could not fetch image (${resp.status})` }, { status: 400 });
    }
    const contentType = resp.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "URL is not an image" }, { status: 400 });
    }
    const arrayBuf = await resp.arrayBuffer();
    if (arrayBuf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 400 });
    }
    const buffer = Buffer.from(arrayBuf);
    const ext = extFromContentType(contentType);
    const stamp = Date.now().toString(36);
    const rand = Math.abs(url.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)).toString(36);
    const storagePath = `${FOLDER}/saved-${stamp}-${rand}${ext}`;

    const supabase = requireSupabaseAdmin();
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true });
    }
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save image" },
      { status: 500 }
    );
  }
}
