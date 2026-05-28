import type { Metadata } from "next";
import Link from "next/link";
import { FiArrowLeft, FiArrowUpRight, FiLock, FiTrendingUp } from "react-icons/fi";
import { fetchSiteContent } from "@/lib/content";
import type { Holding } from "@/lib/site-content-types";
import { holdingLogoUrl } from "@/lib/logo";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Portfolio · Krishna Amarneni",
  description:
    "High-conviction positions across public markets and private deals. Not investment advice.",
};

export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  const { investments } = await fetchSiteContent();
  return (
    <main className="min-h-screen bg-[#050505] text-white relative">
      <Navbar />

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-1/4 w-[600px] h-[600px] bg-[#ff6b00]/[0.07] rounded-full blur-[160px]" />
        <div className="absolute bottom-[-10%] right-0 w-[400px] h-[400px] bg-[#ff3d00]/[0.05] rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 lg:px-10 py-16 lg:py-24 pb-32">
        <Link
          href="/"
          className="hover-link inline-flex items-center gap-2 text-[#777] text-sm mb-10"
        >
          <FiArrowLeft size={14} />
          Back to portfolio
        </Link>

        <header className="mb-14">
          <p className="text-[#ff6b00] text-sm font-mono mb-4 tracking-[0.3em] uppercase">
            {investments.eyebrow}
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white mb-4">
            {investments.heading_pre}{" "}
            <span className="bg-gradient-to-r from-[#ff6b00] via-[#ff8c38] to-[#ffaa66] bg-clip-text text-transparent">
              {investments.heading_accent}
            </span>{" "}
            lives
          </h1>
          <p className="text-[#888] text-lg leading-relaxed max-w-2xl">
            {investments.intro}
          </p>
          <p className="text-[#555] text-xs italic mt-3">{investments.disclaimer}</p>
        </header>

        <Section
          label={investments.public_label}
          holdings={investments.public_holdings}
        />

        {investments.private_holdings.length > 0 && (
          <Section
            label={investments.private_label}
            holdings={investments.private_holdings}
            isPrivate
          />
        )}
      </div>

      <Footer />
    </main>
  );
}

function Section({
  label,
  holdings,
  isPrivate,
}: {
  label: string;
  holdings: Holding[];
  isPrivate?: boolean;
}) {
  return (
    <section className="mb-14">
      <div className="flex items-end gap-4 mb-7">
        <div className="h-1 w-12 rounded-full bg-gradient-to-r from-[#ff6b00] to-transparent shrink-0 mb-2.5" />
        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          {label}
          <span className="ml-3 text-sm font-mono text-[#666]">
            {holdings.length} {holdings.length === 1 ? "position" : "positions"}
          </span>
        </h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {holdings.map((h) => (
          <HoldingRow key={h.ticker} h={h} isPrivate={isPrivate} />
        ))}
      </div>
    </section>
  );
}

function HoldingRow({ h, isPrivate }: { h: Holding; isPrivate?: boolean }) {
  const Wrapper: React.ElementType = h.link ? "a" : "div";
  const wrapperProps = h.link
    ? { href: h.link, target: "_blank", rel: "noopener noreferrer" }
    : {};
  return (
    <Wrapper
      {...wrapperProps}
      className="group block rounded-2xl bg-[#1a1a1a] border border-white/[0.06] hover:border-[#ff6b00]/30 transition-all duration-300 p-6 hover:-translate-y-0.5 relative overflow-hidden"
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ backgroundColor: h.brand_color }}
      />
      <div className="flex items-start gap-4">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden"
          style={{ backgroundColor: h.brand_color }}
        >
          {h.logo_domain ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={holdingLogoUrl(h.logo_domain) ?? ""}
                alt={`${h.name} logo`}
                className="w-11 h-11 object-contain relative z-10"
                loading="lazy"
              />
            </>
          ) : isPrivate ? (
            <FiLock size={20} className="text-white" />
          ) : (
            <span className="text-white font-black text-sm">
              {h.ticker.slice(0, 4)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-white font-bold">{h.ticker}</h3>
            {isPrivate ? (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-[#ff6b00]/15 text-[#ff8c38] border border-[#ff6b00]/30 uppercase">
                Private
              </span>
            ) : (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                Public
              </span>
            )}
          </div>
          <p className="text-[#888] text-xs mb-3">{h.name}</p>
          <p className="text-[#bbb] text-sm leading-relaxed">{h.thesis}</p>
          {h.link && (
            <div className="flex items-center gap-1.5 mt-4 text-xs text-[#ff6b00] font-medium">
              <FiTrendingUp size={11} />
              View on Google Finance
              <FiArrowUpRight
                size={12}
                className="group-hover:rotate-45 transition-transform"
              />
            </div>
          )}
        </div>
      </div>
    </Wrapper>
  );
}
