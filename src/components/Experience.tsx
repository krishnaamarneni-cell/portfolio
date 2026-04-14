"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import ScrollReveal from "./ScrollReveal";
import ScrollTrack from "./ScrollTrack";
import { FiBriefcase, FiMapPin, FiCalendar } from "react-icons/fi";

const experiences = [
  {
    title: "SAP Business Analyst",
    category: "Enterprise & Integration",
    company: "The Coca-Cola Company",
    location: "Atlanta, USA",
    period: "Feb 2025 – Present",
    logo: { src: "/logos/coca-cola.png", bg: "#ffffff" },
    description:
      "Supporting end-to-end supply chain operations across SAP S/4HANA and SAP Ariba, ensuring system stability and business continuity for global operations.",
    highlights: [
      "SAP S/4HANA & SAP Ariba integration",
      "ASN, inventory & delivery error resolution",
      "CIG and cXML root cause analysis",
      "UAT, regression testing & go-live support",
      "Liaison between business, IT & SAP CoE",
    ],
    tags: ["SAP S/4HANA", "SAP Ariba", "CIG", "cXML", "ASN"],
  },
  {
    title: "SAP S/4HANA MM / SD Consultant",
    category: "Pharma & Compliance",
    company: "Xiromed",
    location: "New Jersey, USA",
    period: "Nov 2023 – Jan 2025",
    logo: { src: "", bg: "#0a4da2" },
    description:
      "Managed SAP S/4HANA master data with 99.9% accuracy and delivered end-to-end MM, IM, and SD implementations for pharmaceutical operations.",
    highlights: [
      "99.9% master data accuracy",
      "End-to-end SAP MM, IM, SD delivery",
      "DSCSA compliance via TraceLink",
      "Global supply chain: APAC, EU, NA, LATAM",
      "Demand planning & forecasting support",
    ],
    tags: ["SAP MM/SD", "TraceLink", "DSCSA", "Supply Chain"],
  },
  {
    title: "SAP S/4HANA Master Data Analyst",
    category: "Data Governance & Finance",
    company: "PepsiCo Inc.",
    location: "New York, USA",
    period: "Apr 2023 – Sept 2023",
    logo: { src: "/logos/pepsico.png", bg: "#004b93" },
    description:
      "Reduced master-data-related errors by ~40% through root-cause analysis and standardized data maintenance across procurement and finance.",
    highlights: [
      "~40% error reduction via root-cause analysis",
      "Vendor & material master with SOX compliance",
      "Power BI reporting for data quality",
      "S/4HANA deployment & post-go-live support",
    ],
    tags: ["Master Data", "SOX", "Power BI", "S/4HANA"],
  },
  {
    title: "Data Analyst",
    category: "Analytics & Procurement",
    company: "DenKen",
    location: "California, USA",
    period: "Dec 2022 – Mar 2023",
    logo: { src: "/logos/denken.webp", bg: "#2d2d2d" },
    description:
      "Utilized MySQL and Tableau for data analysis, providing actionable insights for supplier optimization and cost reduction.",
    highlights: [
      "MySQL & Tableau data analysis",
      "Supplier negotiation & cost savings",
      "Sales & inventory trend optimization",
      "Cross-functional process improvements",
    ],
    tags: ["MySQL", "Tableau", "Data Analysis", "Procurement"],
  },
  {
    title: "SAP SRM / Vendor Master Data Analyst",
    category: "Master Data Management",
    company: "IFF",
    location: "Hyderabad, India",
    period: "May 2020 – Feb 2021",
    logo: { src: "/logos/iff.webp", bg: "#1a1a1a" },
    description:
      "Created and maintained vendor master records in SAP SRM/S/4HANA, performing validation and cleansing to reduce data inconsistencies.",
    highlights: [
      "Vendor master in SAP SRM/S/4HANA",
      "Data validation & cleansing",
      "Procurement leadership reporting",
      "SOP documentation & knowledge transfer",
    ],
    tags: ["SAP SRM", "Vendor Master", "Procurement"],
  },
  {
    title: "IT Procurement Associate",
    category: "Procurement & Sourcing",
    company: "SAAS IT",
    location: "Chennai, India",
    period: "Mar 2019 – Apr 2020",
    logo: { src: "/logos/saasit.png", bg: "#1a1a1a" },
    description:
      "Managed procurement using SAP S/4HANA and SAP Ariba, achieving ~10% cost savings through data-driven vendor negotiations.",
    highlights: [
      "SAP S/4HANA & Ariba procurement",
      "~10% cost savings via negotiations",
      "RFI/RFQ analysis & recommendations",
      "Cross-training & knowledge sharing",
    ],
    tags: ["SAP Ariba", "Procurement", "RFQ/RFI"],
  },
];

