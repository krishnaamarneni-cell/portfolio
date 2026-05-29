"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FiBriefcase,
  FiFolder,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiLogOut,
  FiArrowLeft,
  FiExternalLink,
  FiSave,
  FiX,
  FiUpload,
  FiLayout,
  FiZap,
  FiActivity,
  FiLink,
  FiMessageSquare,
  FiShare2,
  FiBarChart2,
  FiCpu,
  FiHeart,
} from "react-icons/fi";
import {
  EMPTY_JOB,
  EMPTY_PROJECT,
  type Job,
  type JobInput,
  type Project,
  type ProjectInput,
} from "@/lib/content-types";
import type { SiteContent } from "@/lib/site-content-types";
import SiteContentEditor from "./SiteContentEditor";
import ThoughtsEditor from "./ThoughtsEditor";
import ConnectorsEditor from "./ConnectorsEditor";
import AdminChat from "./AdminChat";
import SocialEditor from "./SocialEditor";
import SocialAnalytics from "./SocialAnalytics";
import AgentsTab from "./AgentsTab";
import PersonalTab from "./PersonalTab";
import MobileBottomNav, { tabLabel } from "./MobileBottomNav";

type Tab =
  | "content"
  | "thoughts"
  | "jobs"
  | "projects"
  | "social"
  | "analytics"
  | "agents"
  | "personal"
  | "connectors"
  | "chat";

type Props = {
  session: { email: string };
  initialJobs: Job[];
  initialProjects: Project[];
  initialSiteContent: SiteContent;
};

