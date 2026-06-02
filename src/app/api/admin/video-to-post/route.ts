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
    systemPrompt: `You create social media posts from video content for Krishna Amarneni. Krishna is an SAP consultant, AI builder, and author.

Given a video transcript/caption, create posts for LinkedIn, X/Twitter, and Instagram.

RULES:
- Write as Krishna sharing/reacting to the video content, not just summarizing it
- Add Krishna's perspective based on his SAP + AI + finance background where relevant
- NEVER use ** bold markdown or asterisks. Plain text only.
- Include the original video URL for reference
- Each platform version should feel native to that platform

Output STRICT JSON:
{
  "linkedin": "LinkedIn post (max 3000 chars). Hook in first line. 3-5 short paragraphs. 3-5 hashtags at end.",
  "twitter": "Tweet (max 270 chars). One sharp take.",
  "instagram": "Instagram caption (max 2000 chars). Personal story opener. 5-10 hashtags at end.",
  "summary": "One sentence summary of the video content.",
  "suggested_title": "A catchy title for this post"
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