/* ── 3D tilt on cursor move ── */
function FloatCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const handleMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setStyle({
      transform: `perspective(800px) rotateY(${x * 14}deg) rotateX(${-y * 10}deg) translateZ(8px)`,
      transition: "transform 0.1s ease-out",
    });
  }, []);

  const handleLeave = useCallback(() => {
    setStyle({
      transform: "perspective(800px) rotateY(0deg) rotateX(0deg) translateZ(0px)",
      transition: "transform 0.4s ease-out",
    });
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={style}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
    </div>
  );
}

export default function Experience() {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll-based index + per-card progress tracking
  const [cardProgress, setCardProgress] = useState(0); // 0-1 how far next card has risen

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const sectionHeight = el.scrollHeight - window.innerHeight;
      const scrolled = -rect.top;
      const raw = Math.max(0, Math.min(1, scrolled / sectionHeight));
      const scaled = raw * experiences.length;
      const idx = Math.min(experiences.length - 1, Math.floor(scaled));
      const frac = scaled - idx; // 0-1 progress within current card
      setActiveIndex(idx);
      setCardProgress(frac);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const activeLogo = experiences[activeIndex].logo;

  return (
    <section id="experience" className="relative">
      {/* Section header */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-28 lg:pt-36 pb-8">
        <ScrollReveal direction="rotate3d">
          <p className="text-[#ff6b00] text-sm font-mono mb-4 tracking-[0.3em] uppercase">
            // Where I&apos;ve Worked
          </p>
        </ScrollReveal>
        <ScrollReveal direction="flipX" delay={0.1}>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
            Professional <span className="text-gradient">Experience</span>
          </h2>
        </ScrollReveal>
      </div>

      <ScrollTrack text="EXPERIENCE" direction="left" />

      {/* Scroll container — height creates scroll distance, cards are fixed inside */}
      <div
        ref={scrollRef}
        style={{ height: `${experiences.length * 140}vh` }}
        className="relative"
      >
        <div className="sticky top-0 h-screen overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 h-full">
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 h-full items-center">

              {/* LEFT: Card stack — new cards rise from below onto the pile */}
              <div className="lg:col-span-7 relative" style={{ height: "fit-content" }}>
                <div className="relative">
                  {experiences.map((exp, i) => {
                    const isLanded = i <= activeIndex; // already on the stack
                    const isTop = i === activeIndex;
                    const isNext = i === activeIndex + 1; // the card currently rising up
                    const depth = activeIndex - i;

                    // Hold current card for 55% of its scroll, then transition in the next 45%
                    const HOLD = 0.55;
                    const transitionProgress = cardProgress < HOLD ? 0 : (cardProgress - HOLD) / (1 - HOLD);

                    // Next card rises from bottom during transition phase only
                    const riseAmount = isNext ? (1 - transitionProgress) * 110 : 0; // 110% -> 0%
                    const riseOpacity = isNext ? transitionProgress : 0;

                    return (
                      <div
                        key={`${exp.company}-${exp.period}`}
                        className={isNext ? "" : "transition-all duration-500"}
                        style={{
                          position: i === 0 ? "relative" : "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          zIndex: i + 1,
                          opacity: isNext
                            ? riseOpacity
                            : !isLanded
                            ? 0
                            : isTop
                            ? 1
                            : 0,
                          transform: isNext
                            ? `translateY(${riseAmount}%) scale(0.96)`
                            : !isLanded
                            ? "translateY(100%) scale(0.9)"
                            : isTop
                            ? "translateY(0) scale(1)"
                            : `translateY(${-depth * 6}px) scale(${1 - depth * 0.02})`,
                          pointerEvents: isTop ? "auto" : "none",
                          visibility: isTop || isNext ? "visible" : "hidden",
                        }}
                      >
                        <FloatCard className="w-full">
                          <div
                            className={`w-full rounded-3xl p-8 lg:p-10 relative overflow-hidden border transition-colors duration-500 ${
                              isTop
                                ? "bg-white text-[#0c0c0c] shadow-[0_30px_80px_rgba(0,0,0,0.5)] border-white/20"
                                : "bg-[#1a1a1a] text-white shadow-[0_5px_20px_rgba(0,0,0,0.2)] border-white/[0.03]"
                            }`}
                          >
                            {/* Category */}
                            <p
                              className={`text-sm mb-3 font-medium ${
                                isTop ? "text-[#ff6b00]" : "text-[#ff6b00]/50"
                              }`}
                              style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}
                            >
                              {exp.category}
                            </p>

                            {/* Title */}
                            <h3 className={`text-3xl lg:text-4xl font-bold mb-3 leading-tight ${
                              isTop ? "text-[#0c0c0c]" : "text-white"
                            }`}>
                              {exp.title}
                            </h3>

                            {/* Meta */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5">
                              <span className={`flex items-center gap-1.5 text-sm font-semibold ${
                                isTop ? "text-[#333]" : "text-[#999]"
                              }`}>
                                <FiBriefcase size={14} className="text-[#ff6b00]" />
                                {exp.company}
                              </span>
                              <span className={`flex items-center gap-1.5 text-sm ${
                                isTop ? "text-[#888]" : "text-[#666]"
                              }`}>
                                <FiMapPin size={13} />
                                {exp.location}
                              </span>
                              <span className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full ${
                                isTop ? "bg-[#f5f5f5] text-[#888]" : "bg-white/[0.05] text-[#666]"
                              }`}>
                                <FiCalendar size={11} />
                                {exp.period}
                              </span>
                            </div>

                            {/* Description */}
                            <p className={`text-base leading-relaxed mb-5 ${
                              isTop ? "text-[#555]" : "text-[#888]"
                            }`}>
                              {exp.description}
                            </p>

                            {/* Highlights */}
                            <ul className="space-y-2 mb-5">
                              {exp.highlights.map((h, j) => (
                                <li key={j} className={`flex items-start gap-3 text-sm ${
                                  isTop ? "text-[#666]" : "text-[#888]"
                                }`}>
                                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#ff6b00] shrink-0" />
                                  {h}
                                </li>
                              ))}
                            </ul>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-2">
                              {exp.tags.map((t) => (
                                <span
                                  key={t}
                                  className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                                    isTop
                                      ? "bg-[#ff6b00]/10 text-[#ff6b00] border border-[#ff6b00]/20"
                                      : "bg-[#ff6b00]/[0.06] text-[#ff8c38] border border-[#ff6b00]/10"
                                  }`}
                                >
                                  {t}
                                </span>
                              ))}
                            </div>

                            {/* Mobile logo */}
                            <div className="lg:hidden mt-6 flex items-center gap-4 pt-5 border-t border-black/5">
                              <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                                style={{ backgroundColor: exp.logo.bg }}
                              >
                                {exp.logo.src ? (
                                  <Image src={exp.logo.src} alt={exp.company} width={40} height={40} className="object-contain" />
                                ) : (
                                  <span className="text-xs font-bold text-white">{exp.company.slice(0, 3)}</span>
                                )}
                              </div>
                              <div>
                                <p className={`text-sm font-semibold ${isTop ? "text-[#333]" : "text-white"}`}>{exp.company}</p>
                                <p className={`text-xs ${isTop ? "text-[#999]" : "text-[#666]"}`}>{exp.location}</p>
                              </div>
                            </div>
                          </div>
                        </FloatCard>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT: Sticky company logo */}
              <div className="hidden lg:flex lg:col-span-5 items-center justify-center">
                <div className="relative w-full flex flex-col items-center">
                  <div
                    className="relative w-80 h-96 rounded-3xl flex items-center justify-center transition-all duration-700 overflow-hidden"
                    style={{
                      backgroundColor: activeLogo.bg,
                      transform: "perspective(800px) rotateY(-5deg) rotateX(2deg)",
                      boxShadow: `0 30px 80px ${activeLogo.bg}40, 0 10px 30px rgba(0,0,0,0.3)`,
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/10 z-10" />
                    {activeLogo.src ? (
                      <Image
                        src={activeLogo.src}
                        alt={experiences[activeIndex].company}
                        width={200}
                        height={200}
                        className="relative z-0 object-contain max-w-[70%] max-h-[70%] transition-all duration-500"
                      />
                    ) : (
                      <span className="relative z-0 text-4xl font-bold tracking-wider text-white transition-all duration-500">
                        {experiences[activeIndex].company}
                      </span>
                    )}
                  </div>

                  <div className="text-center mt-8">
                    <p className="text-white font-bold text-xl transition-all duration-500">
                      {experiences[activeIndex].company}
                    </p>
                    <p className="text-[#666] text-sm mt-1 flex items-center justify-center gap-1.5">
                      <FiMapPin size={13} />
                      {experiences[activeIndex].location}
                    </p>
                    <p className="text-[#555] text-xs font-mono mt-2">
                      {experiences[activeIndex].period}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ScrollTrack text="CAREER · JOURNEY" direction="right" />

      {/* Education */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-28 lg:pb-36">
        <ScrollReveal direction="zoom3d" delay={0.2}>
          <div className="rounded-3xl bg-white text-[#0c0c0c] p-8 flex flex-col md:flex-row md:items-center gap-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <div className="w-14 h-14 rounded-2xl bg-[#ff6b00] flex items-center justify-center shrink-0">
              <span className="text-white text-2xl font-bold">E</span>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-1">Education</h3>
              <p className="text-[#888] text-sm">
                Bachelor&apos;s Degree — Automotive Engineering &nbsp;|&nbsp; Master&apos;s — Data Analytics
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
