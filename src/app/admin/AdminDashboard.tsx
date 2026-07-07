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
  FiCpu,
  FiHeart,
  FiUsers,
  FiFileText,
  FiMenu,
  FiHome,
  FiChevronRight,
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
import AgentsTab from "./AgentsTab";
import CRMWorkspace from "./crm/CRMWorkspace";
import ThemeToggle from "@/components/ThemeToggle";
import PersonalTab from "./PersonalTab";
import ResumeCreatorTab from "./ResumeCreatorTab";

type Tab =
  | "dashboard"
  | "content"
  | "thoughts"
  | "jobs"
  | "projects"
  | "social"
  | "agents"
  | "contacts"
  | "personal"
  | "connectors"
  | "chat"
  | "resume";

type Props = {
  session: { email: string };
  initialJobs: Job[];
  initialProjects: Project[];
  initialSiteContent: SiteContent;
};

const NAV_ITEMS: Array<{
  id: Tab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  section?: string;
}> = [
  { id: "dashboard", label: "Dashboard", icon: FiHome },
  { id: "chat", label: "AI Assistant", icon: FiMessageSquare },
  { id: "personal", label: "Life", icon: FiHeart },
  { id: "social", label: "Social", icon: FiShare2, section: "Content" },
  { id: "agents", label: "Agents", icon: FiCpu },
  { id: "resume", label: "Resume", icon: FiFileText },
  { id: "contacts", label: "CRM", icon: FiUsers },
  { id: "jobs", label: "Jobs", icon: FiBriefcase, section: "Data" },
  { id: "projects", label: "Projects", icon: FiFolder },
  { id: "content", label: "Site Content", icon: FiLayout },
  { id: "thoughts", label: "Notes", icon: FiZap },
  { id: "connectors", label: "Settings", icon: FiLink, section: "System" },
];

export function tabLabel(tab: string): string {
  return NAV_ITEMS.find((n) => n.id === tab)?.label ?? "Admin";
}

