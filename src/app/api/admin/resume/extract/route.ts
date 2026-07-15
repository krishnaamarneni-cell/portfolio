import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;

/** POST a resume file (PDF / DOCX / TXT) → extracted plain text. */
export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();

  try {
    let text = "";

    if (type.includes("pdf") || name.endsWith(".pdf")) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const res = await extractText(pdf, { mergePages: true });
      text = Array.isArray(res.text) ? res.text.join("\n") : res.text;
    } else if (name.endsWith(".docx") || type.includes("officedocument.wordprocessingml")) {
      const mammoth = (await import("mammoth")).default;
      const { value } = await mammoth.extractRawText({ buffer });
      text = value;
    } else if (name.endsWith(".txt") || type.startsWith("text/")) {
      text = buffer.toString("utf-8");
    } else if (name.endsWith(".doc") || type.includes("msword")) {
      return NextResponse.json(
        { error: "Old .doc isn't supported — save it as .docx or PDF and re-upload." },
        { status: 415 }
      );
    } else {
      return NextResponse.json(
        { error: "Unsupported file. Upload a PDF, DOCX, or TXT." },
        { status: 415 }
      );
    }

    text = (text || "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) {
      return NextResponse.json({ error: "Couldn't read any text from that file." }, { status: 422 });
    }
    return NextResponse.json({ text: text.slice(0, 20000), name: file.name });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read the file" },
      { status: 502 }
    );
  }
}
