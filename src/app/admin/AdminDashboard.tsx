"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
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

type Tab = "content" | "jobs" | "projects";

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
  const [tab, setTab] = useState<Tab>("content");
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

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#050505]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[#888] text-sm hover:text-white transition-colors"
            >
              <FiArrowLeft size={14} />
              <span className="hidden sm:inline">Back to site</span>
            </Link>
            <span className="hidden sm:block w-px h-5 bg-white/10" />
            <p className="text-xs font-mono tracking-[0.25em] uppercase text-[#ff6b00]">
              ✦ Admin
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-xs text-[#777] font-mono">
              {session.email}
            </span>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10 text-sm hover:border-red-500/40 hover:text-red-300 transition-colors"
            >
              <FiLogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10 lg:py-14">
        {/* Title */}
        <div className="mb-10">
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight">Dashboard</h1>
          <p className="text-[#888] mt-2">
            Manage your experience timeline and featured projects.
          </p>
        </div>

        {/* Setup banner if fallback data is showing */}
        {fallbackVisible && (
          <div className="mb-8 rounded-2xl border border-[#ff6b00]/30 bg-[#ff6b00]/[0.05] p-5 text-sm">
            <p className="text-[#ffaa66] font-bold mb-1">Supabase not connected yet</p>
            <p className="text-[#bbb] leading-relaxed">
              Showing fallback seed data. To start saving:
            </p>
            <ol className="text-[#bbb] list-decimal list-inside mt-2 space-y-1">
              <li>Create a project at supabase.com</li>
              <li>
                Run <code className="text-[#ff8c38]">supabase/schema.sql</code> in the SQL Editor
              </li>
              <li>
                Paste your URL + keys into <code className="text-[#ff8c38]">.env.local</code> and restart{" "}
                <code className="text-[#ff8c38]">npm run dev</code>
              </li>
            </ol>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          <TabBtn active={tab === "content"} onClick={() => setTab("content")} icon={<FiLayout size={14} />}>
            Site Content
          </TabBtn>
          <TabBtn active={tab === "jobs"} onClick={() => setTab("jobs")} icon={<FiBriefcase size={14} />}>
            Jobs ({jobs.length})
          </TabBtn>
          <TabBtn
            active={tab === "projects"}
            onClick={() => setTab("projects")}
            icon={<FiFolder size={14} />}
          >
            Projects ({projects.length})
          </TabBtn>
        </div>

        {/* List */}
        {tab === "content" ? (
          <SiteContentEditor
            initial={siteContent}
            onSaved={(c) => setSiteContent(c)}
            onError={(m) => flash("err", m)}
            onSuccess={(m) => flash("ok", m)}
          />
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
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-2xl border ${
            toast.kind === "ok"
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
              : "bg-red-500/15 border-red-500/40 text-red-300"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </main>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
        active
          ? "bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black shadow-[0_4px_20px_rgba(255,107,0,0.35)]"
          : "bg-white/[0.04] text-[#888] border border-white/[0.06] hover:text-white hover:border-[#ff6b00]/30"
      }`}
    >
      {icon}
      {children}
    </button>
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