export default function AdminDashboard({
  session,
  initialJobs,
  initialProjects,
  initialSiteContent,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && NAV_ITEMS.some((n) => n.id === t)) {
      setTab(t as Tab);
    }
  }, [searchParams]);

  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [siteContent, setSiteContent] = useState<SiteContent>(initialSiteContent);
  const [editingJob, setEditingJob] = useState<Job | "new" | null>(null);
  const [editingProject, setEditingProject] = useState<Project | "new" | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

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
      flash("err", "This is fallback seed data, not a real DB row.");
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
      flash("err", "This is fallback seed data, not a real DB row.");
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

  function handleNav(id: Tab) {
    setTab(id);
    setSidebarOpen(false);
  }

  return (
    <div className="min-h-screen bg-[var(--admin-bg)] flex">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-[260px] bg-[var(--admin-sidebar-bg)] border-r border-[var(--admin-border)]
          flex flex-col overflow-y-auto
          transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:sticky lg:top-0 lg:z-auto lg:h-screen
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b border-[var(--admin-border)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center text-white font-black text-sm shadow-md shrink-0">
            K
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--admin-text)] leading-tight">Krishna Amarneni</p>
            <p className="text-[11px] text-[var(--admin-text-muted)] leading-tight mt-0.5">Admin Panel</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface-hover)]"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item, i) => {
            const Icon = item.icon;
            const active = tab === item.id;
            const showSection = item.section && (i === 0 || NAV_ITEMS[i - 1]?.section !== item.section);
            return (
              <div key={item.id}>
                {showSection && (
                  <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[var(--admin-text-muted)] px-3 pt-5 pb-2">
                    {item.section}
                  </p>
                )}
                <button
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                    active
                      ? "bg-[var(--admin-sidebar-active-bg)] text-[var(--admin-sidebar-active-text)] font-semibold shadow-[0_2px_12px_rgba(255,107,0,0.3)]"
                      : "text-[var(--admin-text-secondary)] hover:bg-[var(--admin-sidebar-hover)] hover:text-[var(--admin-text)]"
                  }`}
                >
                  <Icon size={17} className={active ? "text-[var(--admin-sidebar-active-text)]" : "text-[var(--admin-text-muted)]"} />
                  <span>{item.label}</span>
                </button>
              </div>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-[var(--admin-border)] space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--admin-text-secondary)] hover:bg-[var(--admin-sidebar-hover)] hover:text-[var(--admin-text)] transition-all"
          >
            <FiExternalLink size={17} className="text-[var(--admin-text-muted)]" />
            View Live Site
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--admin-text-secondary)] hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <FiLogOut size={17} className="text-[var(--admin-text-muted)]" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-[var(--admin-surface)]/90 backdrop-blur-xl border-b border-[var(--admin-border)]">
          <div className="flex items-center justify-between px-4 lg:px-8 py-3 lg:py-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center text-[var(--admin-text-secondary)] hover:bg-[var(--admin-surface-hover)]"
              >
                <FiMenu size={20} />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg lg:text-xl font-bold text-[var(--admin-text)] truncate">
                  {tabLabel(tab)}
                </h1>
                <div className="hidden lg:flex items-center gap-1.5 text-xs text-[var(--admin-text-muted)] mt-0.5">
                  <span>Admin</span>
                  <FiChevronRight size={10} />
                  <span className="text-[var(--admin-text-secondary)]">{tabLabel(tab)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <span className="hidden md:block text-sm text-[var(--admin-text-muted)]">{session.email}</span>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center text-white font-bold text-sm">
                K
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          {fallbackVisible && (
            <div className="mb-6 rounded-2xl border border-[#ff6b00]/30 bg-[#fff8f0] p-5 text-sm flex items-start gap-3">
              <FiActivity className="text-[#ff8c38] mt-0.5 shrink-0" size={18} />
              <div>
                <p className="text-[#ff6b00] font-bold mb-1">Supabase not connected yet</p>
                <p className="text-[var(--admin-text-muted)] leading-relaxed">
                  Showing fallback seed data. Run{" "}
                  <code className="text-[#ff8c38] bg-[#fff0e0] px-1 py-0.5 rounded text-xs">supabase/schema.sql</code>{" "}
                  in your Supabase SQL Editor.
                </p>
              </div>
            </div>
          )}

          {tab === "dashboard" ? (
            <DashboardOverview jobs={jobs} projects={projects} onNavigate={handleNav} />
          ) : tab === "content" ? (
            <SiteContentEditor
              initial={siteContent}
              onSaved={(c) => setSiteContent(c)}
              onError={(m) => flash("err", m)}
              onSuccess={(m) => flash("ok", m)}
            />
          ) : tab === "thoughts" ? (
            <ThoughtsEditor onSuccess={(m) => flash("ok", m)} onError={(m) => flash("err", m)} />
          ) : tab === "social" ? (
            <SocialEditor onSuccess={(m) => flash("ok", m)} onError={(m) => flash("err", m)} />
          ) : tab === "contacts" ? (
            <CRMWorkspace onSuccess={(m) => flash("ok", m)} onError={(m) => flash("err", m)} />
          ) : tab === "agents" ? (
            <AgentsTab onSuccess={(m) => flash("ok", m)} onError={(m) => flash("err", m)} />
          ) : tab === "personal" ? (
            <PersonalTab onSuccess={(m) => flash("ok", m)} onError={(m) => flash("err", m)} />
          ) : tab === "resume" ? (
            <ResumeCreatorTab onSuccess={(m) => flash("ok", m)} onError={(m) => flash("err", m)} />
          ) : tab === "connectors" ? (
            <ConnectorsEditor onSuccess={(m) => flash("ok", m)} onError={(m) => flash("err", m)} sessionEmail={session.email} />
          ) : tab === "chat" ? (
            <AdminChat onError={(m) => flash("err", m)} />
          ) : tab === "jobs" ? (
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-[var(--admin-text)]">Experience Timeline</h2>
                <button
                  onClick={() => setEditingJob("new")}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ff6b00] text-white font-semibold text-sm shadow-md hover:bg-[#e55d00] transition-colors"
                >
                  <FiPlus size={14} />
                  Add Job
                </button>
              </div>
              <div className="space-y-3">
                {jobs.map((j) => (
                  <JobRow key={j.id} job={j} onEdit={() => setEditingJob(j)} onDelete={() => removeJob(j.id)} />
                ))}
              </div>
            </section>
          ) : (
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-[var(--admin-text)]">Featured Projects</h2>
                <button
                  onClick={() => setEditingProject("new")}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ff6b00] text-white font-semibold text-sm shadow-md hover:bg-[#e55d00] transition-colors"
                >
                  <FiPlus size={14} />
                  Add Project
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {projects.map((p) => (
                  <ProjectRow key={p.id} project={p} onEdit={() => setEditingProject(p)} onDelete={() => removeProject(p.id)} />
                ))}
              </div>
            </section>
          )}
        </main>
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
          className={`fixed bottom-6 right-4 lg:right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg border ${
            toast.kind === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Dashboard Overview ─────────────────────────── */

function DashboardOverview({
  jobs,
  projects,
  onNavigate,
}: {
  jobs: Job[];
  projects: Project[];
  onNavigate: (tab: Tab) => void;
}) {
  const quickActions: Array<{
    id: Tab;
    label: string;
    desc: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
  }> = [
    { id: "chat", label: "AI Assistant", desc: "Talk to your data", icon: FiMessageSquare, color: "from-blue-500 to-blue-600" },
    { id: "resume", label: "Resume", desc: "Tailor & export", icon: FiFileText, color: "from-purple-500 to-purple-600" },
    { id: "social", label: "Social", desc: "Compose & post", icon: FiShare2, color: "from-pink-500 to-pink-600" },
    { id: "agents", label: "Agents", desc: "News & job scouts", icon: FiCpu, color: "from-emerald-500 to-emerald-600" },
    { id: "contacts", label: "Contacts", desc: "Recruiter CRM", icon: FiUsers, color: "from-amber-500 to-amber-600" },
    { id: "personal", label: "Life", desc: "Notepad & agent", icon: FiHeart, color: "from-rose-400 to-rose-500" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl lg:text-3xl font-bold text-[var(--admin-text)]">
          Welcome back, <span className="text-[#ff6b00]">Krishna</span>
        </h2>
        <p className="text-[var(--admin-text-muted)] mt-1 text-sm">Here&apos;s your admin overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Jobs" value={jobs.length} icon={FiBriefcase} />
        <StatCard label="Projects" value={projects.length} icon={FiFolder} />
        <StatCard label="Agents" value={8} icon={FiCpu} />
        <StatCard label="Status" value="LIVE" icon={FiActivity} highlight />
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--admin-text-muted)] uppercase tracking-wider mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => onNavigate(action.id)}
                className="bg-[var(--admin-surface)] rounded-2xl border border-[var(--admin-border)] p-4 text-left hover:shadow-md hover:border-[#ff6b00]/30 transition-all group"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3`}>
                  <Icon size={18} className="text-white" />
                </div>
                <p className="font-semibold text-[var(--admin-text)] text-sm">{action.label}</p>
                <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">{action.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--admin-text-muted)] uppercase tracking-wider">Recent Experience</h3>
          <button onClick={() => onNavigate("jobs")} className="text-xs text-[#ff6b00] font-semibold hover:underline">
            View all
          </button>
        </div>
        <div className="space-y-3">
          {jobs.slice(0, 3).map((j) => (
            <div key={j.id} className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-4 flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                style={{ backgroundColor: j.logo_bg }}
              >
                {j.logo_src ? (
                  <Image src={j.logo_src} alt={j.company} width={32} height={32} className="object-contain max-w-[80%] max-h-[80%]" />
                ) : (
                  <span className="text-[9px] font-bold text-white">{j.company.slice(0, 3).toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--admin-text)] text-sm truncate">{j.title}</p>
                <p className="text-xs text-[var(--admin-text-muted)]">{j.company} &middot; {j.period}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-[var(--admin-surface)] rounded-2xl border p-4 ${highlight ? "border-emerald-200" : "border-[var(--admin-border)]"}`}>
      <Icon size={18} className={highlight ? "text-emerald-500" : "text-[#bbb]"} />
      <p className={`text-2xl font-bold mt-2 ${highlight ? "text-emerald-600" : "text-[var(--admin-text)]"}`}>{value}</p>
      <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">{label}</p>
    </div>
  );
}

