"use client";

import { useEffect, useState } from "react";
import {
  FiDownload,
  FiBookOpen,
  FiArrowRight,
  FiCheck,
} from "react-icons/fi";

type Capability = {
  factCount: number;
  noteCount: number;
  knowledgeCount: number;
};

type KnowledgeDoc = {
  slug: string;
  title: string;
  category: string;
};

export default function LucyImportCard({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [cap, setCap] = useState<Capability | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{ inserted: number; skipped: number } | null>(null);

  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [openDoc, setOpenDoc] = useState<{ slug: string; title: string; body: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/import/lucy", { cache: "no-store" })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => setCap(d as Capability));
    fetch("/api/admin/knowledge", { cache: "no-store" })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => setDocs(Array.isArray(d.docs) ? d.docs : []));
  }, []);

  async function importLucy() {
    setImporting(true);
    const r = await fetch("/api/admin/import/lucy", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setImporting(false);
    if (!r.ok) {
      onError(j.error || "Import failed");
      return;
    }
    setImported({ inserted: j.inserted, skipped: j.skipped });
    onSuccess(
      `Imported ${j.inserted} suggestion${j.inserted === 1 ? "" : "s"} — review in Memory agent`
    );
  }

  async function openKnowledge(slug: string) {
    const r = await fetch(`/api/admin/knowledge?slug=${encodeURIComponent(slug)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error || "Could not open");
      return;
    }
    setOpenDoc({ slug: j.slug, title: j.title, body: j.body });
  }

  if (!cap) return null;

  return (
    <div className="rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/[0.05] to-transparent p-5 mt-6 space-y-5">
      {/* Header + import */}
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-fuchsia-500/15 text-fuchsia-300 flex items-center justify-center shrink-0">
          <FiDownload size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white">Import from Lucy vault</h3>
            {imported ? (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                Done — {imported.inserted} added
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-[#888] mt-1 leading-relaxed">
            Pull {cap.factCount} facts (visa, career, holdings, expenses, tools)
            and {cap.noteCount} lesson notes from your Lucy vault. Goes through
            the Memory agent review queue — you approve each one before it
            touches the real facts table.
          </p>
        </div>
        <button
          type="button"
          onClick={importLucy}
          disabled={importing}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white text-xs font-bold shadow-[0_4px_15px_rgba(217,70,239,0.35)] hover:scale-[1.03] disabled:opacity-60"
        >
          <FiDownload size={11} />
          {importing ? "Importing…" : "Import to queue"}
        </button>
      </div>

      {/* Knowledge files */}
      <div className="pt-5 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-300 flex items-center justify-center shrink-0">
            <FiBookOpen size={16} />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Knowledge library</h4>
            <p className="text-[10px] text-[#888]">
              {docs.length} reference docs imported from Lucy — H1B, Fed, SAP
              market, portfolio theory, options, more.
            </p>
          </div>
        </div>

        {openDoc ? (
          <div className="rounded-xl border border-white/[0.06] bg-[#0a0a0a] p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h5 className="font-bold text-cyan-300 text-sm">{openDoc.title}</h5>
              <button
                type="button"
                onClick={() => setOpenDoc(null)}
                className="text-[10px] uppercase tracking-widest text-[#888] hover:text-white px-2 py-1"
              >
                Back to list
              </button>
            </div>
            <pre className="text-[12px] text-[#ccc] whitespace-pre-wrap font-sans max-h-[400px] overflow-y-auto leading-relaxed">
              {openDoc.body}
            </pre>
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-1.5">
            {docs.map((d) => (
              <li key={d.slug}>
                <button
                  type="button"
                  onClick={() => openKnowledge(d.slug)}
                  className="w-full text-left flex items-center gap-2 py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-cyan-500/30 hover:bg-cyan-500/[0.04] group"
                >
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-[#888] border border-white/[0.06]">
                    {d.category}
                  </span>
                  <span className="text-xs text-white flex-1 truncate">
                    {d.title}
                  </span>
                  <FiArrowRight
                    size={11}
                    className="text-[#666] group-hover:text-cyan-300"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Reference so lint doesn't drop the icon import if we add later.
void FiCheck;
