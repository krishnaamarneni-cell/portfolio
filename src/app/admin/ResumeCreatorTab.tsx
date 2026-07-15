"use client";

import { useState, useEffect, useRef } from "react";
import {
  FiFileText,
  FiSearch,
  FiDownload,
  FiSave,
  FiClock,
  FiTrash2,
  FiChevronDown,
  FiChevronUp,
  FiAlertTriangle,
  FiCheckCircle,
  FiTarget,
  FiEdit2,
  FiUploadCloud,
} from "react-icons/fi";

type ResumeSection = {
  summary: string;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    location: string;
    period: string;
    bullets: string[];
  }>;
  projects: Array<{
    name: string;
    description: string;
    tech: string[];
  }>;
  education: Array<{
    degree: string;
    school: string;
    year: string;
  }>;
  certifications: string[];
  additional: string;
};

type ResumeAnalysis = {
  atsScore: number;
  keywordScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
  redFlags: string[];
  titleAlignment: string;
};

type SavedVersion = {
  id: string;
  company_name: string;
  job_title: string;
  ats_score: number | null;
  tone: string;
  created_at: string;
  tailored_resume: ResumeSection;
  analysis: ResumeAnalysis;
  job_description: string;
};

export default function ResumeCreatorTab({
  onError,
  onSuccess,
}: {
  onError: (m: string) => void;
  onSuccess: (m: string) => void;
}) {
  // Input state
  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [seniority, setSeniority] = useState("");
  const [tone, setTone] = useState("strong");
  const [emphasis, setEmphasis] = useState("balanced");
  const [customResume, setCustomResume] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  // Results
  const [resume, setResume] = useState<ResumeSection | null>(null);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Editing
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState("");

  // Versions
  const [versions, setVersions] = useState<SavedVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);

  // Panels
  const [showAnalysis, setShowAnalysis] = useState(true);
  const resumeRef = useRef<HTMLDivElement>(null);

  // Reference (base) resume the AI tailors from
  const [baseResume, setBaseResume] = useState("");
  const [showReference, setShowReference] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  async function onUploadResume(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/admin/resume/extract", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) {
        onError(j.error || "Couldn't read that file");
      } else {
        setCustomResume(j.text);
        setUseCustom(true);
        setShowReference(true);
        onSuccess(`Loaded ${file.name} — now the reference the AI tailors from`);
      }
    } catch {
      onError("Upload failed");
    }
    setExtracting(false);
    if (uploadRef.current) uploadRef.current.value = "";
  }

  useEffect(() => {
    loadVersions();
    fetch("/api/admin/resume/tailor")
      .then((r) => r.json())
      .then((j) => {
        if (j.baseResume) setBaseResume(j.baseResume);
      })
      .catch(() => {});
  }, []);

  async function loadVersions() {
    try {
      const r = await fetch("/api/admin/resume/versions");
      const j = await r.json();
      if (Array.isArray(j.versions)) setVersions(j.versions);
    } catch {}
  }

  async function analyze() {
    if (!jobDescription.trim()) {
      onError("Paste a job description first");
      return;
    }
    setAnalyzing(true);
    setResume(null);
    setAnalysis(null);
    try {
      const r = await fetch("/api/admin/resume/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription,
          companyName: companyName || undefined,
          jobTitle: jobTitle || undefined,
          seniority: seniority || undefined,
          tone,
          emphasis,
          customResume: useCustom ? customResume : undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        onError(j.error || "Analysis failed");
      } else {
        setResume(j.resume);
        setAnalysis(j.analysis);
        setResultId(j.id);
        onSuccess("Resume tailored and saved");
        loadVersions();
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Network error");
    }
    setAnalyzing(false);
  }

  async function loadVersion(v: SavedVersion) {
    setResume(v.tailored_resume);
    setAnalysis(v.analysis);
    setResultId(v.id);
    setCompanyName(v.company_name);
    setJobTitle(v.job_title);
    setJobDescription(v.job_description);
    setShowVersions(false);
    onSuccess(`Loaded: ${v.company_name} — ${v.job_title}`);
  }

  async function deleteVer(id: string) {
    await fetch("/api/admin/resume/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    loadVersions();
    if (resultId === id) {
      setResume(null);
      setAnalysis(null);
      setResultId(null);
    }
    onSuccess("Version deleted");
  }

  function startEdit(section: string, content: string) {
    setEditingSection(section);
    setEditBuffer(content);
  }

  function saveEdit(section: string) {
    if (!resume) return;
    const updated = { ...resume };
    if (section === "summary") updated.summary = editBuffer;
    else if (section === "additional") updated.additional = editBuffer;
    setResume(updated);
    setEditingSection(null);
  }

  function updateBullet(expIdx: number, bulletIdx: number, value: string) {
    if (!resume) return;
    const updated = { ...resume };
    updated.experience = [...updated.experience];
    updated.experience[expIdx] = {
      ...updated.experience[expIdx],
      bullets: [...updated.experience[expIdx].bullets],
    };
    updated.experience[expIdx].bullets[bulletIdx] = value;
    setResume(updated);
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Real, selectable, ATS-friendly PDF built client-side with jsPDF. */
  async function downloadPdf(r: ResumeSection) {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 54;
      const contentW = pageW - margin * 2;
      let y = margin;

      const ensure = (h: number) => {
        if (y + h > pageH - margin) {
          doc.addPage();
          y = margin;
        }
      };
      const para = (
        text: string,
        size: number,
        color: [number, number, number],
        align: "left" | "center" = "left",
        gapAfter = 0,
      ) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        const lines = doc.splitTextToSize(text, contentW) as string[];
        const lh = size * 1.32;
        for (const line of lines) {
          ensure(lh);
          doc.text(line, align === "center" ? pageW / 2 : margin, y, { align });
          y += lh;
        }
        y += gapAfter;
      };
      const header = (title: string) => {
        y += 8;
        ensure(22);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(26, 26, 26);
        doc.text(title.toUpperCase(), margin, y);
        y += 4;
        doc.setDrawColor(51, 51, 51);
        doc.setLineWidth(1);
        doc.line(margin, y, pageW - margin, y);
        y += 11;
      };
      const bullet = (text: string) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(55, 55, 55);
        const indent = 12;
        const lines = doc.splitTextToSize(text, contentW - indent) as string[];
        const lh = 13;
        lines.forEach((line, i) => {
          ensure(lh);
          if (i === 0) doc.text("•", margin, y);
          doc.text(line, margin + indent, y);
          y += lh;
        });
      };

      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(20, 20, 20);
      doc.text("KRISHNA AMARNENI", pageW / 2, y + 6, { align: "center" });
      y += 24;
      para(
        "(203) 804-9291  ·  krishnaamarneni.com  ·  linkedin.com/in/krishnaamarneni",
        9,
        [90, 90, 90],
        "center",
        4,
      );

      if (r.summary) {
        header("Professional Summary");
        para(r.summary, 10, [55, 55, 55]);
      }
      if (r.skills?.length) {
        header("Core Skills");
        para(r.skills.join("  ·  "), 10, [55, 55, 55]);
      }
      if (r.experience?.length) {
        header("Experience");
        for (const e of r.experience) {
          ensure(18);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10.5);
          doc.setTextColor(26, 26, 26);
          const title = `${e.title} — ${e.company}${e.location ? `, ${e.location}` : ""}`;
          const tLines = doc.splitTextToSize(title, contentW - 96) as string[];
          tLines.forEach((line, i) => {
            ensure(14);
            doc.text(line, margin, y);
            if (i === 0 && e.period) {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(9.5);
              doc.setTextColor(95, 95, 95);
              doc.text(e.period, pageW - margin, y, { align: "right" });
              doc.setFont("helvetica", "bold");
              doc.setFontSize(10.5);
              doc.setTextColor(26, 26, 26);
            }
            y += 14;
          });
          for (const b of e.bullets ?? []) bullet(b);
          y += 5;
        }
      }
      if (r.projects?.length) {
        header("Projects");
        for (const p of r.projects) {
          para(`${p.name} — ${p.description}`, 10, [40, 40, 40]);
          if (p.tech?.length) para(p.tech.join(", "), 9, [95, 95, 95], "left", 4);
        }
      }
      if (r.education?.length) {
        header("Education");
        for (const e of r.education)
          para(`${e.degree} — ${e.school}${e.year ? ` (${e.year})` : ""}`, 10, [55, 55, 55]);
      }
      if (r.certifications?.length) {
        header("Certifications");
        for (const c of r.certifications) bullet(c);
      }
      if (r.additional) {
        header("Additional");
        para(r.additional, 10, [55, 55, 55]);
      }

      doc.save("krishna.amarneni.pdf");
      onSuccess("PDF downloaded");
    } catch (e) {
      onError(e instanceof Error ? e.message : "PDF generation failed");
    }
  }

  /** Word document — styled HTML that Word opens with formatting intact. */
  function downloadWord(r: ResumeSection) {
    try {
      const html = buildPrintHtml(r);
      const blob = new Blob(["﻿", html], { type: "application/msword" });
      triggerDownload(blob, "krishna.amarneni.doc");
      onSuccess("Word document downloaded");
    } catch {
      onError("Word download failed");
    }
  }

  const inputCls =
    "w-full px-3 py-2.5 rounded-xl bg-[#111] border border-white/[0.08] text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6b00]/60 transition-colors";
  const selectCls =
    "px-3 py-2 rounded-xl bg-[#111] border border-white/[0.08] text-sm text-[#ccc] focus:outline-none focus:border-[#ff6b00]/60";
  const btnPrimary =
    "inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black text-sm font-bold shadow-[0_4px_20px_rgba(255,107,0,0.35)] hover:scale-[1.03] transition-transform disabled:opacity-50 disabled:hover:scale-100";
  const btnSecondary =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs hover:border-[#ff6b00]/40 hover:text-[#ff6b00] disabled:opacity-40 transition-colors";

  return (
    <section className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <FiFileText size={22} className="text-[#ff6b00]" />
          Resume Creator
        </h2>
        <p className="text-sm text-[#666] mt-1">
          Tailor your resume to a specific role — ATS-optimized, recruiter-ready
        </p>
      </div>

      {/* Version history toggle */}
      {versions.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowVersions(!showVersions)}
            className={btnSecondary}
          >
            <FiClock size={12} />
            {versions.length} saved version{versions.length > 1 ? "s" : ""}
            {showVersions ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
          </button>
          {showVersions && (
            <div className="mt-3 space-y-2">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 rounded-xl bg-[#111] border border-white/[0.06] p-3"
                >
                  <button
                    type="button"
                    onClick={() => loadVersion(v)}
                    className="flex-1 text-left"
                  >
                    <div className="text-xs font-bold text-white">
                      {v.company_name || "Unknown"} — {v.job_title || "Untitled"}
                    </div>
                    <div className="text-[10px] text-[#666]">
                      {new Date(v.created_at).toLocaleDateString()} ·{" "}
                      {v.ats_score ? `ATS ${v.ats_score}%` : ""} · {v.tone}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteVer(v.id)}
                    className="text-[#444] hover:text-red-400"
                  >
                    <FiTrash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reference (base) resume — what the AI tailors from */}
      {baseResume && (
        <div className="rounded-2xl bg-[#0d0d0d] border border-white/[0.06] p-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowReference((v) => !v)}
              className="flex items-center gap-2 flex-1 min-w-0 text-left"
            >
              <FiFileText size={16} className="text-[#ff6b00] shrink-0" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#888] truncate">
                Reference resume — base the AI tailors from
              </h3>
            </button>
            <button
              type="button"
              onClick={() => uploadRef.current?.click()}
              disabled={extracting}
              className={btnSecondary}
            >
              <FiUploadCloud size={12} /> {extracting ? "Reading…" : "Upload resume"}
            </button>
            <input
              ref={uploadRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="hidden"
              onChange={onUploadResume}
            />
            <button
              type="button"
              onClick={() => setShowReference((v) => !v)}
              className="text-[#666] hover:text-white shrink-0 p-0.5"
            >
              {showReference ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
            </button>
          </div>
          {showReference && (
            <div className="mt-3">
              {useCustom && customResume.trim() ? (
                <>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      Active — your uploaded / pasted resume
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setUseCustom(false);
                        setCustomResume("");
                      }}
                      className="text-[10px] text-[#666] hover:text-[#999] underline"
                    >
                      Reset to master
                    </button>
                  </div>
                  <pre className="text-[11px] text-[#ddd] whitespace-pre-wrap font-mono bg-[#111] border border-emerald-500/20 rounded-xl p-4 max-h-96 overflow-y-auto">
                    {customResume}
                  </pre>
                  <p className="text-[10px] text-[#666] mt-1">
                    Tweak this text in the &ldquo;Paste custom resume&rdquo; box below if needed, then Analyze.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-[#666] mb-2">
                    This master resume is the source. Each tailored version is built from it against the job
                    description. <span className="text-[#999]">Upload your resume</span> above (PDF / Word / TXT) or
                    paste one below to override it.
                  </p>
                  <pre className="text-[11px] text-[#bbb] whitespace-pre-wrap font-mono bg-[#111] border border-white/[0.06] rounded-xl p-4 max-h-96 overflow-y-auto">
                    {baseResume}
                  </pre>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Input panel */}
      <div className="rounded-2xl bg-[#0d0d0d] border border-white/[0.06] p-5 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[#888]">
          Target Role
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Company name (optional)"
            className={inputCls}
          />
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Job title (optional)"
            className={inputCls}
          />
        </div>

        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={8}
          placeholder="Paste the full job description here..."
          className={inputCls + " resize-y font-mono text-xs leading-relaxed"}
        />

        {/* Options row */}
        <div className="flex items-center gap-3 flex-wrap">
          <select value={seniority} onChange={(e) => setSeniority(e.target.value)} className={selectCls}>
            <option value="">Seniority</option>
            <option value="Entry-level">Entry-level</option>
            <option value="Mid-level">Mid-level</option>
            <option value="Senior">Senior</option>
            <option value="Lead / Staff">Lead / Staff</option>
            <option value="Director+">Director+</option>
            <option value="Executive / VP">Executive / VP</option>
          </select>
          <select value={tone} onChange={(e) => setTone(e.target.value)} className={selectCls}>
            <option value="conservative">Conservative</option>
            <option value="strong">Strong</option>
            <option value="executive">Executive</option>
          </select>
          <select value={emphasis} onChange={(e) => setEmphasis(e.target.value)} className={selectCls}>
            <option value="ats">ATS-first</option>
            <option value="recruiter">Recruiter-first</option>
            <option value="balanced">Balanced</option>
          </select>
          <label className="flex items-center gap-1.5 text-[10px] text-[#999] cursor-pointer">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
              className="rounded border-white/20 bg-[#0a0a0a]"
            />
            Paste custom resume
          </label>
        </div>

        {/* Custom resume textarea */}
        {useCustom && (
          <textarea
            value={customResume}
            onChange={(e) => setCustomResume(e.target.value)}
            rows={6}
            placeholder="Paste your current resume text here (otherwise saved resume is used automatically)..."
            className={inputCls + " resize-y text-xs"}
          />
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={analyze}
            disabled={analyzing || !jobDescription.trim()}
            className={btnPrimary}
          >
            <FiSearch size={14} />
            {analyzing ? "Analyzing & Tailoring..." : "Analyze & Tailor Resume"}
          </button>
          {resume && (
            <>
              <button type="button" onClick={() => downloadPdf(resume)} className={btnSecondary}>
                <FiDownload size={12} /> Download PDF
              </button>
              <button type="button" onClick={() => downloadWord(resume)} className={btnSecondary}>
                <FiDownload size={12} /> Download Word
              </button>
            </>
          )}
        </div>
      </div>

      {/* Loading state */}
      {analyzing && (
        <div className="rounded-2xl bg-[#0d0d0d] border border-[#ff6b00]/20 p-8 text-center">
          <div className="inline-flex items-center gap-3 text-[#ff8c38]">
            <div className="w-5 h-5 border-2 border-[#ff6b00]/30 border-t-[#ff6b00] rounded-full animate-spin" />
            <span className="text-sm font-bold">
              Reading resume, analyzing JD, tailoring content...
            </span>
          </div>
          <p className="text-[10px] text-[#666] mt-2">
            This takes 15-30 seconds — extracting keywords, rewriting bullets, scoring ATS fit
          </p>
        </div>
      )}

      {/* Analysis panel */}
      {analysis && (
        <div className="rounded-2xl bg-[#0d0d0d] border border-white/[0.06] p-5 space-y-4">
          <button
            type="button"
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="flex items-center gap-2 w-full"
          >
            <FiTarget size={16} className="text-[#ff6b00]" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#888] flex-1 text-left">
              Analysis & Insights
            </h3>
            {showAnalysis ? <FiChevronUp size={14} className="text-[#666]" /> : <FiChevronDown size={14} className="text-[#666]" />}
          </button>

          {showAnalysis && (
            <>
              {/* Score cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ScoreCard label="ATS Score" value={analysis.atsScore} />
                <ScoreCard label="Keyword Match" value={analysis.keywordScore} />
                <div className="rounded-xl bg-[#111] border border-white/[0.06] p-3 text-center">
                  <div className="text-lg font-bold text-white">{analysis.matchedKeywords?.length || 0}</div>
                  <div className="text-[9px] font-mono uppercase tracking-widest text-[#666]">Keywords Hit</div>
                </div>
              </div>

              {/* Title alignment */}
              {analysis.titleAlignment && (
                <div className="rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 p-3">
                  <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Title Alignment</div>
                  <p className="text-xs text-[#ccc]">{analysis.titleAlignment}</p>
                </div>
              )}

              {/* Matched keywords */}
              {analysis.matchedKeywords?.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2">
                    <FiCheckCircle size={10} className="inline mr-1" />
                    Matched Keywords ({analysis.matchedKeywords.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.matchedKeywords.map((k, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing keywords */}
              {analysis.missingKeywords?.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2">
                    <FiAlertTriangle size={10} className="inline mr-1" />
                    Missing Keywords ({analysis.missingKeywords.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.missingKeywords.map((k, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {analysis.suggestions?.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-2">Suggestions</div>
                  <ul className="space-y-1">
                    {analysis.suggestions.map((s, i) => (
                      <li key={i} className="text-xs text-[#ccc] pl-3 border-l-2 border-sky-500/30">{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Red flags */}
              {analysis.redFlags?.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">Red Flags</div>
                  <ul className="space-y-1">
                    {analysis.redFlags.map((f, i) => (
                      <li key={i} className="text-xs text-red-300/80 pl-3 border-l-2 border-red-500/30">{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Resume preview */}
      {resume && (
        <div ref={resumeRef} className="rounded-2xl bg-white text-[#1a1a1a] p-6 sm:p-8 space-y-5 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
          <div className="text-center border-b border-gray-200 pb-4">
            <h1 className="text-xl font-bold tracking-wide">KRISHNA AMARNENI</h1>
            <p className="text-xs text-gray-500 mt-1">(203) 804-9291 · krishnaamarneni.com · linkedin.com/in/krishnaamarneni</p>
          </div>

          {/* Summary */}
          {resume.summary && (
            <EditableSection
              title="Professional Summary"
              editing={editingSection === "summary"}
              onEdit={() => startEdit("summary", resume.summary)}
              onSave={() => saveEdit("summary")}
              onCancel={() => setEditingSection(null)}
            >
              {editingSection === "summary" ? (
                <textarea
                  value={editBuffer}
                  onChange={(e) => setEditBuffer(e.target.value)}
                  rows={3}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs resize-y"
                />
              ) : (
                <p className="text-xs leading-relaxed text-gray-700">{resume.summary}</p>
              )}
            </EditableSection>
          )}

          {/* Skills */}
          {resume.skills?.length > 0 && (
            <div>
              <SectionHeader title="Core Skills" />
              <p className="text-xs text-gray-700">{resume.skills.join(" · ")}</p>
            </div>
          )}

          {/* Experience */}
          {resume.experience?.length > 0 && (
            <div>
              <SectionHeader title="Experience" />
              <div className="space-y-4">
                {resume.experience.map((exp, ei) => (
                  <div key={ei}>
                    <div className="flex justify-between items-baseline flex-wrap gap-1">
                      <div>
                        <span className="text-xs font-bold">{exp.title}</span>
                        <span className="text-xs text-gray-600"> — {exp.company}</span>
                        {exp.location && <span className="text-xs text-gray-500">, {exp.location}</span>}
                      </div>
                      <span className="text-[10px] text-gray-500">{exp.period}</span>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {exp.bullets?.map((b, bi) => (
                        <li key={bi} className="flex items-start gap-1.5 text-xs text-gray-700">
                          <span className="text-gray-400 mt-0.5 shrink-0">•</span>
                          <input
                            type="text"
                            value={b}
                            onChange={(e) => updateBullet(ei, bi, e.target.value)}
                            className="flex-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none py-0.5 text-xs"
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {resume.projects?.length > 0 && (
            <div>
              <SectionHeader title="Projects" />
              <div className="space-y-2">
                {resume.projects.map((p, i) => (
                  <div key={i}>
                    <span className="text-xs font-bold">{p.name}</span>
                    <span className="text-xs text-gray-600"> — {p.description}</span>
                    {p.tech?.length > 0 && (
                      <div className="text-[10px] text-gray-500 mt-0.5">{p.tech.join(", ")}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {resume.education?.length > 0 && (
            <div>
              <SectionHeader title="Education" />
              {resume.education.map((e, i) => (
                <div key={i} className="text-xs text-gray-700">
                  <span className="font-bold">{e.degree}</span> — {e.school}
                  {e.year && <span className="text-gray-500"> ({e.year})</span>}
                </div>
              ))}
            </div>
          )}

          {/* Certifications */}
          {resume.certifications?.length > 0 && (
            <div>
              <SectionHeader title="Certifications" />
              <ul className="space-y-0.5">
                {resume.certifications.map((c, i) => (
                  <li key={i} className="text-xs text-gray-700">• {c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Additional */}
          {resume.additional && (
            <EditableSection
              title="Additional"
              editing={editingSection === "additional"}
              onEdit={() => startEdit("additional", resume.additional)}
              onSave={() => saveEdit("additional")}
              onCancel={() => setEditingSection(null)}
            >
              {editingSection === "additional" ? (
                <textarea
                  value={editBuffer}
                  onChange={(e) => setEditBuffer(e.target.value)}
                  rows={2}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs resize-y"
                />
              ) : (
                <p className="text-xs text-gray-700">{resume.additional}</p>
              )}
            </EditableSection>
          )}
        </div>
      )}
    </section>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-[2px] text-gray-900 border-b border-gray-300 pb-1 mb-2">
      {title}
    </h2>
  );
}

function EditableSection({
  title,
  editing,
  onEdit,
  onSave,
  onCancel,
  children,
}: {
  title: string;
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative">
      <div className="flex items-center justify-between mb-2">
        <SectionHeader title={title} />
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          {editing ? (
            <>
              <button type="button" onClick={onSave} className="text-[10px] text-emerald-600 font-bold">Save</button>
              <button type="button" onClick={onCancel} className="text-[10px] text-gray-400">Cancel</button>
            </>
          ) : (
            <button type="button" onClick={onEdit} className="text-[10px] text-blue-500 flex items-center gap-0.5">
              <FiEdit2 size={9} /> Edit
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  const color =
    value >= 80
      ? "text-emerald-300"
      : value >= 60
      ? "text-amber-300"
      : "text-red-400";
  return (
    <div className="rounded-xl bg-[#111] border border-white/[0.06] p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}%</div>
      <div className="text-[9px] font-mono uppercase tracking-widest text-[#666]">{label}</div>
    </div>
  );
}

function buildPrintHtml(resume: ResumeSection): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Krishna Amarneni — Resume</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: letter; margin: 0.6in 0.75in; }
body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.35; color: #1a1a1a; }
h1 { font-size: 18pt; font-weight: 700; text-align: center; margin-bottom: 2px; }
.contact { text-align: center; font-size: 10pt; color: #555; margin-bottom: 14px; }
h2 { font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1.5px solid #333; padding-bottom: 2px; margin: 14px 0 6px; }
.summary { margin-bottom: 10px; font-size: 10.5pt; }
.skills { font-size: 10.5pt; margin-bottom: 6px; }
.job { margin-bottom: 10px; }
.job-line { display: flex; justify-content: space-between; flex-wrap: wrap; }
.job-title { font-weight: 700; }
.job-co { font-style: italic; }
.job-period { font-size: 10pt; color: #555; }
ul { margin: 3px 0 0 16px; }
li { margin-bottom: 1px; font-size: 10.5pt; }
.proj { margin-bottom: 6px; }
.proj-name { font-weight: 700; }
.proj-tech { font-size: 9.5pt; color: #555; }
.edu { margin-bottom: 3px; }
</style></head><body>
<h1>KRISHNA AMARNENI</h1>
<div class="contact">(203) 804-9291 · krishnaamarneni.com · linkedin.com/in/krishnaamarneni</div>

${resume.summary ? `<h2>Professional Summary</h2><p class="summary">${esc(resume.summary)}</p>` : ""}
${resume.skills?.length ? `<h2>Core Skills</h2><p class="skills">${resume.skills.map(esc).join(" · ")}</p>` : ""}
${resume.experience?.length ? `<h2>Experience</h2>${resume.experience.map((e) => `<div class="job"><div class="job-line"><span><span class="job-title">${esc(e.title)}</span> — <span class="job-co">${esc(e.company)}</span>${e.location ? `, ${esc(e.location)}` : ""}</span><span class="job-period">${esc(e.period)}</span></div>${e.bullets?.length ? `<ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}</div>`).join("")}` : ""}
${resume.projects?.length ? `<h2>Projects</h2>${resume.projects.map((p) => `<div class="proj"><span class="proj-name">${esc(p.name)}</span> — ${esc(p.description)}${p.tech?.length ? `<div class="proj-tech">${p.tech.map(esc).join(", ")}</div>` : ""}</div>`).join("")}` : ""}
${resume.education?.length ? `<h2>Education</h2>${resume.education.map((e) => `<div class="edu"><strong>${esc(e.degree)}</strong> — ${esc(e.school)}${e.year ? ` (${esc(e.year)})` : ""}</div>`).join("")}` : ""}
${resume.certifications?.length ? `<h2>Certifications</h2><ul>${resume.certifications.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
${resume.additional ? `<h2>Additional</h2><p>${esc(resume.additional)}</p>` : ""}
</body></html>`;
}