export default function AdminDashboard({
  session,
  initialJobs,
  initialProjects,
  initialSiteContent,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Default to Chat — it's the daily-touch surface. Old default was Site
  // Content which is something you edit rarely.
  const [tab, setTab] = useState<Tab>("chat");

  // PWA shortcuts pass ?tab=personal etc. — sync URL → state on mount and
  // whenever the user lands here from a deep link.
  useEffect(() => {
    const t = searchParams.get("tab");
    if (
      t === "content" ||
      t === "thoughts" ||
      t === "jobs" ||
      t === "projects" ||
      t === "social" ||
      t === "analytics" ||
      t === "agents" ||
      t === "personal" ||
      t === "connectors" ||
      t === "chat"
    ) {
      setTab(t);
    }
  }, [searchParams]);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [siteContent, setSiteContent] = useState<SiteContent>(initialSiteContent);
  const [editingJob, setEditingJob] = useState<Job | "new" | null>(null);
  const [editingProject, setEditingProject] = useState<Project | "new" | null>(
    null
  );
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(
    null
  );

  const fallbackVisible = useMemo(
    () => jobs.some((j) => j.id.startsWith("seed-")),
    [jobs]
  );

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  async function refresh() {
    const [j, p] = await Promise.all([
      fetch("/api/jobs").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ]);
    if (Array.isArray(j.jobs)) setJobs(j.jobs);
    if (Array.isArray(p.projects)) setProjects(p.projects);
  }

  async function saveJob(input: JobInput, id?: string) {
    const url = id ? `/api/jobs/${id}` : "/api/jobs";
    const method = id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      flash("err", data.error || "Save failed");
      return false;
    }
    flash("ok", id ? "Job updated" : "Job added");
    await refresh();
    return true;
  }

  async function removeJob(id: string) {
    if (id.startsWith("seed-")) {
      flash(
        "err",
        "This is fallback seed data, not a real DB row. Save a new job to start using Supabase."
      );
      return;
    }
    if (!confirm("Delete this job?")) return;
    const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      flash("err", data.error || "Delete failed");
      return;
    }
    flash("ok", "Job deleted");
    await refresh();
  }

  async function saveProject(input: ProjectInput, id?: string) {
    const url = id ? `/api/projects/${id}` : "/api/projects";
    const method = id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      flash("err", data.error || "Save failed");
      return false;
    }
    flash("ok", id ? "Project updated" : "Project added");
    await refresh();
    return true;
  }

  async function removeProject(id: string) {
    if (id.startsWith("seed-")) {
      flash(
        "err",
        "This is fallback seed data, not a real DB row. Save a new project to start using Supabase."
      );
      return;
    }
    if (!confirm("Delete this project?")) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      flash("err", data.error || "Delete failed");
      return;
    }
    flash("ok", "Project deleted");
    await refresh();
  }

  const navItems = [
    { id: "content" as const, label: "Site Content", icon: FiLayout, hint: "Hero, About, Skills, Book…" },
    { id: "thoughts" as const, label: "Notes", icon: FiZap, hint: "Quick takes + AI formatting" },
    { id: "jobs" as const, label: "Jobs", icon: FiBriefcase, count: jobs.length, hint: "Experience timeline" },
    { id: "projects" as const, label: "Projects", icon: FiFolder, count: projects.length, hint: "Featured work" },
    { id: "social" as const, label: "Social", icon: FiShare2, hint: "Compose & post via Buffer" },
    { id: "analytics" as const, label: "Analytics", icon: FiBarChart2, hint: "Buffer post performance" },
    { id: "agents" as const, label: "Agents", icon: FiCpu, hint: "News + Jobs scouts" },
    { id: "personal" as const, label: "Life", icon: FiHeart, hint: "Notepad + Life agent" },
    { id: "connectors" as const, label: "Settings", icon: FiLink, hint: "2FA, Face Lock, connectors, devices" },
    { id: "chat" as const, label: "Chat", icon: FiMessageSquare, hint: "Talk to your data with Groq" },
  ];

  return (
    <main
      className="min-h-screen bg-[#050505] text-white relative"
      style={{
        // Bottom nav (mobile only) sits at fixed-bottom — pad content so
        // it doesn't hide behind it.
        paddingBottom: "calc(72px + env(safe-area-inset-bottom))",
        // Header is now position:fixed so the iOS keyboard can't auto-scroll
        // it out of view. Push content down by the header's height so it
        // doesn't start under the header. 52px chrome + safe-area-top.
        paddingTop: "calc(52px + env(safe-area-inset-top))",
      }}
    >
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-1/4 w-[700px] h-[700px] bg-[#ff6b00]/[0.04] rounded-full blur-[180px]" />
        <div className="absolute bottom-[-10%] right-0 w-[500px] h-[500px] bg-[#ff3d00]/[0.03] rounded-full blur-[150px]" />
      </div>

      {/* Header — position:fixed, NOT sticky, so the iOS keyboard can't push
          the page up and hide it. The main element has paddingTop equal to
          this header's height so content starts below it. */}
      <header
        className="fixed top-0 left-0 right-0 z-30 bg-[#050505]/85 backdrop-blur-xl border-b border-white/[0.06]"
        // Respect the iPhone notch / status bar.
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2.5 lg:py-3.5 flex items-center justify-between gap-3">
          {/* Mobile: show current tab name in the header */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center text-black font-black text-sm shadow-[0_4px_15px_rgba(255,107,0,0.4)] shrink-0">
              K
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#ff6b00] leading-none">
                Lucy
              </p>
              {/* On mobile, show the current tab. On desktop, show the email handle. */}
              <p className="text-[11px] text-[#aaa] lg:text-[10px] lg:text-[#666] mt-1 font-mono leading-none truncate">
                <span className="lg:hidden">{tabLabel(tab)}</span>
                <span className="hidden lg:inline">krishna-amarneni</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-2 text-[#888] text-sm hover:text-white transition-colors"
            >
              <FiArrowLeft size={14} />
              <span className="hidden sm:inline">Site</span>
            </Link>
            <span className="hidden md:inline text-xs text-[#777] font-mono">
              {session.email}
            </span>
            {/* Logout lives in Settings on mobile (per your request). Keep
                the header button on lg+ for desktop muscle memory. */}
            <button
              onClick={logout}
              className="hidden lg:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10 text-sm hover:border-red-500/40 hover:text-red-300 transition-colors"
              aria-label="Logout"
            >
              <FiLogOut size={13} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="relative max-w-7xl mx-auto px-4 lg:px-8 py-5 lg:py-12">
        {/* Title row + quick stats — desktop only, takes too much real estate on phone */}
        <div className="hidden lg:flex items-start justify-between flex-wrap gap-6 mb-8">
          <div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-[#ff6b00] via-[#ff8c38] to-[#ffaa66] bg-clip-text text-transparent">
                Krishna
              </span>
            </h1>
            <p className="text-[#888] mt-2 text-sm">
              Your studio for everything that shows up on the site.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <StatPill label="Jobs" value={jobs.length} />
            <StatPill label="Projects" value={projects.length} />
            <StatPill label="Status" value="LIVE" highlight />
          </div>
        </div>

        {/* Setup banner if fallback data is showing */}
        {fallbackVisible && (
          <div className="mb-6 rounded-2xl border border-[#ff6b00]/30 bg-gradient-to-br from-[#ff6b00]/[0.08] to-transparent p-5 text-sm flex items-start gap-3">
            <FiActivity className="text-[#ff8c38] mt-0.5 shrink-0" size={18} />
            <div>
              <p className="text-[#ffaa66] font-bold mb-1">Supabase not connected yet</p>
              <p className="text-[#bbb] leading-relaxed">
                Showing fallback seed data. Run{" "}
                <code className="text-[#ff8c38]">supabase/schema.sql</code> in your Supabase
                SQL Editor and paste your keys into{" "}
                <code className="text-[#ff8c38]">.env.local</code> to start saving.
              </p>
            </div>
          </div>
        )}

        {/* Main grid: sidebar + content. Sidebar hidden on mobile (bottom nav replaces it). */}
        <div className="grid lg:grid-cols-[240px_1fr] gap-6 lg:gap-10">
          {/* Sidebar nav — desktop only */}
          <nav className="hidden lg:block lg:sticky lg:top-24 lg:self-start space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`w-full text-left rounded-2xl px-4 py-3 transition-all flex items-start gap-3 group relative ${
                    active
                      ? "bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black shadow-[0_8px_24px_rgba(255,107,0,0.35)]"
                      : "bg-white/[0.03] border border-white/[0.06] hover:border-[#ff6b00]/30 text-[#ccc] hover:text-white"
                  }`}
                >
                  <Icon size={16} className="mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{item.label}</span>
                      {typeof item.count === "number" && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            active
                              ? "bg-black/15 text-black"
                              : "bg-white/[0.06] text-[#888]"
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] mt-0.5 ${active ? "text-black/70" : "text-[#666]"}`}>
                      {item.hint}
                    </p>
                  </div>
                  {active && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-black" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Content panel */}
          <div className="min-w-0">
            {tab === "content" ? (
              <SiteContentEditor
                initial={siteContent}
                onSaved={(c) => setSiteContent(c)}
                onError={(m) => flash("err", m)}
                onSuccess={(m) => flash("ok", m)}
              />
            ) : tab === "thoughts" ? (
              <ThoughtsEditor
                onSuccess={(m) => flash("ok", m)}
                onError={(m) => flash("err", m)}
              />
            ) : tab === "social" ? (
              <SocialEditor
                onSuccess={(m) => flash("ok", m)}
                onError={(m) => flash("err", m)}
              />
            ) : tab === "analytics" ? (
              <SocialAnalytics onError={(m) => flash("err", m)} />
            ) : tab === "agents" ? (
              <AgentsTab
                onSuccess={(m) => flash("ok", m)}
                onError={(m) => flash("err", m)}
              />
            ) : tab === "personal" ? (
              <PersonalTab
                onSuccess={(m) => flash("ok", m)}
                onError={(m) => flash("err", m)}
              />
            ) : tab === "connectors" ? (
              <ConnectorsEditor
                onSuccess={(m) => flash("ok", m)}
                onError={(m) => flash("err", m)}
                sessionEmail={session.email}
              />
            ) : tab === "chat" ? (
              <AdminChat onError={(m) => flash("err", m)} />
            ) : tab === "jobs" ? (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">Experience Timeline</h2>
              <button
                onClick={() => setEditingJob("new")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-semibold text-sm shadow-[0_4px_20px_rgba(255,107,0,0.4)] hover:scale-[1.03] transition-transform"
              >
                <FiPlus size={14} />
                Add Job
              </button>
            </div>
            <div className="space-y-3">
              {jobs.map((j) => (
                <JobRow
                  key={j.id}
                  job={j}
                  onEdit={() => setEditingJob(j)}
                  onDelete={() => removeJob(j.id)}
                />
              ))}
            </div>
          </section>
        ) : (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">Featured Projects</h2>
              <button
                onClick={() => setEditingProject("new")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-semibold text-sm shadow-[0_4px_20px_rgba(255,107,0,0.4)] hover:scale-[1.03] transition-transform"
              >
                <FiPlus size={14} />
                Add Project
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {projects.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  onEdit={() => setEditingProject(p)}
                  onDelete={() => removeProject(p.id)}
                />
              ))}
            </div>
          </section>
        )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {editingJob !== null && (
        <JobEditor
          initial={editingJob === "new" ? null : editingJob}
          onClose={() => setEditingJob(null)}
          onSave={async (input) => {
            const id = editingJob === "new" ? undefined : editingJob.id;
            const ok = await saveJob(input, id?.startsWith("seed-") ? undefined : id);
            if (ok) setEditingJob(null);
          }}
        />
      )}
      {editingProject !== null && (
        <ProjectEditor
          initial={editingProject === "new" ? null : editingProject}
          onClose={() => setEditingProject(null)}
          onSave={async (input) => {
            const id = editingProject === "new" ? undefined : editingProject.id;
            const ok = await saveProject(input, id?.startsWith("seed-") ? undefined : id);
            if (ok) setEditingProject(null);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-4 lg:right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-2xl border ${
            toast.kind === "ok"
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
              : "bg-red-500/15 border-red-500/40 text-red-300"
          }`}
          // On mobile, float above the bottom nav. On desktop, the usual spot.
          style={{
            bottom: "calc(88px + env(safe-area-inset-bottom))",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Mobile bottom tab bar — only renders on screens < lg */}
      <MobileBottomNav active={tab} onSelect={(t) => setTab(t)} />
    </main>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function StatPill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 min-w-[88px] border ${
        highlight
          ? "bg-gradient-to-br from-emerald-500/15 to-emerald-500/[0.04] border-emerald-500/30"
          : "bg-white/[0.03] border-white/[0.06]"
      }`}
    >
      <p
        className={`font-black text-xl leading-none ${
          highlight ? "text-emerald-400" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] font-mono tracking-[0.15em] uppercase text-[#666] mt-1.5">
        {label}
      </p>
    </div>
  );
}

function JobRow({
  job,
  onEdit,
  onDelete,
}: {
  job: Job;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl bg-[#1a1a1a] border border-white/[0.06] p-5 flex items-start gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
        style={{ backgroundColor: job.logo_bg }}
      >
        {job.logo_src ? (
          <Image
            src={job.logo_src}
            alt={job.company}
            width={40}
            height={40}
            className="object-contain max-w-[80%] max-h-[80%]"
          />
        ) : (
          <span className="text-[10px] font-bold text-white">{job.company.slice(0, 3).toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h3 className="font-bold text-white">{job.title}</h3>
          <span className="text-xs text-[#ff6b00] font-mono">{job.company}</span>
        </div>
        <p className="text-xs text-[#666] mt-0.5">{job.period} · {job.location}</p>
        <p className="text-sm text-[#888] mt-2 line-clamp-2">{job.description}</p>
        {job.notes && (
          <p className="text-xs italic text-[#ff8c38]/80 mt-2 border-l-2 border-[#ff6b00]/30 pl-2">
            {job.notes}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onEdit}
          className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] hover:border-[#ff6b00]/40 hover:text-[#ff6b00] flex items-center justify-center transition-colors"
          aria-label="Edit"
        >
          <FiEdit2 size={13} />
        </button>
        <button
          onClick={onDelete}
          className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] hover:border-red-500/40 hover:text-red-400 flex items-center justify-center transition-colors"
          aria-label="Delete"
        >
          <FiTrash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  onEdit,
  onDelete,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl bg-[#1a1a1a] border border-white/[0.06] overflow-hidden">
      <div className="relative aspect-[16/9] bg-[#0a0a0a]">
        {project.preview ? (
          <Image
            src={project.preview}
            alt={project.title}
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover object-top"
            unoptimized
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${project.gradient} opacity-40`} />
        )}
        <span className="absolute top-3 left-3 text-xs font-mono tracking-widest bg-black/60 px-2 py-1 rounded">
          {project.number}
        </span>
      </div>
      <div className="p-5">
        <h3 className="font-bold text-white">{project.title}</h3>
        <p className="text-xs text-[#ff6b00] font-mono mt-0.5">{project.subtitle}</p>
        <p className="text-sm text-[#888] mt-2 line-clamp-2">{project.description}</p>
        <div className="flex items-center justify-between mt-4">
          <a
            href={project.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#ff6b00] inline-flex items-center gap-1 hover:underline truncate"
          >
            <FiExternalLink size={11} />
            {project.link.replace(/^https?:\/\//, "").slice(0, 30)}
          </a>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] hover:border-[#ff6b00]/40 hover:text-[#ff6b00] flex items-center justify-center transition-colors"
              aria-label="Edit"
            >
              <FiEdit2 size={13} />
            </button>
            <button
              onClick={onDelete}
              className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] hover:border-red-500/40 hover:text-red-400 flex items-center justify-center transition-colors"
              aria-label="Delete"
            >
              <FiTrash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── editors ─────────────────────────── */

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0f0f0f] border border-white/[0.08] rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] sticky top-0 bg-[#0f0f0f]/95 backdrop-blur-xl rounded-t-3xl">
          <h2 className="font-bold text-lg">{title}</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center hover:bg-white/[0.08]"
            aria-label="Close"
          >
            <FiX size={16} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-mono tracking-[0.15em] uppercase text-[#888] mb-2">
        {label}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-[#555] mt-1.5">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none text-sm text-white placeholder:text-[#555] transition-colors";

function ImageUpload({
  value,
  kind,
  onChange,
}: {
  value: string;
  kind: "logo" | "preview";
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(file: File) {
    setErr(null);
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "Upload failed");
      return;
    }
    onChange(data.url);
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          placeholder="/logos/example.png"
        />
        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:border-[#ff6b00]/40 hover:text-[#ff6b00] cursor-pointer text-sm whitespace-nowrap shrink-0 transition-colors">
          <FiUpload size={14} />
          {busy ? "…" : "Upload"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pick(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {err && <p className="text-xs text-red-400 mt-1.5">{err}</p>}
      {value && (
        <div className="mt-2 inline-block rounded-lg overflow-hidden border border-white/10 bg-[#1a1a1a]">
          {/* preview uses native img to avoid Next/Image domain config for external URLs */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="preview" className="max-h-24 max-w-[200px] object-contain" />
        </div>
      )}
    </div>
  );
}

function ChipInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (value.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...value, v]);
    setDraft("");
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff6b00]/10 border border-[#ff6b00]/25 text-[#ff8c38] text-xs"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== v))}
              className="hover:text-white"
            >
              <FiX size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          className={inputClass}
          placeholder={placeholder ?? "Type and press Enter"}
        />
        <button
          type="button"
          onClick={add}
          className="px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm hover:border-[#ff6b00]/40 hover:text-[#ff6b00] transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function JobEditor({
  initial,
  onClose,
  onSave,
}: {
  initial: Job | null;
  onClose: () => void;
  onSave: (input: JobInput) => Promise<void>;
}) {
  const [form, setForm] = useState<JobInput>(() => {
    if (!initial) return EMPTY_JOB;
    const { id: _id, created_at: _ca, ...rest } = initial;
    void _id;
    void _ca;
    return rest;
  });
  const [saving, setSaving] = useState(false);

  function patch<K extends keyof JobInput>(key: K, value: JobInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <ModalShell title={initial ? "Edit Job" : "Add Job"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Title">
            <input
              required
              value={form.title}
              onChange={(e) => patch("title", e.target.value)}
              className={inputClass}
              placeholder="SAP Business Analyst"
            />
          </Field>
          <Field label="Company">
            <input
              required
              value={form.company}
              onChange={(e) => patch("company", e.target.value)}
              className={inputClass}
              placeholder="The Coca-Cola Company"
            />
          </Field>
          <Field label="Category">
            <input
              value={form.category}
              onChange={(e) => patch("category", e.target.value)}
              className={inputClass}
              placeholder="Enterprise & Integration"
            />
          </Field>
          <Field label="Location">
            <input
              value={form.location}
              onChange={(e) => patch("location", e.target.value)}
              className={inputClass}
              placeholder="Atlanta, USA"
            />
          </Field>
          <Field label="Period">
            <input
              value={form.period}
              onChange={(e) => patch("period", e.target.value)}
              className={inputClass}
              placeholder="Feb 2025 – Present"
            />
          </Field>
          <Field label="Sort order" hint="Lower numbers come first">
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => patch("sort_order", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid sm:grid-cols-[1fr_auto] gap-4">
          <Field label="Logo image" hint="Paste a /logos/… path or upload below.">
            <ImageUpload
              value={form.logo_src ?? ""}
              kind="logo"
              onChange={(url) => patch("logo_src", url || null)}
            />
          </Field>
          <Field label="Logo background">
            <input
              type="color"
              value={form.logo_bg}
              onChange={(e) => patch("logo_bg", e.target.value)}
              className="w-16 h-12 rounded-lg border border-white/[0.08] bg-[#1a1a1a] cursor-pointer"
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => patch("description", e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="What you did in this role…"
          />
        </Field>

        <Field label="Highlights" hint="One per chip. Press Enter to add.">
          <ChipInput
            value={form.highlights}
            onChange={(v) => patch("highlights", v)}
            placeholder="e.g. 99.9% master data accuracy"
          />
        </Field>

        <Field label="Tags" hint="Tech / domain keywords">
          <ChipInput
            value={form.tags}
            onChange={(v) => patch("tags", v)}
            placeholder="e.g. SAP S/4HANA"
          />
        </Field>

        <Field label="Personal notes / thoughts" hint="Private to you in the admin — not shown on public site… yet.">
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => patch("notes", e.target.value || null)}
            rows={3}
            className={inputClass}
            placeholder="What I learned, why I left, what to remember…"
          />
        </Field>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full border border-white/10 text-sm hover:bg-white/[0.04]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_4px_20px_rgba(255,107,0,0.4)] hover:scale-[1.02] disabled:opacity-60"
          >
            <FiSave size={14} />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ProjectEditor({
  initial,
  onClose,
  onSave,
}: {
  initial: Project | null;
  onClose: () => void;
  onSave: (input: ProjectInput) => Promise<void>;
}) {
  const [form, setForm] = useState<ProjectInput>(() => {
    if (!initial) return EMPTY_PROJECT;
    const { id: _id, created_at: _ca, ...rest } = initial;
    void _id;
    void _ca;
    return rest;
  });
  const [saving, setSaving] = useState(false);

  function patch<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <ModalShell title={initial ? "Edit Project" : "Add Project"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid sm:grid-cols-[1fr_120px] gap-4">
          <Field label="Title">
            <input
              required
              value={form.title}
              onChange={(e) => patch("title", e.target.value)}
              className={inputClass}
              placeholder="WealthClaude"
            />
          </Field>
          <Field label="Number">
            <input
              value={form.number}
              onChange={(e) => patch("number", e.target.value)}
              className={inputClass}
              placeholder="01"
            />
          </Field>
        </div>
        <Field label="Subtitle">
          <input
            value={form.subtitle}
            onChange={(e) => patch("subtitle", e.target.value)}
            className={inputClass}
            placeholder="AI Finance Tracking Platform"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => patch("description", e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="What this project does…"
          />
        </Field>
        <Field label="Link">
          <input
            type="url"
            value={form.link}
            onChange={(e) => patch("link", e.target.value)}
            className={inputClass}
            placeholder="https://example.com"
          />
        </Field>
        <Field label="Preview image" hint="Paste a /previews/… path or upload below.">
          <ImageUpload
            value={form.preview}
            kind="preview"
            onChange={(url) => patch("preview", url)}
          />
        </Field>
        <Field
          label="Gradient (Tailwind class)"
          hint='e.g. "from-[#22c55e] to-[#16a34a]" — used as the card accent.'
        >
          <input
            value={form.gradient}
            onChange={(e) => patch("gradient", e.target.value)}
            className={`${inputClass} font-mono text-xs`}
            placeholder="from-[#ff6b00] to-[#ff8c38]"
          />
        </Field>
        <Field label="Tags">
          <ChipInput
            value={form.tags}
            onChange={(v) => patch("tags", v)}
            placeholder="e.g. Next.js"
          />
        </Field>
        <Field label="Sort order" hint="Lower numbers come first">
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) => patch("sort_order", Number(e.target.value))}
            className={inputClass}
          />
        </Field>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full border border-white/10 text-sm hover:bg-white/[0.04]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_4px_20px_rgba(255,107,0,0.4)] hover:scale-[1.02] disabled:opacity-60"
          >
            <FiSave size={14} />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
