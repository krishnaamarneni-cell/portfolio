import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generatePostsFromImage } from "@/lib/image-to-post";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { imageUrl?: string; hint?: string; tone?: string };

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const imageUrl = (body.imageUrl ?? "").trim();
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    return NextResponse.json(
      { error: "A public image URL is required. Generate or upload an image first." },
      { status: 400 }
    );
  }

  const result = await generatePostsFromImage(imageUrl, {
    hint: body.hint,
    tone: body.tone,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json(result.posts);
}
