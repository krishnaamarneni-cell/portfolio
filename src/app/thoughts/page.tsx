import type { Metadata } from "next";
import Link from "next/link";
import { FiArrowLeft, FiCalendar, FiTag } from "react-icons/fi";
import { fetchPublishedThoughts } from "@/lib/content";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Thoughts · Krishna Amarneni",
  description:
    "Short, honest thoughts on building, money, AI, and everything in between.",
};

export const dynamic = "force-dynamic";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function ThoughtsPage() {
  const thoughts = await fetchPublishedThoughts();
  return (
    <main className="min-h-screen bg-[#050505] text-white relative">
      <Navbar />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-1/3 w-[700px] h-[700px] bg-[#ff6b00]/[0.06] rounded-full blur-[180px]" />
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
            ✦ Thoughts
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white mb-4">
            Short{" "}
            <span className="bg-gradient-to-r from-[#ff6b00] via-[#ff8c38] to-[#ffaa66] bg-clip-text text-transparent">
              honest thoughts.
            </span>
          </h1>
          <p className="text-[#888] text-lg leading-relaxed max-w-2xl">
            Raw takes I&apos;ve been writing down — on building, money, AI, and
            everything that bothers me long enough to put into words.
          </p>
        </header>

        {thoughts.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-10 text-center">
            <p className="text-[#888]">
              No thoughts published yet. Check back soon.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {thoughts.map((t) => (
              <article
                key={t.id}
                className="rounded-2xl bg-[#1a1a1a] border border-white/[0.06] hover:border-[#ff6b00]/30 transition-all duration-300 p-7 lg:p-8"
              >
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className="text-[#666] text-xs flex items-center gap-1.5">
                    <FiCalendar size={11} />
                    {formatDate(t.published_at || t.created_at)}
                  </span>
                  {t.tags.length > 0 && (
                    <span className="text-[#666] text-xs flex items-center gap-1.5">
                      <FiTag size={11} />
                      {t.tags.join(" · ")}
                    </span>
                  )}
                </div>
                {t.title && (
                  <h2 className="text-2xl font-bold text-white mb-4 leading-tight">
                    {t.title}
                  </h2>
                )}
                <div
                  className="prose prose-invert max-w-none text-[#ccc] leading-relaxed space-y-4"
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {t.body}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
