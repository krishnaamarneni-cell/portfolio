import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "public-assets";
const RESUME_PATH = "resume/Krishna_Amarneni_Resume";

const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc
]);

function extFromMime(mime: string): string {
  if (mime.includes("pdf")) return ".pdf";
  if (mime.includes("openxmlformats")) return ".docx";
  if (mime.includes("msword")) return ".doc";
  return ".docx";
}

/** GET — return current resume URL. */
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check Supabase Storage first
  try {
    const supabase = requireSupabaseAdmin();
    const { data } = await supabase.storage.from(BUCKET).list("resume");
    if (data && data.length > 0) {
      const file = data.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))[0];
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(`resume/${file.name}`);
      return NextResponse.json({
        url: urlData.publicUrl,
        name: file.name,
        updatedAt: file.created_at,
        source: "supabase",
      });
    }
  } catch {}

  // Fallback: static file
  return NextResponse.json({
    url: "/Krishna_Amarneni_Resume.docx",
    name: "Krishna_Amarneni_Resume.docx",
    source: "static",
  });
}

/** POST — upload new resume. */
export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Only PDF and DOCX files allowed" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Max 10MB" }, { status: 400 });
  }

  const ext = extFromMime(file.type);
  const storagePath = `${RESUME_PATH}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const supabase = requireSupabaseAdmin();

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true });
    }

    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return NextResponse.json({ url: urlData.publicUrl, name: file.name });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Upload failed",
    }, { status: 500 });
  }
}
