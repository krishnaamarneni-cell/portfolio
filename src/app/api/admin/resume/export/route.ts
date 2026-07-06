import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import type { ResumeSection } from "@/lib/resume";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  format: "pdf" | "docx";
  resume: ResumeSection;
  name?: string;
};

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.resume || !body.format) {
    return NextResponse.json({ error: "resume and format required" }, { status: 400 });
  }

  const candidateName = body.name || "Krishna Amarneni";

  if (body.format === "docx") {
    return generateDocx(body.resume, candidateName);
  }

  return generatePdfHtml(body.resume, candidateName);
}

function generatePdfHtml(resume: ResumeSection, name: string): NextResponse {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: #1a1a1a; max-width: 8.5in; margin: 0 auto; padding: 0.75in 1in; }
  h1 { font-size: 20pt; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 12pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1.5px solid #333; padding-bottom: 3px; margin: 16px 0 8px; }
  .summary { margin-bottom: 12px; }
  .skills { margin-bottom: 4px; }
  .job { margin-bottom: 12px; }
  .job-header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; }
  .job-title { font-weight: 700; font-size: 11pt; }
  .job-company { font-style: italic; }
  .job-period { font-size: 10pt; color: #555; }
  ul { margin: 4px 0 0 18px; }
  li { margin-bottom: 2px; }
  .project { margin-bottom: 8px; }
  .project-name { font-weight: 700; }
  .project-tech { font-size: 10pt; color: #555; }
  .edu { margin-bottom: 4px; }
  .cert-list { margin: 0; padding-left: 18px; }
</style>
</head><body>
<h1>${esc(name)}</h1>

${resume.summary ? `<h2>Professional Summary</h2><p class="summary">${esc(resume.summary)}</p>` : ""}

${resume.skills?.length ? `<h2>Core Skills</h2><p class="skills">${resume.skills.map(esc).join(" · ")}</p>` : ""}

${resume.experience?.length ? `<h2>Experience</h2>${resume.experience.map((e) => `
<div class="job">
  <div class="job-header">
    <span><span class="job-title">${esc(e.title)}</span> — <span class="job-company">${esc(e.company)}</span>${e.location ? `, ${esc(e.location)}` : ""}</span>
    <span class="job-period">${esc(e.period)}</span>
  </div>
  ${e.bullets?.length ? `<ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
</div>`).join("")}` : ""}

${resume.projects?.length ? `<h2>Projects</h2>${resume.projects.map((p) => `
<div class="project">
  <span class="project-name">${esc(p.name)}</span> — ${esc(p.description)}
  ${p.tech?.length ? `<div class="project-tech">${p.tech.map(esc).join(", ")}</div>` : ""}
</div>`).join("")}` : ""}

${resume.education?.length ? `<h2>Education</h2>${resume.education.map((e) => `
<div class="edu"><strong>${esc(e.degree)}</strong> — ${esc(e.school)}${e.year ? `, ${esc(e.year)}` : ""}</div>`).join("")}` : ""}

${resume.certifications?.length ? `<h2>Certifications</h2><ul class="cert-list">${resume.certifications.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}

${resume.additional ? `<h2>Additional</h2><p>${esc(resume.additional)}</p>` : ""}

</body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name.replace(/\s+/g, "_")}_Resume.html"`,
    },
  });
}

function generateDocx(resume: ResumeSection, name: string): NextResponse {
  const lines: string[] = [];
  lines.push(name.toUpperCase());
  lines.push("");

  if (resume.summary) {
    lines.push("PROFESSIONAL SUMMARY");
    lines.push(resume.summary);
    lines.push("");
  }

  if (resume.skills?.length) {
    lines.push("CORE SKILLS");
    lines.push(resume.skills.join(" | "));
    lines.push("");
  }

  if (resume.experience?.length) {
    lines.push("EXPERIENCE");
    for (const e of resume.experience) {
      lines.push(`${e.title} — ${e.company}${e.location ? `, ${e.location}` : ""} (${e.period})`);
      for (const b of e.bullets ?? []) {
        lines.push(`  • ${b}`);
      }
      lines.push("");
    }
  }

  if (resume.projects?.length) {
    lines.push("PROJECTS");
    for (const p of resume.projects) {
      lines.push(`${p.name} — ${p.description}`);
      if (p.tech?.length) lines.push(`  Technologies: ${p.tech.join(", ")}`);
      lines.push("");
    }
  }

  if (resume.education?.length) {
    lines.push("EDUCATION");
    for (const e of resume.education) {
      lines.push(`${e.degree} — ${e.school}${e.year ? ` (${e.year})` : ""}`);
    }
    lines.push("");
  }

  if (resume.certifications?.length) {
    lines.push("CERTIFICATIONS");
    for (const c of resume.certifications) lines.push(`  • ${c}`);
    lines.push("");
  }

  if (resume.additional) {
    lines.push("ADDITIONAL");
    lines.push(resume.additional);
  }

  const text = lines.join("\n");

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name.replace(/\s+/g, "_")}_Resume.txt"`,
    },
  });
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
