import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

function extFromMime(mime: string): string {
  if (mime.includes("pdf")) return ".pdf";
  if (mime.includes("openxmlformats")) return ".docx";
  return ".doc";
}

/** GET — return current resume URL from admin_settings. */
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from("admin_settings")
    .select("resume_url, resume_name, resume_updated_at")
    .eq("id", "singleton")
    .maybeSingle();

  if (data?.resume_url) {
    return NextResponse.json({
      url: data.resume_url,
      name: data.resume_name || "Resume",
      updatedAt: data.resume_updated_at,
      source: "uploaded",
    });
  }

  return NextResponse.json({
    url: "/Krishna_Amarneni_Resume.docx",
    name: "Krishna_Amarneni_Resume.docx",
    source: "static",
  });
}

/** POST — upload new resume to Supabase Storage + save URL to admin_settings. */
export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Only PDF and DOCX allowed" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Max 10MB" }, { status: 400 });
  }

  const supabase = requireSupabaseAdmin();
  const ext = extFromMime(file.type);
  const storagePath = `resume/Krishna_Amarneni_Resume${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const bucket = "public-assets";

  // Ensure bucket exists + is public
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === bucket)) {
      await supabase.storage.createBucket(bucket, { public: true, fileSizeLimit: 10485760 });
    }
  } catch {}

  // Upload (upsert = overwrite existing)
  const { error: uploadErr } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;

  // Save to admin_settings so everything uses the same URL
  await supabase.from("admin_settings").upsert({
    id: "singleton",
    resume_url: publicUrl,
    resume_name: file.name,
    resume_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Also update site_content so the public "Download CV" button uses the new resume
  try {
    const { data: site } = await supabase.from("site_content").select("*").eq("id", "singleton").maybeSingle();
    if (site?.data) {
      const content = typeof site.data === "string" ? JSON.parse(site.data) : site.data;
      if (content.about) {
        content.about.resume_url = publicUrl;
        await supabase.from("site_content").update({ data: content, updated_at: new Date().toISOString() }).eq("id", "singleton");
      }
    }
  } catch {} // non-critical

  return NextResponse.json({ url: publicUrl, name: file.name });
}
