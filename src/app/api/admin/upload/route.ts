import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);
const MAX_BYTES = 5 * 1024 * 1024;

function safeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/png": return ".png";
    case "image/jpeg": return ".jpg";
    case "image/webp": return ".webp";
    case "image/svg+xml": return ".svg";
    case "image/gif": return ".gif";
    default: return "";
  }
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const kind = (form.get("kind") as string | null) || "uploads";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 400 });
  }

  const ext = extFromMime(file.type) || ".png";
  const base = safeFileName(file.name.replace(/\.[^.]+$/, "") || "image");
  const stamp = Date.now().toString(36);
  const subdir = kind === "logo" ? "logos" : kind === "preview" ? "previews" : kind === "social" ? "social" : "uploads";
  const storagePath = `${subdir}/${base}-${stamp}${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  // Try Supabase Storage first (works on Vercel production)
  try {
    const supabase = requireSupabaseAdmin();
    const bucket = "public-assets";

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === bucket)) {
      await supabase.storage.createBucket(bucket, { public: true });
    }

    const { error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (!error) {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      return NextResponse.json({ url: urlData.publicUrl });
    }
    // If storage fails, fall through to filesystem
    console.warn("[upload] Supabase storage failed:", error.message);
  } catch (err) {
    console.warn("[upload] Supabase not available, trying filesystem:", err instanceof Error ? err.message : "");
  }

  // Fallback: local filesystem (works in dev, not on Vercel)
  try {
    const path = await import("node:path");
    const fs = await import("node:fs/promises");
    const folder = path.join(process.cwd(), "public", subdir);
    await fs.mkdir(folder, { recursive: true });
    const filename = `${base}-${stamp}${ext}`;
    await fs.writeFile(path.join(folder, filename), buffer);
    return NextResponse.json({ url: `/${subdir}/${filename}` });
  } catch {
    return NextResponse.json({ error: "Upload failed — both Supabase Storage and filesystem unavailable" }, { status: 500 });
  }
}
