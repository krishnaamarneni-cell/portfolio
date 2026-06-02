import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runAgent } from "@/lib/agents";
import {
  extractVideoId,
  fetchVideoMeta,
  fetchTranscript,
  uploadToCloudinary,
  isInstagramUrl,
  fetchInstagramMeta,
  transcribeViaOracle,
} from "@/lib/video-to-post";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  url: string;
  model?: string;
};

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const url = (body.url || "").trim();
  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  let title = "";
  let transcript = "";
  let thumbnail = "";
  let channel = "";
  let source = "video";

  // Detect platform
  if (isInstagramUrl(url)) {
    source = "instagram";
    const meta = await fetchInstagramMeta(url);
    if (meta) {
      title = meta.title;
      thumbnail = meta.thumbnail;
      channel = meta.author;
    }

    // Try Oracle worker for FULL video transcription (yt-dlp + Whisper).
    // This actually downloads the Instagram video and transcribes the audio.
    const oracleResult = await transcribeViaOracle(url);
    if (oracleResult) {
      transcript = oracleResult.transcript;
      if (!title) title = oracleResult.title;
    } else {
      // Fallback to caption text from oEmbed (thin, but better than nothing)
      transcript = meta?.title || "";
    }
  } else {
    // YouTube
    source = "youtube";
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: "Could not extract video ID from URL" }, { status: 400 });
    }

    const meta = await fetchVideoMeta(videoId);
    if (meta) {
      title = meta.title;
      thumbnail = meta.thumbnail;
      channel = meta.channel;
    }

    // Try built-in captions first (fastest, no download needed)
    const captions = await fetchTranscript(videoId);
    if (captions) {
      transcript = captions;
    } else {
      // No captions — try Oracle worker (downloads + Whisper transcribes)
      const oracleResult = await transcribeViaOracle(url);
      if (oracleResult) {
        transcript = oracleResult.transcript;
      } else {
        // Final fallback: just use the title
        transcript = title;
      }
    }
  }

  if (!transcript && !title) {
    return NextResponse.json({
      error: "Could not extract any content from this URL. The video may not have captions enabled.",
    }, { status: 422 });
  }

  // Truncate transcript for LLM context (max ~3000 chars)
  const truncatedTranscript = transcript.length > 3000
    ? transcript.slice(0, 3000) + "..."
    : transcript;

  // Generate social media posts from the video content
  const result = await runAgent({
    apiKey,
    model: "llama-3.3-70b-versatile",
    systemPrompt: `You create social media posts from video content for Krishna Amarneni (SAP consultant at Coca-Cola, AI builder, author).

Write as Krishna REACTING to/sharing the video — not just summarizing it. Add his perspective.

LINKEDIN (max 3000 chars):
Line 1: Scroll-stopping hook about the video's key insight (max 120 chars)
Line 2: empty
Lines 3+: 3-5 short paragraphs. Krishna's take on why this matters. End with question + 3-5 hashtags.

TWITTER (max 270 chars):
One sharp hot take about the video. Punchy. Quotable. Makes people retweet.

INSTAGRAM (max 2000 chars):
Personal story opener connecting to the video. Short paragraphs. End with question + 8-12 hashtags.

RULES:
- NEVER use ** markdown. Plain text only.
- Include the video URL naturally in the LinkedIn post.
- Each version must feel DIFFERENT — not the same text reformatted.
- Write about the VIDEO CONTENT, not Krishna's bio.

Output STRICT JSON:
{
  "linkedin": "...",
  "twitter": "...",
  "instagram": "...",
  "summary": "One sentence summary.",
  "suggested_title": "Catchy title"
}`,
    userPrompt: `Video from ${source}:
Title: ${title}
Channel: ${channel}
URL: ${url}

Transcript/Content:
${truncatedTranscript}`,
    maxTokens: 2000,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Parse AI response
  let posts: {
    linkedin: string;
    twitter: string;
    instagram: string;
    summary: string;
    suggested_title: string;
  };
  try {
    const cleaned = (result.content || "")
      .replace(/```json?\s*\n?/g, "")
      .replace(/```/g, "")
      .trim();
    posts = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({
      error: "AI returned invalid JSON. Try again.",
      raw: result.content,
    }, { status: 502 });
  }

  // Upload thumbnail to Cloudinary for Instagram (needs a public URL)
  let cloudinaryUrl: string | null = null;
  if (thumbnail) {
    cloudinaryUrl = await uploadToCloudinary(thumbnail);
  }

  return NextResponse.json({
    source,
    title,
    channel,
    thumbnail,
    cloudinaryUrl,
    hasTranscript: transcript.length > 50,
    transcriptLength: transcript.length,
    posts,
  });
}
