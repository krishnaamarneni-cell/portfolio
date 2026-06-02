/**
 * Video-to-post pipeline.
 *
 * 1. Extract YouTube video ID from URL
 * 2. Fetch captions/transcript via YouTube's timedtext API (no download needed)
 * 3. Generate social media post from transcript using AI
 * 4. Optionally upload thumbnail to Cloudinary for Instagram
 */
import "server-only";

/** Extract YouTube video ID from various URL formats. */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Fetch YouTube video metadata (title, description, thumbnail). */
export async function fetchVideoMeta(videoId: string): Promise<{
  title: string;
  description: string;
  thumbnail: string;
  channel: string;
} | null> {
  // Use oEmbed API (no API key needed)
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    return {
      title: j.title || "",
      description: "",
      thumbnail: j.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      channel: j.author_name || "",
    };
  } catch {
    return null;
  }
}

/** Fetch YouTube captions/transcript. Tries multiple approaches. */
export async function fetchTranscript(videoId: string): Promise<string | null> {
  // Approach 1: Scrape the video page for caption tracks
  try {
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const r = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const html = await r.text();

    // Find captionTracks in the page source
    const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (!captionMatch) return null;

    let tracks: Array<{ baseUrl?: string; languageCode?: string }>;
    try {
      tracks = JSON.parse(captionMatch[1]);
    } catch {
      return null;
    }

    // Prefer English captions
    const enTrack = tracks.find((t) => t.languageCode === "en") || tracks[0];
    if (!enTrack?.baseUrl) return null;

    // Fetch the caption XML
    const captionUrl = enTrack.baseUrl + "&fmt=json3";
    const cr = await fetch(captionUrl, { cache: "no-store" });
    if (!cr.ok) {
      // Try XML format
      const xr = await fetch(enTrack.baseUrl, { cache: "no-store" });
      if (!xr.ok) return null;
      const xml = await xr.text();
      // Extract text from XML <text> tags
      const texts = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
        .map((m) => m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"'))
        .filter(Boolean);
      return texts.join(" ").replace(/\s+/g, " ").trim();
    }

    const json = (await cr.json()) as { events?: Array<{ segs?: Array<{ utf8?: string }> }> };
    if (!json.events) return null;
    const text = json.events
      .flatMap((e) => e.segs ?? [])
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

/** Upload an image URL to Cloudinary and return the public URL. */
export async function uploadToCloudinary(imageUrl: string): Promise<string | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;

  try {
    const { v2: cloudinary } = await import("cloudinary");
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: "lucy-social",
      transformation: [{ width: 1080, height: 1080, crop: "fill" }],
    });
    return result.secure_url;
  } catch (err) {
    console.error("[cloudinary]", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Check if URL is an Instagram post/reel. */
export function isInstagramUrl(url: string): boolean {
  return /instagram\.com\/(p|reel|reels)\//i.test(url);
}

/** Fetch Instagram post metadata via oEmbed. */
export async function fetchInstagramMeta(url: string): Promise<{
  title: string;
  thumbnail: string;
  author: string;
} | null> {
  try {
    const r = await fetch(
      `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`,
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { title?: string; thumbnail_url?: string; author_name?: string };
    return {
      title: j.title || "",
      thumbnail: j.thumbnail_url || "",
      author: j.author_name || "",
    };
  } catch {
    return null;
  }
}
