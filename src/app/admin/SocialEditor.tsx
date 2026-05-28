"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "react-icons/fi";
import { FaXTwitter, FaLinkedinIn, FaInstagram } from "react-icons/fa6";

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
};

type BufferProfile = {
  id: string;
  service: string;
  formatted_username: string;
  formatted_service: string;
  avatar?: string;
};

const EMPTY: Composition = { linkedin: "", x: "", instagram: "", image_query: "" };

const inputClass =
  "w-full px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none text-sm text-white placeholder:text-[#555] transition-colors";
const textareaClass = inputClass + " resize-y leading-relaxed";

/** Filter Buffer profiles for one of our 3 platforms. */
function profilesFor(all: BufferProfile[], key: PlatformKey): BufferProfile[] {
  return all.filter((bp) =>
    key === "linkedin"
      ? bp.service === "linkedin"
      : key === "x"
      ? bp.service === "twitter" || bp.service === "x"
      : bp.service === "instagram"
  );
}

/** Initial "now-ish" datetime-local string (rounded up 10 min). */
function defaultScheduleAt(): string {
  const d = new Date(Date.now() + 10 * 60 * 1000);
  // toISOString gives UTC; datetime-local needs local — re-derive.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  const [imageUrl, setImageUrl] = useState("");
  const [imageCredit, setImageCredit] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageProvider, setImageProvider] = useState<"auto" | "fal" | "unsplash">("auto");
  const [generating, setGenerating] = useState(false);

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

  useEffect(() => {
    fetch("/api/admin/buffer/profiles")
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (ok && Array.isArray(data.profiles)) {
          setProfiles(data.profiles);
        } else if (data.error) {
          setProfilesError(data.error);
        }
      });
  }, []);

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
        body: JSON.stringify({ topic, hint }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || "Compose failed");
        setComposing(false);
        return;
      }
      setComposition({
        linkedin: data.linkedin ?? "",
        x: data.x ?? "",
        instagram: data.instagram ?? "",
        image_query: data.image_query ?? "",
      });
      if (!imagePrompt.trim() && data.image_query) setImagePrompt(data.image_query);
      onSuccess("Posts drafted");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Network error");
    }
    setComposing(false);
  }

  async function generateImage(aspect: "square" | "landscape" = "landscape") {
    const prompt = imagePrompt.trim() || composition.image_query;
    if (!prompt) {
      onError("Need an image prompt or a generated topic first");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, provider: imageProvider, aspect }),
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
    if (d.getTime() < Date.now() + 60 * 1000) return null; // must be in the future
    return d.toISOString();
  }

  /** Per-platform post. */
  async function postOne(
    key: PlatformKey,
    when: "now" | "queue" | string
  ): Promise<{ ok: boolean; error?: string }> {
    const p = PLATFORMS.find((x) => x.key === key)!;
    const text = composition[key];
    const ids = profilesFor(profiles, key)
      .filter((bp) => selected[bp.id])
      .map((bp) => bp.id);
    if (ids.length === 0) {
      return { ok: false, error: `No ${p.label} profile selected` };
    }
    if (!text.trim()) return { ok: false, error: `${p.label} text is empty` };
    if (text.length > p.limit)
      return { ok: false, error: `${p.label} over character limit` };
    const res = await fetch("/api/admin/buffer/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        profile_ids: ids,
        media_url: imageUrl || undefined,
        when,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `${p.label} post failed` };
    return { ok: true };
  }

  /** Selected platforms = platforms with at least one selected profile + non-empty text. */
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
      onSuccess(
        `${verb} ${results.map((r) => r.k).join(", ")}`
      );
    } else if (failed.length === results.length) {
      onError(failed.map((r) => `${r.k}: ${r.error}`).join(" · "));
    } else {
      onError(
        `Partial: ${failed.map((r) => `${r.k}: ${r.error}`).join(" · ")}`
      );
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Social</h2>
        <p className="text-xs text-[#666] mt-1">
          Drop a topic, generate platform-native posts with Groq, attach an image,
          then push to LinkedIn / X / Instagram through Buffer.
        </p>
      </div>

      {/* Topic + compose */}
      <div className="rounded-2xl border border-[#ff6b00]/20 bg-gradient-to-br from-[#ff6b00]/[0.05] to-transparent p-5 space-y-3">
        <label className="block text-xs font-mono tracking-[0.15em] uppercase text-[#ff8c38]">
          Topic
        </label>
        <textarea
          rows={3}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className={textareaClass}
          placeholder="e.g. Why most SAP consultants miss the AI moment — and how to catch it"
        />
        <input
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          className={inputClass}
          placeholder="Optional voice hint (e.g. 'punchier', 'frame as a lesson', 'tell a quick story')"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={compose}
            disabled={composing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_4px_20px_rgba(255,107,0,0.4)] hover:scale-[1.02] disabled:opacity-60"
          >
            <FiZap size={14} />
            {composing ? "Drafting…" : "Generate posts"}
          </button>
        </div>
      </div>

      {/* Image generator */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="text-xs font-mono tracking-[0.15em] uppercase text-[#888]">
            Image
          </label>
          <div className="flex items-center gap-2">
            <select
              value={imageProvider}
              onChange={(e) =>
                setImageProvider(e.target.value as "auto" | "fal" | "unsplash")
              }
              className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs text-[#ccc] focus:outline-none"
            >
              <option value="auto">Auto (fal.ai → Unsplash)</option>
              <option value="fal">fal.ai (Flux)</option>
              <option value="unsplash">Unsplash search</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            className={inputClass}
            placeholder={
              composition.image_query
                ? `Suggested: ${composition.image_query}`
                : "Concrete subject (e.g. 'highway sunset', 'trader at desk')"
            }
          />
          <button
            type="button"
            onClick={() => generateImage("landscape")}
            disabled={generating}
            className="shrink-0 inline-flex items-center gap-2 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm hover:border-[#ff6b00]/40 hover:text-[#ff6b00] disabled:opacity-60"
          >
            <FiImage size={14} />
            {generating ? "…" : "Generate"}
          </button>
        </div>

        {imageUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-white/[0.06] bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Generated"
              className="w-full max-h-72 object-contain bg-black"
            />
            {imageCredit && (
              <p className="absolute bottom-2 left-2 text-[10px] text-white/80 bg-black/50 px-2 py-0.5 rounded font-mono">
                {imageCredit}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setImageUrl("");
                setImageCredit(null);
              }}
              className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/60 text-white text-[10px] hover:bg-black/80"
            >
              Clear
            </button>
          </div>
        ) : null}

        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className={inputClass + " text-xs font-mono"}
          placeholder="Or paste an image URL"
        />
      </div>

      {/* Platform cards */}
      <div className="space-y-4">
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

      {/* Batch footer */}
      {!profilesError && profiles.length > 0 && (
        <div className="rounded-2xl border border-[#ff6b00]/25 bg-gradient-to-br from-[#ff6b00]/[0.05] to-transparent p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <FiLayers size={14} className="text-[#ff8c38]" />
            <h3 className="text-sm font-bold tracking-wide uppercase text-[#ff8c38]">
              Post to all platforms at once
            </h3>
            <span className="text-[10px] text-[#666] ml-auto font-mono">
              ready: {readyPlatforms.length}/3
              {readyPlatforms.length > 0
                ? ` (${readyPlatforms.join(", ")})`
                : ""}
            </span>
          </div>
          <p className="text-[11px] text-[#777] leading-relaxed">
            Runs once per platform with that platform's text + the shared image,
            using whichever Buffer profiles you've selected on each card.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex-1 flex items-center gap-2">
              <FiCalendar size={13} className="text-[#888] shrink-0" />
              <input
                type="datetime-local"
                value={batchScheduleAt}
                onChange={(e) => setBatchScheduleAt(e.target.value)}
                className={inputClass + " text-xs"}
              />
              <button
                type="button"
                onClick={() => setBatchScheduleAt(defaultScheduleAt())}
                className="shrink-0 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-[10px] text-[#888] hover:text-white"
                title="Set to ~10 minutes from now"
              >
                +10m
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => batchPost("queue")}
              disabled={batchBusy || readyPlatforms.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs hover:border-[#ff6b00]/40 hover:text-[#ff6b00] disabled:opacity-50"
            >
              <FiClock size={12} />
              Queue all
            </button>
            <button
              type="button"
              onClick={() => {
                const iso = toIso(batchScheduleAt);
                if (!iso) {
                  onError(
                    "Pick a future date/time to schedule all platforms"
                  );
                  return;
                }
                batchPost(iso);
              }}
              disabled={batchBusy || readyPlatforms.length === 0 || !batchScheduleAt}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.15] text-xs hover:border-[#ff6b00]/40 hover:text-[#ff6b00] disabled:opacity-50"
            >
              <FiCalendar size={12} />
              Schedule all
            </button>
            <button
              type="button"
              onClick={() => batchPost("now")}
              disabled={batchBusy || readyPlatforms.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black text-xs font-bold shadow-[0_4px_15px_rgba(255,107,0,0.35)] hover:scale-[1.03] disabled:opacity-50"
            >
              <FiSend size={12} />
              {batchBusy ? "Posting…" : "Post all now"}
            </button>
          </div>
        </div>
      )}

      {/* Footer help */}
      {profilesError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-300/90">
          <strong className="font-semibold">Buffer not connected.</strong>{" "}
          Add a <code>buffer</code> connector (id <code>buffer</code>) with your{" "}
          Buffer access token under <strong>Admin → Connectors</strong>, then
          reload this page. You can still copy generated text to clipboard
          without Buffer.
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
    const ids = profiles.filter((p) => selectedIds[p.id]).map((p) => p.id);
    if (ids.length === 0) {
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
    const res = await fetch("/api/admin/buffer/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        profile_ids: ids,
        media_url: imageUrl || undefined,
        when,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPosting(false);
    if (!res.ok) {
      onError(data.error || "Post failed");
      return;
    }
    onSuccess(
      when === "now"
        ? `Posted to ${platform.label} now`
        : when === "queue"
        ? `Queued on ${platform.label}`
        : `Scheduled on ${platform.label}`
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: platform.color + "22", color: platform.color === "#ffffff" ? "#fff" : platform.color }}
          >
            <Icon size={16} />
          </div>
          <h3 className="font-bold text-white">{platform.label}</h3>
        </div>
        <span
          className={`text-xs font-mono ${
            overLimit ? "text-red-400" : used > platform.limit * 0.9 ? "text-amber-400" : "text-[#666]"
          }`}
        >
          {used} / {platform.limit}
        </span>
      </div>
      <textarea
        rows={platform.key === "x" ? 4 : 7}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        className={textareaClass}
        placeholder={`Generated ${platform.label} post will appear here…`}
      />

      {/* Buffer profile picker */}
      {!profilesError && (
        <div className="mt-3">
          {profiles.length === 0 ? (
            <p className="text-[10px] text-[#555]">
              No {platform.label} profile found in your Buffer account.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profiles.map((p) => {
                const on = !!selectedIds[p.id];
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => onToggleProfile(p.id)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-colors ${
                      on
                        ? "bg-[#ff6b00]/15 border-[#ff6b00]/40 text-[#ff8c38]"
                        : "bg-white/[0.04] border-white/[0.08] text-[#999] hover:border-[#ff6b00]/30"
                    }`}
                  >
                    {on ? <FiCheck size={11} /> : null}
                    {p.formatted_username}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Per-platform schedule picker */}
      {!profilesError && profiles.length > 0 && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <FiCalendar size={12} className="text-[#666] shrink-0" />
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#0f0f0f] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none text-xs text-white"
          />
          <button
            type="button"
            onClick={() => {
              const d = new Date(Date.now() + 10 * 60 * 1000);
              const pad = (n: number) => String(n).padStart(2, "0");
              setScheduleAt(
                `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
              );
            }}
            className="shrink-0 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-[10px] text-[#888] hover:text-white"
            title="Set to ~10 minutes from now"
          >
            +10m
          </button>
          <button
            type="button"
            onClick={() => {
              const iso = toIso(scheduleAt);
              if (!iso) {
                onError(`Pick a future date/time to schedule ${platform.label}`);
                return;
              }
              postNow(iso);
            }}
            disabled={posting || overLimit || !scheduleAt}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.15] text-xs hover:border-[#ff6b00]/40 hover:text-[#ff6b00] disabled:opacity-50"
          >
            <FiCalendar size={11} />
            Schedule
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-4 flex-wrap">
        <button
          type="button"
          onClick={copy}
          disabled={!text}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs hover:border-[#ff6b00]/40 hover:text-[#ff6b00] disabled:opacity-50"
        >
          {copied ? <FiCheck size={11} /> : <FiCopy size={11} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={
            platform.key === "linkedin"
              ? "https://www.linkedin.com/feed/"
              : platform.key === "x"
              ? "https://x.com/compose/post"
              : "https://www.instagram.com/"
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs hover:border-[#ff6b00]/40 hover:text-[#ff6b00]"
        >
          <FiExternalLink size={11} />
          Open {platform.label}
        </a>
        {!profilesError && profiles.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => postNow("queue")}
              disabled={posting}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs hover:border-[#ff6b00]/40 hover:text-[#ff6b00] disabled:opacity-60"
            >
              <FiClock size={11} />
              Queue
            </button>
            <button
              type="button"
              onClick={() => postNow("now")}
              disabled={posting || overLimit}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black text-xs font-semibold shadow-[0_4px_15px_rgba(255,107,0,0.35)] hover:scale-[1.03] disabled:opacity-60"
            >
              <FiSend size={11} />
              Post now
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// silence unused import in some bundlers
void FiRefreshCw;
