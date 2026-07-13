"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiZap,
  FiImage,
  FiCopy,
  FiCheck,
  FiSend,
  FiClock,
  FiRefreshCw,
  FiExternalLink,
  FiCalendar,
  FiLayers,
  FiSave,
  FiFolder,
  FiTrash2,
  FiUploadCloud,
  FiChevronDown,
} from "react-icons/fi";
import { FaXTwitter, FaLinkedinIn, FaInstagram } from "react-icons/fa6";
import {
  modelsFor,
  DEFAULT_WRITING_MODEL,
} from "@/lib/groq-models";

type PlatformKey = "linkedin" | "x" | "instagram";

const PLATFORMS: {
  key: PlatformKey;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  limit: number;
  color: string;
  aspect: "square" | "landscape";
}[] = [
  { key: "linkedin", label: "LinkedIn", icon: FaLinkedinIn, limit: 3000, color: "#0a66c2", aspect: "landscape" },
  { key: "x", label: "X", icon: FaXTwitter, limit: 270, color: "#ffffff", aspect: "landscape" },
  { key: "instagram", label: "Instagram", icon: FaInstagram, limit: 2000, color: "#e1306c", aspect: "square" },
];

type Composition = {
  linkedin: string;
  x: string;
  instagram: string;
  image_query: string;
  image_prompt: string;
};

type BufferProfile = {
  id: string;
  service: string;
  formatted_username: string;
  formatted_service: string;
  avatar?: string;
};

type Draft = {
  id: string;
  savedAt: number;
  topic: string;
  hint: string;
  composition: Composition;
  imageUrl: string;
  imageCredit: string | null;
  imagePrompt: string;
  imageProvider: "auto" | "fal" | "unsplash";
};

const EMPTY: Composition = {
  linkedin: "",
  x: "",
  instagram: "",
  image_query: "",
  image_prompt: "",
};

const DRAFTS_KEY = "krishna_admin_social_drafts_v1";

/** Transparent brand mark, served from /public — used for the "with logo"
 *  external-image workflow (download and attach in ChatGPT). */
const LOGO_URL = "/Krishna.amarneni_ai-removebg-preview.png";

function loadDrafts(): Draft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Draft[];
  } catch {
    return [];
  }
}

function persistDrafts(list: Draft[]) {
  try {
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(list));
  } catch {}
}

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] focus:border-emerald-500 focus:outline-none text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] transition-colors";
const textareaClass = inputClass + " resize-y leading-relaxed";
const cardClass =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 space-y-3";

/** Filter Buffer profiles for one of our 3 platforms. */
function profilesFor(all: BufferProfile[], key: PlatformKey): BufferProfile[] {
  return all.filter((bp) => {
    const s = bp.service.toLowerCase();
    if (key === "linkedin") return s.startsWith("linkedin");
    if (key === "x") return s.startsWith("twitter") || s === "x";
    return s.startsWith("instagram");
  });
}

/** Initial "now-ish" datetime-local string (rounded up 10 min). */
function defaultScheduleAt(): string {
  const d = new Date(Date.now() + 10 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseReferenceUrls(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s))
    .slice(0, 3);
}

function shortPreview(s: string, n = 60) {
  const trimmed = s.replace(/\s+/g, " ").trim();
  return trimmed.length > n ? trimmed.slice(0, n - 1) + "…" : trimmed;
}

