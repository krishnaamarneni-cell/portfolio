import { NextResponse } from "next/server";
import path from "node:path";
import { promises as fs } from "node:fs";
import { getSession } from "@/lib/auth";

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
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 400 }
    );
  }

  const subdir = kind === "logo" ? "logos" : kind === "preview" ? "previews" : "uploads";
  const folder = path.join(process.cwd(), "public", subdir);
  await fs.mkdir(folder, { recursive: true });

  const ext = path.extname(file.name) || extFromMime(file.type);
  const base = safeFileName(path.basename(file.name, path.extname(file.name)) || "image");
  const stamp = Date.now().toString(36);
  const filename = `${base}-${stamp}${ext}`;
  const fullPath = path.join(folder, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buffer);

  const url = `/${subdir}/${filename}`;
  return NextResponse.json({ url });
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/svg+xml":
      return ".svg";
    case "image/gif":
      return ".gif";
    default:
      return "";
  }
}
