"use client";

import { useState, useEffect } from "react";
import {
  FiPlay,
  FiRefreshCw,
  FiX,
  FiPlus,
  FiTrash2,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
} from "react-icons/fi";

type Settings = {
  enabled: boolean;
  platforms: string[];
  channel_ids: string[];
  post_types: string[];
  topics: string[];
  post_time: string;
  timezone: string;
  last_posted_on: string | null;
};

type LogEntry = {
  id: string;
  topic: string;
  platforms_posted: string[];
  post_type: string;
  image_url: string | null;
  posts: Record<string, string> | null;
  created_at: string;
};

type Channel = {
  id: string;
  name: string;
  service: string;
  displayName: string;
  isDisconnected: boolean;
};

const PLATFORMS = [
  { id: "linkedin", label: "LinkedIn", color: "text-blue-400" },
  { id: "x", label: "X", color: "text-[#999]" },
  { id: "instagram", label: "Instagram", color: "text-pink-400" },
];

const POST_TYPES = [
  { id: "text", label: "Text only", desc: "Plain text post" },
  { id: "image", label: "Image + text", desc: "Unsplash image with caption" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "Asia/Kolkata",
  "Europe/London",
  "UTC",
];

type Props = {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
};

export default function AutopilotPanel({ onSuccess, onError }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [channelMode, setChannelMode] = useState<"all" | "pick">("all");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [settingsRes, channelsRes] = await Promise.all([
      fetch("/api/admin/social/autopilot").then((r) => r.json()).catch(() => ({})),
      fetch("/api/admin/buffer/profiles").then((r) => r.json()).catch(() => ({ channels: [] })),
    ]);
    setSettings(settingsRes.settings ?? null);
    setLog(settingsRes.log ?? []);
    const ch = (channelsRes.channels ?? channelsRes ?? []) as Channel[];
    setChannels(ch);
    if (settingsRes.settings?.channel_ids?.length > 0) setChannelMode("pick");
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(patch: Partial<Settings>) {
    setSaving(true);
    const r = await fetch("/api/admin/social/autopilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", ...patch }),
    });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (d.settings) {
      setSettings(d.settings);
      onSuccess("Autopilot settings saved");
    } else {
      onError(d.error || "Save failed");
    }
  }

  async function runNow() {
    setRunning(true);
    const r = await fetch("/api/admin/social/autopilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run-now" }),
    });
    const d = await r.json().catch(() => ({}));
    setRunning(false);
    if (d.posted) {
      onSuccess(`Posted "${d.topic}" to ${d.platforms.join(", ")}`);
      await load();
    } else {
      onError(d.reason || d.error || "Autopilot run failed");
    }
  }

  function addTopic() {
    if (!newTopic.trim() || !settings) return;
    const updated = [...settings.topics, newTopic.trim()];
    setNewTopic("");
    save({ topics: updated });
  }

  function removeTopic(idx: number) {
    if (!settings) return;
    const updated = settings.topics.filter((_, i) => i !== idx);
    save({ topics: updated });
  }

  function togglePlatform(plat: string) {
    if (!settings) return;
    const current = settings.platforms;
    const updated = current.includes(plat)
      ? current.filter((p) => p !== plat)
      : [...current, plat];
    if (updated.length === 0) return;
    save({ platforms: updated });
  }

  function togglePostType(pt: string) {
    if (!settings) return;
    const current = settings.post_types;
    const updated = current.includes(pt)
      ? current.filter((p) => p !== pt)
      : [...current, pt];
    if (updated.length === 0) return;
    save({ post_types: updated });
  }

  function toggleChannel(id: string) {
    if (!settings) return;
    const current = settings.channel_ids;
    const updated = current.includes(id)
      ? current.filter((c) => c !== id)
      : [...current, id];
    save({ channel_ids: updated });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FiRefreshCw size={20} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12 space-y-3">
        <FiAlertCircle size={24} className="mx-auto text-amber-400" />
        <p className="text-sm text-[var(--admin-text-muted)]">
          Autopilot table not found. Run <code className="text-emerald-400">supabase/social_autopilot.sql</code> first.
        </p>
      </div>
    );
  }

  const svcMap: Record<string, string> = { linkedin: "linkedin", twitter: "x", x: "x", instagram: "instagram" };

  return (
    <div className="space-y-6">
      {/* Header + toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--admin-text)] flex items-center gap-2">
            <FiPlay size={16} className="text-emerald-500" /> Social Autopilot
          </h2>
          <p className="text-xs text-[var(--admin-text-muted)] mt-1">
            AI posts once per day — picks topics, writes platform-native content, finds images.
          </p>
        </div>
        <button
          onClick={() => save({ enabled: !settings.enabled })}
          disabled={saving}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            settings.enabled ? "bg-emerald-500" : "bg-[var(--admin-border)]"
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              settings.enabled ? "translate-x-6" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Schedule */}
      <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
          <FiClock size={12} className="inline mr-1" /> Schedule
        </h3>
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider">Post time</label>
            <input
              type="time"
              value={settings.post_time}
              onChange={(e) => save({ post_time: e.target.value })}
              className="mt-1 block px-3 py-2 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider">Timezone</label>
            <select
              value={settings.timezone}
              onChange={(e) => save({ timezone: e.target.value })}
              className="mt-1 block px-3 py-2 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-emerald-500 focus:outline-none"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          {settings.last_posted_on && (
            <div className="self-end text-xs text-[var(--admin-text-muted)]">
              Last posted: {settings.last_posted_on}
            </div>
          )}
        </div>
      </div>

      {/* Platforms */}
      <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
          Platforms
        </h3>
        <div className="flex gap-2 flex-wrap">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => togglePlatform(p.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                settings.platforms.includes(p.id)
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                  : "bg-[var(--admin-surface-hover)] border-[var(--admin-border)] text-[var(--admin-text-muted)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Channel picker */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <label className="text-[10px] uppercase text-[var(--admin-text-muted)] tracking-wider">Accounts</label>
            <div className="flex gap-2">
              <button
                onClick={() => { setChannelMode("all"); save({ channel_ids: [] }); }}
                className={`px-2.5 py-1 rounded-full text-[11px] border ${
                  channelMode === "all"
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                    : "bg-[var(--admin-surface-hover)] border-[var(--admin-border)] text-[var(--admin-text-muted)]"
                }`}
              >
                All accounts
              </button>
              <button
                onClick={() => setChannelMode("pick")}
                className={`px-2.5 py-1 rounded-full text-[11px] border ${
                  channelMode === "pick"
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                    : "bg-[var(--admin-surface-hover)] border-[var(--admin-border)] text-[var(--admin-text-muted)]"
                }`}
              >
                Pick accounts
              </button>
            </div>
          </div>

          {channelMode === "pick" && channels.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {channels
                .filter((c) => !c.isDisconnected)
                .filter((c) => {
                  const svc = svcMap[c.service.toLowerCase()];
                  return svc && settings.platforms.includes(svc);
                })
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggleChannel(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      settings.channel_ids.includes(c.id)
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                        : "bg-[var(--admin-surface-hover)] border-[var(--admin-border)] text-[var(--admin-text-muted)]"
                    }`}
                  >
                    {c.displayName || c.name} ({c.service})
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Post types */}
      <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
          Post types
        </h3>
        <div className="flex gap-2 flex-wrap">
          {POST_TYPES.map((pt) => (
            <button
              key={pt.id}
              onClick={() => togglePostType(pt.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                settings.post_types.includes(pt.id)
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                  : "bg-[var(--admin-surface-hover)] border-[var(--admin-border)] text-[var(--admin-text-muted)]"
              }`}
            >
              {pt.label}
              <span className="block text-[10px] mt-0.5 opacity-70">{pt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Topics */}
      <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
            Topics <span className="normal-case font-normal">(leave empty to auto-pick from Ideas)</span>
          </h3>
        </div>

        {settings.topics.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {settings.topics.map((t, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-xs text-[var(--admin-text)]"
              >
                {t}
                <button
                  onClick={() => removeTopic(i)}
                  className="text-[var(--admin-text-muted)] hover:text-red-400"
                >
                  <FiX size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addTopic(); }}
            placeholder="Add a topic (e.g. AI replacing jobs, Side hustle mistakes)..."
            className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:border-emerald-500 focus:outline-none placeholder:text-[var(--admin-text-muted)]"
          />
          <button
            onClick={addTopic}
            disabled={!newTopic.trim()}
            className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 disabled:opacity-50 flex items-center gap-1.5"
          >
            <FiPlus size={14} /> Add
          </button>
        </div>

        <p className="text-[10px] text-[var(--admin-text-muted)]">
          If empty, the agent picks from your Ideas inbox or generates trending topics based on your content profile and analytics.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={runNow}
          disabled={running}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
        >
          {running ? (
            <><FiRefreshCw size={14} className="animate-spin" /> Generating &amp; posting...</>
          ) : (
            <><FiPlay size={14} /> Post now</>
          )}
        </button>
        <button
          onClick={load}
          className="px-4 py-2.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm text-[var(--admin-text-muted)] hover:border-emerald-500"
        >
          <FiRefreshCw size={14} />
        </button>
      </div>

      {/* Recent posts log */}
      {log.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
            Recent autopilot posts
          </h3>
          <div className="space-y-2">
            {log.map((entry) => (
              <div
                key={entry.id}
                className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4 cursor-pointer hover:border-emerald-500/30 transition-colors"
                onClick={() => setExpandedLog(expandedLog === entry.id ? null : entry.id)}
              >
                <div className="flex items-center gap-3">
                  <FiCheckCircle size={14} className="text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--admin-text)] truncate">{entry.topic}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {entry.platforms_posted.map((p) => (
                        <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {p}
                        </span>
                      ))}
                      <span className="text-[10px] text-[var(--admin-text-muted)]">{entry.post_type}</span>
                      {entry.image_url && <span className="text-[10px] text-[var(--admin-text-muted)]">+ image</span>}
                    </div>
                  </div>
                  <span className="text-[10px] text-[var(--admin-text-muted)] shrink-0">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </span>
                </div>

                {expandedLog === entry.id && entry.posts && (
                  <div className="mt-3 space-y-3 border-t border-[var(--admin-border)] pt-3">
                    {Object.entries(entry.posts).map(([platform, text]) => (
                      <div key={platform}>
                        <p className="text-[10px] uppercase text-emerald-400 font-bold tracking-wider mb-1">{platform}</p>
                        <p className="text-xs text-[var(--admin-text-muted)] whitespace-pre-wrap leading-relaxed">{text}</p>
                      </div>
                    ))}
                    {entry.image_url && (
                      <div>
                        <p className="text-[10px] uppercase text-[var(--admin-text-muted)] font-bold tracking-wider mb-1">Image</p>
                        <img src={entry.image_url} alt="" className="w-40 h-24 object-cover rounded-lg" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