function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function SocialEditor({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [topic, setTopic] = useState("");
  const [hint, setHint] = useState("");
  const [composing, setComposing] = useState(false);
  const [composition, setComposition] = useState<Composition>(EMPTY);
  const [writeModel, setWriteModel] = useState<string>(DEFAULT_WRITING_MODEL);

  // Hydrate persisted writing-model choice once on mount.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("krishna_admin_social_model");
      if (saved) setWriteModel(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem("krishna_admin_social_model", writeModel);
    } catch {}
  }, [writeModel]);

  const writingOptions = modelsFor("writing");

  const [imageUrl, setImageUrl] = useState("");
  const [imageCredit, setImageCredit] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageProvider, setImageProvider] = useState<"auto" | "fal" | "unsplash">("auto");
  const [generating, setGenerating] = useState(false);
  /** Up to 3 URLs the user pastes — when present + provider=fal, the route
   *  routes to Flux Redux so the output mimics the references' style. */
  const [referenceUrlsText, setReferenceUrlsText] = useState("");
  /** Tracks whether the user has typed into the image prompt themselves —
   * if false, we keep the input synced to whichever auto-prompt fits the
   * selected provider. */
  const userEditedPromptRef = useRef(false);

  // Upload + saved images
  const [uploading, setUploading] = useState(false);
  const [savedImages, setSavedImages] = useState<{ name: string; url: string; created_at: string }[]>([]);
  const [savedOpen, setSavedOpen] = useState(true);
  const [savedLoading, setSavedLoading] = useState(false);
  const [postingFromImage, setPostingFromImage] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [promptWithLogo, setPromptWithLogo] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collapsible sections — the top two (Compose, Image) start minimized so the
  // editor opens compact; Posts stays expanded.
  const [openCompose, setOpenCompose] = useState(false);
  const [openImage, setOpenImage] = useState(false);
  const [openPosts, setOpenPosts] = useState(true);

  // Load the saved-image library once so the thumbnail strip is there on open.
  useEffect(() => {
    fetchSavedImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "social");
      const r = await fetch("/api/admin/upload", { method: "POST", body: form });
      const j = await r.json();
      if (!r.ok) { onError(j.error || "Upload failed"); setUploading(false); return; }
      setImageUrl(j.url);
      setImageCredit(null);
      onSuccess("Image uploaded");
      fetchSavedImages();
    } catch { onError("Upload network error"); }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function fetchSavedImages() {
    setSavedLoading(true);
    try {
      const r = await fetch("/api/admin/social/images");
      const j = await r.json();
      if (Array.isArray(j.images)) setSavedImages(j.images);
    } catch {}
    setSavedLoading(false);
  }

  /** Turn the current image into per-platform posts via a vision model. */
  async function imageToPost() {
    if (!imageUrl.trim()) {
      onError("Add an image first — generate, upload, or pick a saved one");
      return;
    }
    setPostingFromImage(true);
    try {
      const res = await fetch("/api/admin/image-to-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          hint: hint || undefined,
          tone: tone !== "default" ? tone : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || "Could not read the image");
        setPostingFromImage(false);
        return;
      }
      setComposition({
        linkedin: data.linkedin ?? "",
        x: data.x ?? "",
        instagram: data.instagram ?? "",
        image_query: data.image_query ?? "",
        image_prompt: data.image_prompt ?? "",
      });
      if (data.image_query && !topic.trim()) setTopic(data.image_query);
      onSuccess("Posts written from your image");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Network error");
    }
    setPostingFromImage(false);
  }

  /** Persist the current (generated / external) image into the saved library. */
  async function saveToLibrary() {
    if (!imageUrl.trim()) return;
    // Already a saved-library image? No need to re-save.
    if (savedImages.some((img) => img.url === imageUrl)) {
      onSuccess("Already in your library");
      setSavedOpen(true);
      return;
    }
    setSavingImage(true);
    try {
      const r = await fetch("/api/admin/social/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: imageUrl }),
      });
      const j = await r.json();
      if (!r.ok) { onError(j.error || "Could not save image"); setSavingImage(false); return; }
      onSuccess("Saved to your library");
      setSavedOpen(true);
      fetchSavedImages();
    } catch { onError("Network error saving image"); }
    setSavingImage(false);
  }

  /** Build a copy-ready image prompt for ChatGPT / DALL·E / Midjourney, with an
   *  optional instruction to composite Krishna's logo into the artwork. */
  function buildExternalPrompt(withLogo: boolean): string {
    const base = (
      imagePrompt.trim() ||
      composition.image_prompt ||
      composition.image_query ||
      topic
    ).trim();
    if (!base) return "";
    if (!withLogo) return base;
    return `${base}\n\nThen take the attached logo image (the "Krishna Amarneni" brand mark) and place it small in the bottom-right corner. Preserve its transparent background so it sits cleanly over the artwork, keep it sharp and legible, and do not stretch or distort it.`;
  }

  async function copyExternalPrompt() {
    const text = buildExternalPrompt(promptWithLogo);
    if (!text) { onError("Compose a topic or write an image prompt first"); return; }
    try {
      await navigator.clipboard.writeText(text);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1600);
      onSuccess(promptWithLogo ? "Prompt copied — attach the logo in ChatGPT" : "Prompt copied");
    } catch { onError("Couldn't copy to clipboard"); }
  }

  const [tone, setTone] = useState("default");

  const [profiles, setProfiles] = useState<BufferProfile[]>([]);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [posting, setPosting] = useState(false);

  // Per-platform schedule pickers
  const [scheduleAt, setScheduleAt] = useState<Record<PlatformKey, string>>({
    linkedin: "",
    x: "",
    instagram: "",
  });

  // Batch footer schedule
  const [batchScheduleAt, setBatchScheduleAt] = useState<string>("");
  const [batchBusy, setBatchBusy] = useState(false);

  // Drafts
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(loadDrafts());
  }, []);

  useEffect(() => {
    fetch("/api/admin/buffer/profiles")
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        console.log("[Buffer] profiles response:", JSON.stringify(data, null, 2));
        if (ok && Array.isArray(data.profiles)) {
          setProfiles(data.profiles);
          const auto: Record<string, boolean> = {};
          for (const p of data.profiles) auto[p.id] = true;
          setSelected(auto);
          if (data.profiles.length === 0 && data._debug) {
            console.warn("[Buffer] No profiles. Raw channels:", data._debug);
          }
        } else if (data.error) {
          setProfilesError(data.error);
        }
      });
  }, []);

  /** Pick the "natural" prompt for a provider — fal/auto get the rich Flux
   * prompt, Unsplash gets the short search query. */
  function promptForProvider(
    provider: "auto" | "fal" | "unsplash",
    c: Composition
  ): string {
    if (provider === "unsplash") return c.image_query || "";
    return c.image_prompt || c.image_query || "";
  }

  /** Keep image prompt synced to provider + composition while the user
   * hasn't manually edited it. */
  useEffect(() => {
    if (userEditedPromptRef.current) return;
    const next = promptForProvider(imageProvider, composition);
    setImagePrompt(next);
  }, [imageProvider, composition]);

  async function compose() {
    if (!topic.trim()) {
      onError("Add a topic first");
      return;
    }
    setComposing(true);
    try {
      const res = await fetch("/api/admin/compose-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, hint, model: writeModel, tone: tone !== "default" ? tone : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || "Compose failed");
        setComposing(false);
        return;
      }
      const newComp: Composition = {
        linkedin: data.linkedin ?? "",
        x: data.x ?? "",
        instagram: data.instagram ?? "",
        image_query: data.image_query ?? "",
        image_prompt: data.image_prompt ?? "",
      };
      setComposition(newComp);
      // Force-resync the prompt to the fresh content, regardless of whether
      // the user had previously edited the prompt by hand — they just asked
      // for new content, so the old custom prompt no longer applies.
      userEditedPromptRef.current = false;
      setImagePrompt(promptForProvider(imageProvider, newComp));
      // Reveal the image tools + ready-to-paste prompt now that a draft exists.
      setOpenImage(true);
      onSuccess("Posts drafted — now generate or copy the image prompt");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Network error");
    }
    setComposing(false);
  }

  async function generateImage(aspect: "square" | "landscape" = "landscape") {
    const prompt = imagePrompt.trim() || promptForProvider(imageProvider, composition);
    if (!prompt) {
      onError("Need an image prompt or a generated topic first");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          provider: imageProvider,
          aspect,
          referenceUrls: parseReferenceUrls(referenceUrlsText),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || "Image generation failed");
        setGenerating(false);
        return;
      }
      setImageUrl(data.url);
      setImageCredit(data.credit ?? null);
      onSuccess(`Image generated (${data.provider})`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Network error");
    }
    setGenerating(false);
  }

  /** Convert a datetime-local string ("YYYY-MM-DDTHH:mm") to ISO in UTC. */
  function toIso(local: string): string | null {
    if (!local) return null;
    const d = new Date(local);
    if (!Number.isFinite(d.getTime())) return null;
    if (d.getTime() < Date.now() + 60 * 1000) return null;
    return d.toISOString();
  }

  /** Per-platform post — "now" goes straight to Buffer, anything else
   *  saves to the local queue and the cron fires it at the right time. */
  async function postOne(
    key: PlatformKey,
    when: "now" | "queue" | string
  ): Promise<{ ok: boolean; error?: string }> {
    const p = PLATFORMS.find((x) => x.key === key)!;
    const text = composition[key];
    const matching = profilesFor(profiles, key).filter((bp) => selected[bp.id]);
    if (matching.length === 0) {
      return { ok: false, error: `No ${p.label} profile selected` };
    }
    if (!text.trim()) return { ok: false, error: `${p.label} text is empty` };
    if (text.length > p.limit)
      return { ok: false, error: `${p.label} over character limit` };

    if (when === "now") {
      const res = await fetch("/api/admin/buffer/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          profile_ids: matching.map((bp) => bp.id),
          media_url: imageUrl || undefined,
          when: "now",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || `${p.label} post failed` };
      return { ok: true };
    }

    // Queue or schedule → save to local queue
    const dueAt =
      when === "queue"
        ? new Date(Date.now() + 60_000).toISOString()
        : new Date(when).toISOString();
    const items = matching.map((bp) => ({
      text,
      platform: key,
      channel_id: bp.id,
      channel_name: bp.formatted_username,
      image_url: imageUrl || undefined,
      due_at: dueAt,
    }));
    const res = await fetch("/api/admin/social/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", items }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || "Queue failed" };
    return { ok: true };
  }

  const readyPlatforms = useMemo<PlatformKey[]>(() => {
    return PLATFORMS.filter((p) => {
      const text = composition[p.key];
      const ids = profilesFor(profiles, p.key).filter((bp) => selected[bp.id]);
      return ids.length > 0 && text.trim().length > 0 && text.length <= p.limit;
    }).map((p) => p.key);
  }, [composition, profiles, selected]);

  async function batchPost(when: "now" | "queue" | string) {
    if (readyPlatforms.length === 0) {
      onError(
        "Nothing to post — generate text and pick at least one profile per platform"
      );
      return;
    }
    setBatchBusy(true);
    const results = await Promise.all(
      readyPlatforms.map(async (k) => ({ k, ...(await postOne(k, when)) }))
    );
    setBatchBusy(false);
    const failed = results.filter((r) => !r.ok);
    if (failed.length === 0) {
      const verb =
        when === "now"
          ? "Posted to"
          : when === "queue"
          ? "Queued on"
          : "Scheduled on";
      onSuccess(`${verb} ${results.map((r) => r.k).join(", ")}`);
    } else if (failed.length === results.length) {
      onError(failed.map((r) => `${r.k}: ${r.error}`).join(" · "));
    } else {
      onError(
        `Partial: ${failed.map((r) => `${r.k}: ${r.error}`).join(" · ")}`
      );
    }
  }

  /* ─── Drafts ─── */

  function saveDraft() {
    const hasContent =
      topic.trim() ||
      composition.linkedin.trim() ||
      composition.x.trim() ||
      composition.instagram.trim() ||
      imageUrl.trim();
    if (!hasContent) {
      onError("Nothing to save yet");
      return;
    }
    const id = loadedDraftId ?? `d_${Date.now().toString(36)}`;
    const next: Draft = {
      id,
      savedAt: Date.now(),
      topic,
      hint,
      composition,
      imageUrl,
      imageCredit,
      imagePrompt,
      imageProvider,
    };
    const others = drafts.filter((d) => d.id !== id);
    const updated = [next, ...others].slice(0, 30); // cap at 30
    setDrafts(updated);
    persistDrafts(updated);
    setLoadedDraftId(id);
    onSuccess(loadedDraftId ? "Draft updated" : "Draft saved");
  }

  function loadDraft(d: Draft) {
    setTopic(d.topic);
    setHint(d.hint);
    setComposition(d.composition);
    setImageUrl(d.imageUrl);
    setImageCredit(d.imageCredit);
    setImagePrompt(d.imagePrompt);
    // Treat the loaded prompt as user-edited so we don't overwrite it
    // when the provider effect runs.
    userEditedPromptRef.current = !!d.imagePrompt;
    setImageProvider(d.imageProvider);
    setLoadedDraftId(d.id);
    setDraftsOpen(false);
    onSuccess(`Loaded draft from ${timeAgo(d.savedAt)}`);
  }

  function deleteDraft(id: string) {
    const updated = drafts.filter((d) => d.id !== id);
    setDrafts(updated);
    persistDrafts(updated);
    if (loadedDraftId === id) setLoadedDraftId(null);
  }

  function newBlank() {
    setTopic("");
    setHint("");
    setComposition(EMPTY);
    setImageUrl("");
    setImageCredit(null);
    setImagePrompt("");
    userEditedPromptRef.current = false;
    setLoadedDraftId(null);
    onSuccess("Cleared");
  }

  return (
    <section className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/25 to-emerald-500/5 ring-1 ring-emerald-500/20 flex items-center justify-center shrink-0">
            <FiSend size={18} className="text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--admin-text)]">Social Media Editor</h2>
            <p className="text-[11px] text-[var(--admin-text-secondary)] max-w-md">
              Draft per-platform posts with AI, add an image, and post or schedule via Buffer.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={saveDraft}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)] text-xs text-[var(--admin-text-secondary)] hover:border-emerald-500 hover:text-emerald-600"
        >
          <FiSave size={12} />
          {loadedDraftId ? "Update draft" : "Save draft"}
        </button>
      </div>

      {/* ── Compose ── */}
      <CollapsibleCard
        title="Compose"
        icon={<FiZap size={13} className="text-emerald-600" />}
        open={openCompose}
        onToggle={() => setOpenCompose((v) => !v)}
      >
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)] mb-1.5">
              Topic
            </label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className={inputClass}
              placeholder="e.g. why medication reviews matter for seniors"
            />
          </div>
          <div className="w-44 shrink-0">
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)] mb-1.5">
              Tone
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className={inputClass}
            >
              <option value="default">Default</option>
              <option value="warm">Warm &amp; friendly</option>
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="bold">Bold &amp; punchy</option>
              <option value="storytelling">Storytelling</option>
              <option value="educational">Educational</option>
            </select>
          </div>
          <button
            type="button"
            onClick={compose}
            disabled={composing}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-60"
          >
            <FiZap size={14} />
            {composing ? "Drafting…" : "AI compose"}
          </button>
        </div>
        <input
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          className={inputClass + " text-xs"}
          placeholder="Optional hint: 'punchier', 'frame as a lesson', 'mention Coca-Cola project'"
        />
        <VideoToPost onGenerated={(data: { summary?: string; linkedin?: string; twitter?: string; instagram?: string; imageUrl?: string }) => {
          setTopic(data.summary || "");
          setComposition((prev) => ({
            ...prev,
            linkedin: data.linkedin || "",
            x: data.twitter || "",
            instagram: data.instagram || "",
          }));
          if (data.imageUrl) setImageUrl(data.imageUrl);
        }} />
      </CollapsibleCard>

      {/* ── Image ── */}
      <CollapsibleCard
        title="Image"
        icon={<FiImage size={13} className="text-emerald-600" />}
        open={openImage}
        onToggle={() => setOpenImage((v) => !v)}
        right={
          <select
            value={imageProvider}
            onChange={(e) => {
              const next = e.target.value as "auto" | "fal" | "unsplash";
              setImageProvider(next);
              if (!imagePrompt.trim()) userEditedPromptRef.current = false;
            }}
            className="px-2.5 py-1 rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-[11px] text-[var(--admin-text-secondary)] focus:outline-none focus:border-emerald-500"
          >
            <option value="auto">Auto</option>
            <option value="fal">fal.ai</option>
            <option value="unsplash">Unsplash</option>
          </select>
        }
      >
        {/* Preview + prompt inputs */}
        <div className="flex gap-3 items-stretch">
          <div className="w-24 h-24 rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-input-bg)] flex items-center justify-center shrink-0 overflow-hidden">
            {imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <FiImage size={22} className="text-[var(--admin-text-muted)]" />
            )}
          </div>
          <div className="flex-1 flex flex-col justify-center gap-2">
            <input
              value={imageProvider === "unsplash" ? imagePrompt : (composition.image_query || imagePrompt)}
              onChange={(e) => { userEditedPromptRef.current = true; setImagePrompt(e.target.value); }}
              className={inputClass + " text-xs"}
              placeholder="Image search words (Unsplash)"
            />
            <input
              value={imageProvider !== "unsplash" ? imagePrompt : (composition.image_prompt || "")}
              onChange={(e) => { userEditedPromptRef.current = true; setImagePrompt(e.target.value); }}
              className={inputClass + " text-xs"}
              placeholder="AI image prompt (fal.ai)"
            />
          </div>
        </div>

        {/* Action toolbar — one clean row */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => generateImage("landscape")}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <FiImage size={12} />
            {generating ? "Generating…" : "Generate"}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-xs text-[var(--admin-text-secondary)] hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-50"
          >
            <FiUploadCloud size={12} />
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            type="button"
            onClick={imageToPost}
            disabled={postingFromImage || !imageUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-500 disabled:opacity-40 shadow-sm"
            title="Write per-platform posts from this image"
          >
            <FiZap size={12} />
            {postingFromImage ? "Reading image…" : "Post from image"}
          </button>
          {imageUrl && (
            <button
              type="button"
              onClick={saveToLibrary}
              disabled={savingImage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-xs text-[var(--admin-text-secondary)] hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-50"
              title="Save this image to your library"
            >
              <FiSave size={12} />
              {savingImage ? "Saving…" : "Save"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setSavedOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
              savedOpen
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600"
                : "bg-[var(--admin-input-bg)] border-[var(--admin-border)] text-[var(--admin-text-secondary)] hover:border-emerald-500 hover:text-emerald-600"
            }`}
          >
            <FiFolder size={12} />
            Saved{savedImages.length > 0 ? ` (${savedImages.length})` : ""}
          </button>
          <div className="flex-1" />
          {imageUrl && (
            <button
              type="button"
              onClick={() => { setImageUrl(""); setImageCredit(null); }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-400/10"
            >
              <FiTrash2 size={12} />
              Clear
            </button>
          )}
        </div>

        {/* Raw image URL is intentionally hidden — only show attribution. */}
        {imageUrl && imageCredit && (
          <p className="text-[10px] text-[var(--admin-text-muted)] font-mono">{imageCredit}</p>
        )}

        {/* Prompt for external image tools (ChatGPT / DALL·E) */}
        <div className="border-t border-[var(--admin-border)] pt-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)]">
              Prompt for ChatGPT / DALL·E
            </span>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-[var(--admin-text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={promptWithLogo}
                onChange={(e) => setPromptWithLogo(e.target.checked)}
                className="accent-emerald-500"
              />
              Include my logo
            </label>
          </div>
          <p className="text-[10px] text-[var(--admin-text-muted)] leading-relaxed">
            Have a fal.ai key? Just hit <span className="text-emerald-600 font-medium">Generate</span>. No key? Copy
            this prompt into ChatGPT or DALL·E, then <span className="text-[var(--admin-text-secondary)]">Upload</span> the
            result here.
          </p>
          <textarea
            readOnly
            rows={promptWithLogo ? 4 : 2}
            value={buildExternalPrompt(promptWithLogo)}
            onFocus={(e) => e.currentTarget.select()}
            placeholder="Compose a topic or type an AI image prompt above to get a ready-to-paste prompt."
            className={textareaClass + " text-[11px]"}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyExternalPrompt}
              disabled={!buildExternalPrompt(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-40"
            >
              {promptCopied ? <FiCheck size={12} /> : <FiCopy size={12} />}
              {promptCopied ? "Copied" : "Copy prompt"}
            </button>
            {promptWithLogo && (
              <a
                href={LOGO_URL}
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-xs text-[var(--admin-text-secondary)] hover:border-emerald-500 hover:text-emerald-600"
              >
                <FiImage size={12} />
                Download logo to attach
              </a>
            )}
            <span className="text-[10px] text-[var(--admin-text-muted)]">
              {promptWithLogo ? "Attach the logo in ChatGPT with the prompt" : "With logo? Tick the box to attach it"}
            </span>
          </div>
        </div>

        {/* Saved-image library — horizontal strip */}
        {savedOpen && (
          <div className="border-t border-[var(--admin-border)] pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)]">
                {savedImages.length > 0 ? `${savedImages.length} saved` : "Saved images"}
              </span>
              <button
                type="button"
                onClick={fetchSavedImages}
                disabled={savedLoading}
                className="inline-flex items-center gap-1 text-[10px] text-[var(--admin-text-muted)] hover:text-emerald-600"
              >
                <FiRefreshCw size={10} className={savedLoading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
            {savedImages.length === 0 ? (
              <p className="text-[11px] text-[var(--admin-text-muted)] py-3 text-center">
                {savedLoading ? "Loading…" : "No saved images yet. Upload or Save one to build your library."}
              </p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {savedImages.map((img) => (
                  <button
                    key={img.name}
                    type="button"
                    onClick={() => {
                      setImageUrl(img.url);
                      setImageCredit(null);
                      onSuccess("Image selected");
                    }}
                    className={`relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border-2 transition-colors hover:border-emerald-500 ${
                      imageUrl === img.url ? "border-emerald-500" : "border-[var(--admin-border)]"
                    }`}
                    title={img.name}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                    {imageUrl === img.url && (
                      <span className="absolute inset-0 bg-emerald-500/25 flex items-center justify-center">
                        <FiCheck size={16} className="text-white drop-shadow" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </CollapsibleCard>

      {/* ── Posts ── */}
      <CollapsibleCard
        title="Posts"
        icon={<FiSend size={13} className="text-emerald-600" />}
        open={openPosts}
        onToggle={() => setOpenPosts((v) => !v)}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {PLATFORMS.map((p) => {
          const text = composition[p.key];
          return (
            <PlatformCard
              key={p.key}
              platform={p}
              text={text}
              onChange={(v) => setComposition((c) => ({ ...c, [p.key]: v }))}
              imageUrl={imageUrl}
              profiles={profilesFor(profiles, p.key)}
              selectedIds={selected}
              onToggleProfile={(id) =>
                setSelected((s) => ({ ...s, [id]: !s[id] }))
              }
              posting={posting}
              setPosting={setPosting}
              onSuccess={onSuccess}
              onError={onError}
              profilesError={profilesError}
              scheduleAt={scheduleAt[p.key]}
              setScheduleAt={(v) =>
                setScheduleAt((s) => ({ ...s, [p.key]: v }))
              }
              toIso={toIso}
            />
          );
        })}
        </div>
      </CollapsibleCard>

      {/* ── Post all bar ── */}
      {!profilesError && profiles.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
          <span className="text-sm text-[var(--admin-text-secondary)]">
            Post everything at once:
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => batchPost("queue")}
              disabled={batchBusy || readyPlatforms.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)] text-xs hover:border-emerald-500/40 disabled:opacity-50"
            >
              <FiClock size={12} />
              Queue all
            </button>
            <button
              type="button"
              onClick={() => batchPost("now")}
              disabled={batchBusy || readyPlatforms.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50"
            >
              <FiSend size={12} />
              {batchBusy ? "Posting…" : "Post all now"}
            </button>
          </div>
        </div>
      )}

      {/* ── Auto-post drip ── */}
      <DripPanel onSuccess={onSuccess} onError={onError} />

      {/* ── Queue + Drafts side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QueuePanel onSuccess={onSuccess} onError={onError} />
        <DraftsPanel
          drafts={drafts}
          loadedDraftId={loadedDraftId}
          onLoad={loadDraft}
          onDelete={deleteDraft}
          onNew={(loadedDraftId || topic || composition.linkedin) ? newBlank : undefined}
        />
      </div>

      {/* ── Campaign mode ── */}
      <CampaignCard
        profiles={profiles}
        onSuccess={onSuccess}
        onError={onError}
        referenceUrlsText={referenceUrlsText}
        setReferenceUrlsText={setReferenceUrlsText}
      />

      {/* ── Footer help ── */}
      {profilesError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          <strong className="font-semibold">Buffer not connected.</strong>{" "}
          Add a <code>buffer</code> connector with your Buffer access token under{" "}
          <strong>Admin → Connectors</strong>, then reload.
        </div>
      )}
    </section>
  );
}

function PlatformCard({
  platform,
  text,
  onChange,
  imageUrl,
  profiles,
  selectedIds,
  onToggleProfile,
  posting,
  setPosting,
  onSuccess,
  onError,
  profilesError,
  scheduleAt,
  setScheduleAt,
  toIso,
}: {
  platform: (typeof PLATFORMS)[number];
  text: string;
  onChange: (v: string) => void;
  imageUrl: string;
  profiles: BufferProfile[];
  selectedIds: Record<string, boolean>;
  onToggleProfile: (id: string) => void;
  posting: boolean;
  setPosting: (v: boolean) => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  profilesError: string | null;
  scheduleAt: string;
  setScheduleAt: (v: string) => void;
  toIso: (local: string) => string | null;
}) {
  const [copied, setCopied] = useState(false);

  const used = text.length;
  const remaining = platform.limit - used;
  const overLimit = remaining < 0;
  const Icon = platform.icon;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  async function postNow(when: "now" | "queue" | string) {
    const matching = profiles.filter((p) => selectedIds[p.id]);
    if (matching.length === 0) {
      onError(`Select at least one ${platform.label} profile to post to`);
      return;
    }
    if (!text.trim()) {
      onError("Empty post");
      return;
    }
    if (overLimit) {
      onError(`Over the ${platform.label} character limit`);
      return;
    }
    setPosting(true);

    if (when === "now") {
      const res = await fetch("/api/admin/buffer/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          profile_ids: matching.map((p) => p.id),
          media_url: imageUrl || undefined,
          when: "now",
        }),
      });
      const data = await res.json().catch(() => ({}));
      setPosting(false);
      if (!res.ok) {
        onError(data.error || "Post failed");
        return;
      }
      onSuccess(`Posted to ${platform.label} now`);
      return;
    }

    // Queue or schedule → local queue
    const dueAt =
      when === "queue"
        ? new Date(Date.now() + 60_000).toISOString()
        : new Date(when).toISOString();
    const items = matching.map((p) => ({
      text,
      platform: platform.key,
      channel_id: p.id,
      channel_name: p.formatted_username,
      image_url: imageUrl || undefined,
      due_at: dueAt,
    }));
    const res = await fetch("/api/admin/social/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", items }),
    });
    const data = await res.json().catch(() => ({}));
    setPosting(false);
    if (!res.ok) {
      onError(data.error || "Queue failed");
      return;
    }
    onSuccess(
      when === "queue"
        ? `Queued on ${platform.label} (posts in ~1 min)`
        : `Scheduled on ${platform.label}`
    );
  }

  const activeProfile = profiles.find((p) => selectedIds[p.id]) ?? profiles[0] ?? null;

  return (
    <div className={cardClass}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: platform.color === "#ffffff" ? "#ccc" : platform.color }}>
            <Icon size={14} />
          </span>
          <h3 className="font-semibold text-sm">{platform.label}</h3>
        </div>
        <span
          className={`text-[11px] font-mono ${
            overLimit ? "text-red-400" : used > platform.limit * 0.9 ? "text-amber-400" : "text-[var(--admin-text-muted)]"
          }`}
        >
          {used}/{platform.limit}
        </span>
      </div>

      {/* Channel dropdown */}
      {!profilesError && (
        <select
          value={activeProfile?.id ?? ""}
          onChange={(e) => {
            for (const p of profiles) {
              if (p.id === e.target.value) {
                if (!selectedIds[p.id]) onToggleProfile(p.id);
              }
            }
          }}
          className={inputClass + " text-xs"}
        >
          {profiles.length === 0 ? (
            <option value="">No channel connected</option>
          ) : (
            profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.formatted_username}
              </option>
            ))
          )}
        </select>
      )}

      {/* Textarea */}
      <textarea
        rows={6}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        className={textareaClass + " text-xs"}
        placeholder={`${platform.label} post...`}
      />

      {/* AI rewrite buttons */}
      {text.trim() && (
        <PostRewriteBar text={text} platform={platform.label} onChange={onChange} />
      )}

      {/* Post now + queue */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (profiles.length > 0) postNow("now");
            else onError(`No ${platform.label} channel in Buffer`);
          }}
          disabled={posting || overLimit || !text}
          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50"
        >
          <FiSend size={11} />
          {posting ? "Posting..." : "Post now"}
        </button>
        {profiles.length > 0 && (
          <button
            type="button"
            onClick={() => postNow("queue")}
            disabled={posting}
            className="p-2 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)] text-[var(--admin-text-secondary)] hover:text-emerald-600 hover:border-emerald-500/40 disabled:opacity-50"
            title="Queue"
          >
            <FiClock size={14} />
          </button>
        )}
      </div>

      {/* Schedule row */}
      {!profilesError && profiles.length > 0 && (
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            className={inputClass + " text-xs flex-1"}
          />
          <button
            type="button"
            onClick={() => {
              const iso = toIso(scheduleAt);
              if (!iso) {
                onError(`Pick a future time for ${platform.label}`);
                return;
              }
              postNow(iso);
            }}
            disabled={posting || overLimit || !scheduleAt}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)] text-xs hover:border-emerald-500/40 disabled:opacity-50"
          >
            <FiCalendar size={11} />
            Schedule
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Campaign mode ─────────────────────────── */

type CampaignResult = {
  post: {
    date: string;
    perPlatform: Partial<Record<PlatformKey, string>>;
    imageQuery: string;
    imagePrompt: string;
  };
  imageUrl: string | null;
  imageCredit: string | null;
  schedulings: Array<{
    platform: string;
    channelId: string;
    ok: boolean;
    error?: string;
  }>;
};

function CampaignCard({
  profiles,
  onSuccess,
  onError,
  referenceUrlsText,
  setReferenceUrlsText,
}: {
  profiles: BufferProfile[];
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  referenceUrlsText: string;
  setReferenceUrlsText: (v: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(3);
  const [dates, setDates] = useState<string[]>([]);
  const [referencePosts, setReferencePosts] = useState("");
  const [platforms, setPlatforms] = useState<Record<PlatformKey, boolean>>({
    linkedin: true,
    x: true,
    instagram: false,
  });
  const [selectedProfiles, setSelectedProfiles] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<CampaignResult[] | null>(null);
  const [autoSchedule, setAutoSchedule] = useState(false);

  useEffect(() => {
    const auto: Record<string, boolean> = {};
    for (const p of profiles) auto[p.id] = true;
    setSelectedProfiles(auto);
  }, [profiles]);

  // Auto-fill dates: today + 09:00, +2 days, +4 days etc.
  useEffect(() => {
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(Date.now() + (i + 1) * 86_400_000);
      d.setHours(9, 0, 0, 0);
      const pad = (n: number) => String(n).padStart(2, "0");
      out.push(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      );
    }
    setDates(out);
  }, [count]);

  async function run() {
    if (!topic.trim()) {
      onError("Topic required");
      return;
    }
    const selectedPlats = (Object.keys(platforms) as PlatformKey[]).filter(
      (p) => platforms[p]
    );
    if (selectedPlats.length === 0) {
      onError("Pick at least one platform");
      return;
    }
    const dueAts = dates.map((d) => new Date(d).toISOString());
    const profilesByPlatform: Partial<Record<PlatformKey, string[]>> = {};
    for (const p of selectedPlats) {
      const matching = profilesFor(profiles, p)
        .filter((bp) => selectedProfiles[bp.id])
        .map((bp) => bp.id);
      if (matching.length > 0) profilesByPlatform[p] = matching;
    }
    if (autoSchedule && Object.keys(profilesByPlatform).length === 0) {
      onError("Pick at least one Buffer profile per platform to auto-schedule");
      return;
    }

    setBusy(true);
    try {
      const r = await fetch("/api/admin/social/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          dueAts,
          platforms: selectedPlats,
          profilesByPlatform,
          referenceImageUrls: parseReferenceUrls(referenceUrlsText),
          referencePosts: referencePosts
            .split(/\n{2,}/)
            .map((s) => s.trim())
            .filter(Boolean),
          schedule: autoSchedule,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        onError(data.error || "Campaign failed");
        setBusy(false);
        return;
      }
      setResults(data.campaign as CampaignResult[]);
      const succ = (data.campaign as CampaignResult[]).filter((c) =>
        c.schedulings.every((s) => s.ok)
      ).length;
      onSuccess(
        autoSchedule
          ? `Campaign done — ${succ}/${data.campaign.length} fully scheduled`
          : `Drafts ready — ${data.campaign.length} posts generated`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Network error");
    }
    setBusy(false);
  }

  return (
    <div className="rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-500/[0.05] to-transparent p-5 space-y-4">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-3 text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-300 flex items-center justify-center shrink-0">
          <FiLayers size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[var(--admin-text)]">Campaign mode</h3>
          <p className="text-[11px] text-[var(--admin-text-secondary)] mt-1">
            One topic → N distinct posts across N days. Researches the topic,
            uses your reference images, generates posts + images, schedules
            them all on Buffer in one go.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-[var(--admin-text-secondary)] px-2 py-1">
          {expanded ? "Hide" : "Open"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 pt-2 border-t border-[var(--admin-border)]">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)] mb-1.5">
              Campaign topic
            </label>
            <textarea
              rows={2}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className={textareaClass}
              placeholder='e.g. "Why most SAP consultants miss the AI moment — and what to do about it"'
            />
          </div>

          <div className="grid sm:grid-cols-[140px_1fr] gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)] mb-1.5">
                Posts
              </label>
              <select
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value, 10))}
                className={inputClass + " text-sm"}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)] mb-1.5">
                Schedule for…
              </label>
              <div className="space-y-1.5">
                {dates.map((d, i) => (
                  <input
                    key={i}
                    type="datetime-local"
                    value={d}
                    onChange={(e) => {
                      const next = [...dates];
                      next[i] = e.target.value;
                      setDates(next);
                    }}
                    className={inputClass + " text-xs"}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)] mb-1.5">
              Platforms
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(platforms) as PlatformKey[]).map((p) => {
                const on = platforms[p];
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPlatforms((s) => ({ ...s, [p]: !s[p] }))}
                    className={`px-3 py-1.5 rounded-full text-xs border ${on ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700" : "bg-[var(--admin-input-bg)] border-[var(--admin-border)] text-[var(--admin-text-secondary)]"}`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)] mb-1.5">
              Buffer profiles to schedule on (across platforms)
            </label>
            <div className="flex flex-wrap gap-2">
              {profiles.length === 0 ? (
                <p className="text-[11px] text-[var(--admin-text-muted)]">
                  No Buffer profiles loaded. Connect Buffer + refresh.
                </p>
              ) : (
                profiles.map((p) => {
                  const on = !!selectedProfiles[p.id];
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() =>
                        setSelectedProfiles((s) => ({ ...s, [p.id]: !s[p.id] }))
                      }
                      className={`px-3 py-1.5 rounded-full text-xs border ${on ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700" : "bg-[var(--admin-input-bg)] border-[var(--admin-border)] text-[var(--admin-text-secondary)]"}`}
                    >
                      {p.formatted_username} ({p.service})
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)] mb-1.5">
              Reference posts (paste competitor posts so the writer emulates voice — separate with blank line)
            </label>
            <textarea
              rows={4}
              value={referencePosts}
              onChange={(e) => setReferencePosts(e.target.value)}
              className={textareaClass + " text-xs"}
              placeholder="Paste 1-6 posts you want it to learn the style from"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="auto-schedule"
              checked={autoSchedule}
              onChange={(e) => setAutoSchedule(e.target.checked)}
              className="w-4 h-4 accent-purple-500"
            />
            <label htmlFor="auto-schedule" className="text-xs text-[var(--admin-text-secondary)]">
              Auto-schedule on Buffer when generation finishes (otherwise just
              shows drafts)
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={run}
              disabled={busy}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 hover:scale-[1.02] disabled:opacity-60"
            >
              <FiZap size={14} />
              {busy ? "Running campaign…" : autoSchedule ? "Generate + schedule" : "Generate drafts"}
            </button>
          </div>

          {results && (
            <div className="space-y-3 pt-3 border-t border-[var(--admin-border)]">
              {results.map((r, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300">
                      Post {i + 1} · {new Date(r.post.date).toLocaleString()}
                    </span>
                    {r.schedulings.length > 0 && (
                      <span className="text-[10px] font-mono text-[var(--admin-text-muted)]">
                        {r.schedulings.filter((s) => s.ok).length}/{r.schedulings.length} scheduled
                      </span>
                    )}
                  </div>
                  {r.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={r.imageUrl}
                      alt={`Campaign post ${i + 1}`}
                      className="max-h-40 rounded-md border border-[var(--admin-border)]"
                    />
                  )}
                  {(Object.keys(r.post.perPlatform) as PlatformKey[]).map((p) => (
                    <div key={p} className="text-[12px] text-[var(--admin-text)]">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-secondary)]">
                        {p}
                      </span>
                      <p className="whitespace-pre-wrap mt-1 leading-relaxed">
                        {r.post.perPlatform[p]}
                      </p>
                    </div>
                  ))}
                  {r.schedulings.some((s) => !s.ok) && (
                    <div className="text-[10px] text-red-400">
                      {r.schedulings
                        .filter((s) => !s.ok)
                        .map((s) => `${s.platform}: ${s.error}`)
                        .join(" · ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Video to Post component ---- */

/* ---- Collapsible section wrapper ---- */

function CollapsibleCard({
  title,
  icon,
  open,
  onToggle,
  right,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 min-w-0 text-left"
        >
          <FiChevronDown
            size={14}
            className={`shrink-0 text-[var(--admin-text-muted)] transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
          />
          {icon}
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-secondary)]">
            {title}
          </span>
        </button>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

/* ---- Auto-post drip: upload a batch, post one/day to all platforms ---- */

type DripImage = {
  id: string;
  image_url: string;
  status: string;
  error: string | null;
  created_at: string;
  posted_at: string | null;
};

function DripPanel({
  onSuccess,
  onError,
}: {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<DripImage[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/social/drip");
      const j = await r.json();
      setImages(Array.isArray(j.images) ? j.images : []);
      setEnabled(!!j.enabled);
      setNeedsMigration(!!j.needsMigration);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pending = images.filter((i) => i.status === "pending");

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    const urls: string[] = [];
    let failedUploads = 0;
    for (const f of files) {
      try {
        const form = new FormData();
        form.append("file", f);
        form.append("kind", "social");
        const r = await fetch("/api/admin/upload", { method: "POST", body: form });
        const j = await r.json();
        if (r.ok && j.url) urls.push(j.url);
        else failedUploads++;
      } catch {
        failedUploads++;
      }
    }
    if (urls.length) {
      try {
        const r = await fetch("/api/admin/social/drip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", urls }),
        });
        const j = await r.json();
        if (r.ok) {
          onSuccess(
            `Added ${urls.length} image${urls.length > 1 ? "s" : ""}${failedUploads ? ` (${failedUploads} failed)` : ""}`
          );
          load();
        } else onError(j.error || "Could not add images");
      } catch {
        onError("Network error adding images");
      }
    } else {
      onError("No images could be uploaded");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    try {
      const r = await fetch("/api/admin/social/drip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", enabled: next }),
      });
      if (!r.ok) {
        setEnabled(!next);
        onError("Could not update the switch");
        return;
      }
      onSuccess(next ? "Daily auto-posting is ON" : "Daily auto-posting paused");
    } catch {
      setEnabled(!next);
      onError("Network error");
    }
  }

  async function remove(id: string) {
    setImages((imgs) => imgs.filter((i) => i.id !== id));
    try {
      await fetch("/api/admin/social/drip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", id }),
      });
    } catch {}
  }

  async function postNow() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/social/drip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "post-now" }),
      });
      const j = await r.json();
      const res = j.result;
      if (res?.processed && res?.ok) onSuccess("Posted the next image to all platforms");
      else if (res?.reason === "empty") onError("No pending images to post");
      else if (res?.reason === "no-buffer") onError("Buffer isn't configured");
      else if (res?.reason === "no-channels") onError("No connected LinkedIn/X/Instagram channels");
      else onError(res?.error || "Could not post — check the image list for errors");
      load();
    } catch {
      onError("Network error");
    }
    setBusy(false);
  }

  return (
    <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 min-w-0 text-left"
        >
          <FiChevronDown
            size={14}
            className={`shrink-0 text-[var(--admin-text-muted)] transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
          />
          <FiClock size={13} className="text-emerald-600" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-secondary)]">
            Auto-post · 1 image / day
          </span>
          {pending.length > 0 && (
            <span className="text-[10px] text-[var(--admin-text-muted)]">({pending.length} queued)</span>
          )}
        </button>
        <button
          type="button"
          onClick={toggle}
          title="Enable daily auto-posting"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
            enabled
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600"
              : "bg-[var(--admin-input-bg)] border-[var(--admin-border)] text-[var(--admin-text-muted)]"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-[var(--admin-text-muted)]"}`} />
          {enabled ? "On" : "Off"}
        </button>
      </div>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {needsMigration ? (
            <p className="text-[11px] text-amber-500 leading-relaxed">
              Run <code className="font-mono px-1 rounded bg-[var(--admin-input-bg)]">supabase/social_drip.sql</code> in
              Supabase once, then this feature activates.
            </p>
          ) : (
            <>
              <p className="text-[11px] text-[var(--admin-text-muted)] leading-relaxed">
                Upload a batch of images. Once a day the cron posts the next one to{" "}
                <span className="text-[var(--admin-text-secondary)]">all connected platforms</span>, writing a caption
                from the image automatically. Flip the switch to <span className="text-emerald-600">On</span> to start.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  <FiUploadCloud size={12} />
                  {uploading ? "Uploading…" : "Upload images"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={onFiles}
                />
                <button
                  type="button"
                  onClick={postNow}
                  disabled={busy || pending.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-xs text-[var(--admin-text-secondary)] hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-40"
                >
                  <FiZap size={12} />
                  {busy ? "Posting…" : "Post next now"}
                </button>
                <button
                  type="button"
                  onClick={load}
                  disabled={loading}
                  className="inline-flex items-center gap-1 text-[10px] text-[var(--admin-text-muted)] hover:text-emerald-600 ml-auto"
                >
                  <FiRefreshCw size={10} className={loading ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>
              {images.length === 0 ? (
                <p className="text-[11px] text-[var(--admin-text-muted)] py-3 text-center">
                  {loading ? "Loading…" : "No images yet. Upload 20–30 to drip out one per day."}
                </p>
              ) : (
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                  {images.map((img) => (
                    <div
                      key={img.id}
                      className="relative group aspect-square rounded-lg overflow-hidden border border-[var(--admin-border)]"
                      title={img.error || img.status}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                      <span
                        className={`absolute top-1 left-1 w-2 h-2 rounded-full ring-1 ring-black/40 ${
                          img.status === "posted"
                            ? "bg-emerald-500"
                            : img.status === "failed"
                              ? "bg-red-500"
                              : "bg-amber-400"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => remove(img.id)}
                        className="absolute top-1 right-1 p-0.5 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500/80"
                        title="Remove"
                      >
                        <FiTrash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-[var(--admin-text-muted)] flex flex-wrap gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> pending
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> posted
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> failed
                </span>
                <span>· runs daily ~12:00 UTC</span>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function VideoToPost({ onGenerated }: {
  onGenerated: (data: { summary?: string; linkedin?: string; twitter?: string; instagram?: string; imageUrl?: string }) => void;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ title: string; channel: string; source: string } | null>(null);

  async function process() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/admin/video-to-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "Failed to process video");
        setLoading(false);
        return;
      }
      setResult({ title: j.title, channel: j.channel, source: j.source });
      onGenerated({
        summary: j.posts?.suggested_title || j.posts?.summary || j.title,
        linkedin: j.posts?.linkedin || "",
        twitter: j.posts?.twitter || "",
        instagram: j.posts?.instagram || "",
        imageUrl: j.cloudinaryUrl || j.thumbnail || "",
      });
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  return (
    <div className="rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <FiExternalLink size={12} className="text-emerald-600 shrink-0" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-secondary)]">
          Video to Post
        </span>
      </div>
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste YouTube or Instagram URL..."
          className="flex-1 px-3 py-2 rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-xs text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-emerald-500"
          onKeyDown={(e) => { if (e.key === "Enter") process(); }}
        />
        <button
          type="button"
          onClick={process}
          disabled={loading || !url.trim()}
          className="px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-600 hover:bg-emerald-500/25 disabled:opacity-40"
        >
          {loading ? "Reading..." : "Generate Posts"}
        </button>
      </div>
      {error && <p className="text-[10px] text-red-400">{error}</p>}
      {result && (
        <p className="text-[10px] text-emerald-600">
          Generated from {result.source}: "{result.title}" by {result.channel}. Posts filled below.
        </p>
      )}
    </div>
  );
}

/* ---- AI Rewrite toolbar for each platform post ---- */

function PostRewriteBar({ text, platform, onChange }: {
  text: string;
  platform: string;
  onChange: (v: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");

  async function rewrite(instruction: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/social-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, instruction, platform }),
      });
      const j = await r.json();
      if (j.rewritten) onChange(j.rewritten);
    } catch {}
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {[
        { key: "shorter", label: "Shorter" },
        { key: "hookline", label: "Hook line" },
        { key: "storytelling", label: "Story" },
        { key: "controversial", label: "Hot take" },
        { key: "cta", label: "Add CTA" },
        { key: "casual", label: "Warmer" },
      ].map((btn) => (
        <button
          key={btn.key}
          type="button"
          disabled={busy}
          onClick={() => rewrite(btn.key)}
          className="px-2 py-0.5 rounded text-[10px] text-[var(--admin-text-secondary)] hover:text-emerald-600 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30 disabled:opacity-40 transition-colors"
        >
          {btn.label}
        </button>
      ))}
      {busy && <span className="text-[9px] text-emerald-600/60 animate-pulse ml-1">rewriting...</span>}
    </div>
  );
}

/* ---- Queue management panel ---- */

type QueueRow = {
  id: string;
  text: string;
  platform: string;
  channel_id: string;
  channel_name: string | null;
  image_url: string | null;
  due_at: string;
  status: "pending" | "sent" | "failed";
  error: string | null;
  created_at: string;
  sent_at: string | null;
};

function QueuePanel({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/social/queue");
      const j = await r.json();
      if (Array.isArray(j.queue)) setRows(j.queue);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [open]);

  async function act(action: "delete" | "post-now", id: string) {
    setActing(id);
    try {
      const r = await fetch("/api/admin/social/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      const j = await r.json();
      if (!r.ok) {
        onError(j.error || "Action failed");
      } else {
        onSuccess(action === "delete" ? "Removed from queue" : "Posted now");
        load();
      }
    } catch {
      onError("Network error");
    }
    setActing(null);
  }

  const pending = rows.filter((r) => r.status === "pending");
  const sent = rows.filter((r) => r.status === "sent");
  const failed = rows.filter((r) => r.status === "failed");

  const platformIcon: Record<string, string> = {
    linkedin: "LI",
    x: "X",
    instagram: "IG",
  };

  const statusColors: Record<string, string> = {
    pending: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    sent: "text-emerald-600 bg-emerald-400/10 border-emerald-400/20",
    failed: "text-red-400 bg-red-400/10 border-red-400/20",
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiClock size={14} className="text-emerald-600" />
          <h3 className="font-semibold text-sm">Queue ({pending.length} pending)</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] disabled:opacity-50"
          >
            <FiRefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={() => {
              fetch("/api/admin/social/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "process-due" }),
              }).then(() => { load(); onSuccess("Processed due posts"); });
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-emerald-600 hover:bg-emerald-400/10"
          >
            <FiSend size={10} />
            Process due
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-[var(--admin-text-muted)] py-3 text-center">No queued posts.</p>
      ) : (
        <ul className="divide-y divide-white/[0.05] max-h-[240px] overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id} className="py-2 first:pt-0 last:pb-0 flex items-start gap-2">
              <span className="shrink-0 text-[10px] font-bold font-mono mt-0.5 w-5 text-center">
                {platformIcon[row.platform] || row.platform}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-[var(--admin-text)] line-clamp-1">{row.text.slice(0, 80)}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`px-1 py-px rounded text-[8px] font-bold uppercase border ${statusColors[row.status]}`}>
                    {row.status}
                  </span>
                  <span className="text-[9px] text-[var(--admin-text-muted)] font-mono">
                    {new Date(row.due_at).toLocaleString()}
                  </span>
                </div>
              </div>
              {(row.status === "pending" || row.status === "failed") && (
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => act("post-now", row.id)} disabled={acting === row.id}
                    className="p-1 rounded text-emerald-600 hover:bg-emerald-400/10 disabled:opacity-40" title="Post now">
                    <FiSend size={10} />
                  </button>
                  <button type="button" onClick={() => act("delete", row.id)} disabled={acting === row.id}
                    className="p-1 rounded text-red-400 hover:bg-red-400/10 disabled:opacity-40" title="Delete">
                    <FiTrash2 size={10} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---- Drafts panel ---- */

function DraftsPanel({
  drafts,
  loadedDraftId,
  onLoad,
  onDelete,
  onNew,
}: {
  drafts: Draft[];
  loadedDraftId: string | null;
  onLoad: (d: Draft) => void;
  onDelete: (id: string) => void;
  onNew?: () => void;
}) {
  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiFolder size={14} className="text-emerald-600" />
          <h3 className="font-semibold text-sm">Drafts</h3>
        </div>
        {onNew && (
          <button type="button" onClick={onNew} className="text-[10px] text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)]">
            + New
          </button>
        )}
      </div>
      {drafts.length === 0 ? (
        <p className="text-xs text-[var(--admin-text-muted)] py-3 text-center">No saved drafts.</p>
      ) : (
        <ul className="divide-y divide-white/[0.05] max-h-[240px] overflow-y-auto">
          {drafts.map((d) => (
            <li key={d.id} className="py-2 first:pt-0 last:pb-0 flex items-center gap-2">
              <button type="button" onClick={() => onLoad(d)} className="flex-1 text-left min-w-0">
                <p className="text-[11px] text-[var(--admin-text)] truncate">
                  {shortPreview(d.topic) || shortPreview(d.composition.linkedin) || "(untitled)"}
                </p>
                <span className="text-[9px] text-[var(--admin-text-muted)] font-mono">
                  {timeAgo(d.savedAt)}
                  {d.composition.linkedin ? " · LI" : ""}
                  {d.composition.x ? " · X" : ""}
                  {d.composition.instagram ? " · IG" : ""}
                  {loadedDraftId === d.id ? " · editing" : ""}
                </span>
              </button>
              <button type="button" onClick={() => onDelete(d.id)}
                className="p-1 rounded text-[var(--admin-text-muted)] hover:text-red-400 hover:bg-red-400/10 shrink-0">
                <FiTrash2 size={10} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
