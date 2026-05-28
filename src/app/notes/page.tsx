import type { Metadata } from "next";
import Link from "next/link";
import { FiArrowLeft, FiCalendar, FiTag, FiArrowUpRight } from "react-icons/fi";
import { fetchPublishedThoughts } from "@/lib/content";

export const metadata: Metadata = {
  title: "Notes · Krishna Amarneni",
  description:
    "Short, honest takes on building, money, AI, and everything in between.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function NotesPage() {
  const notes = await fetchPublishedThoughts();

  return (
    <main className="min-h-screen bg-[#050505] text-white relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-1/3 w-[700px] h-[700px] bg-[#ff6b00]/[0.06] rounded-full blur-[180px]" />
        <div className="absolute bottom-[-10%] right-0 w-[400px] h-[400px] bg-[#ff3d00]/[0.05] rounded-full blur-[140px]" />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 lg:px-10 py-16 lg:py-24 pb-32">
        <Link
          href="/"
          className="hover-link inline-flex items-center gap-2 text-[#777] text-sm mb-10"
        >
          <FiArrowLeft size={14} />
          Back to portfolio
        </Link>

        <header className="mb-12">
          <p className="text-[#ff6b00] text-sm font-mono mb-4 tracking-[0.3em] uppercase">
            ✦ Notes
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white mb-4">
            Short{" "}
            <span className="bg-gradient-to-r from-[#ff6b00] via-[#ff8c38] to-[#ffaa66] bg-clip-text text-transparent">
              honest notes.
            </span>
          </h1>
          <p className="text-[#888] text-lg leading-relaxed max-w-2xl">
            Raw takes I&apos;ve been writing down — on building, money, AI, and
            everything that bothers me long enough to put into words.
          </p>
        </header>

        {notes.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-10 text-center">
            <p className="text-[#888]">No notes published yet. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {notes.map((n) => (
              <article
                key={n.id}
                className="group rounded-2xl bg-[#1a1a1a] border border-white/[0.06] hover:border-[#ff6b00]/30 transition-all duration-300 overflow-hidden"
              >
                {n.cover_image_url && (
                  <div className="relative w-full aspect-[16/7] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={n.cover_image_url}
                      alt={n.title || "Note cover"}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#1a1a1a] to-transparent pointer-events-none" />
                    {n.cover_image_credit && (
                      <p className="absolute bottom-2 right-3 text-[10px] text-white/70 bg-black/40 px-2 py-0.5 rounded font-mono">
                        {n.cover_image_credit}
                      </p>
                    )}
                  </div>
                )}
                <div className="p-7 lg:p-8">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="text-[#666] text-xs flex items-center gap-1.5">
                      <FiCalendar size={11} />
                      {formatDate(n.published_at || n.created_at)}
                    </span>
                    {n.tags.length > 0 && (
                      <span className="text-[#666] text-xs flex items-center gap-1.5">
                        <FiTag size={11} />
                        {n.tags.join(" · ")}
                      </span>
                    )}
                  </div>
                  {n.title && (
                    <h2 className="text-2xl font-bold text-white mb-4 leading-tight group-hover:text-[#ff6b00] transition-colors">
                      {n.title}
                    </h2>
                  )}
                  <div
                    className="text-[#ccc] leading-relaxed"
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {n.body}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-20 rounded-3xl bg-gradient-to-br from-[#ff6b00]/[0.1] to-transparent border border-[#ff6b00]/20 p-8 lg:p-10 text-center">
          <p className="text-[#ff6b00] text-xs font-mono tracking-[0.3em] uppercase mb-3">
            Want these in your inbox?
          </p>
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Subscribe for new notes
          </h3>
          <p className="text-[#888] text-base mb-6 max-w-md mx-auto">
            Honest takes on building, money, and AI — straight from the trenches.
          </p>
          <a
            href="mailto:krishna.amarneni@gmail.com?subject=Subscribe%20to%20notes"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_8px_30px_rgba(255,107,0,0.5)] hover:scale-105 transition-transform"
          >
            Subscribe
            <FiArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </main>
  );
}