/* ─────────────────────────── Rows ─────────────────────────── */

function JobRow({ job, onEdit, onDelete }: { job: Job; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-2xl bg-white border border-[var(--admin-border)] p-5 flex items-start gap-4 hover:shadow-sm transition-shadow">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: job.logo_bg }}>
        {job.logo_src ? (
          <Image src={job.logo_src} alt={job.company} width={40} height={40} className="object-contain max-w-[80%] max-h-[80%]" />
        ) : (
          <span className="text-[10px] font-bold text-white">{job.company.slice(0, 3).toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h3 className="font-bold text-[var(--admin-text)]">{job.title}</h3>
          <span className="text-xs text-[#ff6b00] font-mono">{job.company}</span>
        </div>
        <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">{job.period} &middot; {job.location}</p>
        <p className="text-sm text-[#666] mt-2 line-clamp-2">{job.description}</p>
        {job.notes && (
          <p className="text-xs italic text-[#ff8c38] mt-2 border-l-2 border-[#ff6b00]/30 pl-2">{job.notes}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onEdit} className="w-9 h-9 rounded-full bg-[#f5f0ea] border border-[var(--admin-border)] hover:border-[#ff6b00]/40 hover:text-[#ff6b00] flex items-center justify-center text-[var(--admin-text-muted)] transition-colors">
          <FiEdit2 size={13} />
        </button>
        <button onClick={onDelete} className="w-9 h-9 rounded-full bg-[#f5f0ea] border border-[var(--admin-border)] hover:border-red-400 hover:text-red-500 flex items-center justify-center text-[var(--admin-text-muted)] transition-colors">
          <FiTrash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function ProjectRow({ project, onEdit, onDelete }: { project: Project; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-2xl bg-white border border-[var(--admin-border)] overflow-hidden hover:shadow-sm transition-shadow">
      <div className="relative aspect-[16/9] bg-[#f5f0ea]">
        {project.preview ? (
          <Image src={project.preview} alt={project.title} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover object-top" unoptimized />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${project.gradient} opacity-40`} />
        )}
        <span className="absolute top-3 left-3 text-xs font-mono tracking-widest bg-black/50 text-white px-2 py-1 rounded">{project.number}</span>
      </div>
      <div className="p-5">
        <h3 className="font-bold text-[var(--admin-text)]">{project.title}</h3>
        <p className="text-xs text-[#ff6b00] font-mono mt-0.5">{project.subtitle}</p>
        <p className="text-sm text-[#666] mt-2 line-clamp-2">{project.description}</p>
        <div className="flex items-center justify-between mt-4">
          <a href={project.link} target="_blank" rel="noopener noreferrer" className="text-xs text-[#ff6b00] inline-flex items-center gap-1 hover:underline truncate">
            <FiExternalLink size={11} />
            {project.link.replace(/^https?:\/\//, "").slice(0, 30)}
          </a>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="w-9 h-9 rounded-full bg-[#f5f0ea] border border-[var(--admin-border)] hover:border-[#ff6b00]/40 hover:text-[#ff6b00] flex items-center justify-center text-[var(--admin-text-muted)] transition-colors">
              <FiEdit2 size={13} />
            </button>
            <button onClick={onDelete} className="w-9 h-9 rounded-full bg-[#f5f0ea] border border-[var(--admin-border)] hover:border-red-400 hover:text-red-500 flex items-center justify-center text-[var(--admin-text-muted)] transition-colors">
              <FiTrash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Editors ─────────────────────────── */

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white border border-[var(--admin-border)] rounded-2xl shadow-xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--admin-border)] sticky top-0 bg-[var(--admin-surface)] rounded-t-2xl">
          <h2 className="font-bold text-lg text-[var(--admin-text)]">{title}</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-[#f5f0ea] border border-[var(--admin-border)] flex items-center justify-center text-[var(--admin-text-muted)] hover:text-[#555]">
            <FiX size={16} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold tracking-wide uppercase text-[var(--admin-text-muted)] mb-2">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-[#bbb] mt-1.5">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full px-4 py-2.5 rounded-xl bg-[#FAFAF8] border border-[var(--admin-border)] focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 focus:outline-none text-sm text-[var(--admin-text)] placeholder:text-[#ccc] transition-colors";

function ImageUpload({ value, kind, onChange }: { value: string; kind: "logo" | "preview"; onChange: (url: string) => void }) {
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
    if (!res.ok) { setErr(data.error || "Upload failed"); return; }
    onChange(data.url);
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} placeholder="/logos/example.png" />
        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--admin-border)] bg-[#f5f0ea] hover:border-[#ff6b00]/40 hover:text-[#ff6b00] cursor-pointer text-sm whitespace-nowrap shrink-0 text-[#555] transition-colors">
          <FiUpload size={14} />
          {busy ? "..." : "Upload"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
        </label>
      </div>
      {err && <p className="text-xs text-red-500 mt-1.5">{err}</p>}
      {value && (
        <div className="mt-2 inline-block rounded-lg overflow-hidden border border-[var(--admin-border)] bg-[#f5f0ea]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="preview" className="max-h-24 max-w-[200px] object-contain" />
        </div>
      )}
    </div>
  );
}

function ChipInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (value.includes(v)) { setDraft(""); return; }
    onChange([...value, v]);
    setDraft("");
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff6b00]/10 border border-[#ff6b00]/25 text-[#ff6b00] text-xs">
            {v}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="hover:text-red-500"><FiX size={11} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} className={inputClass} placeholder={placeholder ?? "Type and press Enter"} />
        <button type="button" onClick={add} className="px-4 rounded-xl bg-[#f5f0ea] border border-[var(--admin-border)] text-sm text-[#555] hover:border-[#ff6b00]/40 hover:text-[#ff6b00] transition-colors">Add</button>
      </div>
    </div>
  );
}

function JobEditor({ initial, onClose, onSave }: { initial: Job | null; onClose: () => void; onSave: (input: JobInput) => Promise<void> }) {
  const [form, setForm] = useState<JobInput>(() => {
    if (!initial) return EMPTY_JOB;
    const { id: _id, created_at: _ca, ...rest } = initial;
    void _id; void _ca;
    return rest;
  });
  const [saving, setSaving] = useState(false);

  function patch<K extends keyof JobInput>(key: K, value: JobInput[K]) { setForm((f) => ({ ...f, [key]: value })); }

  async function submit(e: React.FormEvent) { e.preventDefault(); setSaving(true); await onSave(form); setSaving(false); }

  return (
    <ModalShell title={initial ? "Edit Job" : "Add Job"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Title"><input required value={form.title} onChange={(e) => patch("title", e.target.value)} className={inputClass} placeholder="SAP Business Analyst" /></Field>
          <Field label="Company"><input required value={form.company} onChange={(e) => patch("company", e.target.value)} className={inputClass} placeholder="The Coca-Cola Company" /></Field>
          <Field label="Category"><input value={form.category} onChange={(e) => patch("category", e.target.value)} className={inputClass} placeholder="Enterprise & Integration" /></Field>
          <Field label="Location"><input value={form.location} onChange={(e) => patch("location", e.target.value)} className={inputClass} placeholder="Atlanta, USA" /></Field>
          <Field label="Period"><input value={form.period} onChange={(e) => patch("period", e.target.value)} className={inputClass} placeholder="Feb 2025 - Present" /></Field>
          <Field label="Sort order" hint="Lower numbers come first"><input type="number" value={form.sort_order} onChange={(e) => patch("sort_order", Number(e.target.value))} className={inputClass} /></Field>
        </div>
        <div className="grid sm:grid-cols-[1fr_auto] gap-4">
          <Field label="Logo image" hint="Paste a /logos/... path or upload."><ImageUpload value={form.logo_src ?? ""} kind="logo" onChange={(url) => patch("logo_src", url || null)} /></Field>
          <Field label="Logo bg"><input type="color" value={form.logo_bg} onChange={(e) => patch("logo_bg", e.target.value)} className="w-16 h-12 rounded-lg border border-[var(--admin-border)] bg-[#FAFAF8] cursor-pointer" /></Field>
        </div>
        <Field label="Description"><textarea value={form.description} onChange={(e) => patch("description", e.target.value)} rows={3} className={inputClass} placeholder="What you did..." /></Field>
        <Field label="Highlights" hint="One per chip."><ChipInput value={form.highlights} onChange={(v) => patch("highlights", v)} placeholder="e.g. 99.9% accuracy" /></Field>
        <Field label="Tags"><ChipInput value={form.tags} onChange={(v) => patch("tags", v)} placeholder="e.g. SAP S/4HANA" /></Field>
        <Field label="Notes" hint="Private."><textarea value={form.notes ?? ""} onChange={(e) => patch("notes", e.target.value || null)} rows={3} className={inputClass} /></Field>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-[var(--admin-border)] text-sm text-[#555] hover:bg-[#f5f0ea]">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#ff6b00] text-white font-bold text-sm shadow-md hover:bg-[#e55d00] disabled:opacity-60"><FiSave size={14} />{saving ? "Saving..." : "Save"}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function ProjectEditor({ initial, onClose, onSave }: { initial: Project | null; onClose: () => void; onSave: (input: ProjectInput) => Promise<void> }) {
  const [form, setForm] = useState<ProjectInput>(() => {
    if (!initial) return EMPTY_PROJECT;
    const { id: _id, created_at: _ca, ...rest } = initial;
    void _id; void _ca;
    return rest;
  });
  const [saving, setSaving] = useState(false);

  function patch<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) { setForm((f) => ({ ...f, [key]: value })); }

  async function submit(e: React.FormEvent) { e.preventDefault(); setSaving(true); await onSave(form); setSaving(false); }

  return (
    <ModalShell title={initial ? "Edit Project" : "Add Project"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid sm:grid-cols-[1fr_120px] gap-4">
          <Field label="Title"><input required value={form.title} onChange={(e) => patch("title", e.target.value)} className={inputClass} placeholder="WealthClaude" /></Field>
          <Field label="Number"><input value={form.number} onChange={(e) => patch("number", e.target.value)} className={inputClass} placeholder="01" /></Field>
        </div>
        <Field label="Subtitle"><input value={form.subtitle} onChange={(e) => patch("subtitle", e.target.value)} className={inputClass} placeholder="AI Finance Tracking Platform" /></Field>
        <Field label="Description"><textarea value={form.description} onChange={(e) => patch("description", e.target.value)} rows={3} className={inputClass} placeholder="What this project does..." /></Field>
        <Field label="Link">
          <div className="flex gap-2">
            <input type="url" value={form.link} onChange={(e) => patch("link", e.target.value)} className={inputClass + " flex-1"} placeholder="https://example.com" />
            {form.link && form.link.startsWith("http") && (
              <button type="button" onClick={async () => {
                try {
                  const r = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(form.link)}&screenshot=true&meta=false&embed=screenshot.url`);
                  const d = await r.json();
                  if (d.status === "success" && d.data?.screenshot?.url) { patch("preview", d.data.screenshot.url); }
                  else { const r2 = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(form.link)}`); const d2 = await r2.json(); if (d2.data?.image?.url) patch("preview", d2.data.image.url); }
                } catch {}
              }} className="px-3 py-2 rounded-xl bg-[#ff6b00]/10 border border-[#ff6b00]/30 text-xs font-bold text-[#ff6b00] hover:bg-[#ff6b00]/20 whitespace-nowrap">Capture</button>
            )}
          </div>
        </Field>
        <Field label="Preview image" hint="Auto-captured or upload."><ImageUpload value={form.preview} kind="preview" onChange={(url) => patch("preview", url)} /></Field>
        <Field label="Gradient" hint='e.g. "from-[#22c55e] to-[#16a34a]"'><input value={form.gradient} onChange={(e) => patch("gradient", e.target.value)} className={`${inputClass} font-mono text-xs`} placeholder="from-[#ff6b00] to-[#ff8c38]" /></Field>
        <Field label="Tags"><ChipInput value={form.tags} onChange={(v) => patch("tags", v)} placeholder="e.g. Next.js" /></Field>
        <Field label="Sort order" hint="Lower = first"><input type="number" value={form.sort_order} onChange={(e) => patch("sort_order", Number(e.target.value))} className={inputClass} /></Field>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-[var(--admin-border)] text-sm text-[#555] hover:bg-[#f5f0ea]">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#ff6b00] text-white font-bold text-sm shadow-md hover:bg-[#e55d00] disabled:opacity-60"><FiSave size={14} />{saving ? "Saving..." : "Save"}</button>
        </div>
      </form>
    </ModalShell>
  );
}
