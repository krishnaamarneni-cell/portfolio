"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  FiExternalLink,
  FiBookOpen,
  FiTool,
  FiGlobe,
  FiYoutube,
  FiLinkedin,
  FiMail,
  FiCheck,
  FiCopy,
  FiArrowUpRight,
  FiBell,
  FiShare2,
  FiX,
  FiTrendingUp,
  FiTarget,
  FiDownload,
  FiBriefcase,
  FiActivity,
} from "react-icons/fi";
import { FaXTwitter } from "react-icons/fa6";

const HeroAvatar = dynamic(
  () => import("@/components/Avatar3D").then((m) => ({ default: m.HeroAvatar })),
  { ssr: false }
);

type Link = {
  title: string;
  subtitle: string;
  href: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: string;
  badge?: string;
};

const tabs = ["Links", "Tools"] as const;
type Tab = (typeof tabs)[number];

const linksTab: { label: string; items: Link[] }[] = [
  {
    label: "Featured",
    items: [
      {
        title: "Krishna.amarneni.com",
        subtitle: "My personal portfolio site",
        href: "https://krishna.amarneni.com",
        Icon: FiGlobe,
        accent: "from-[#ff6b00] via-[#ff8c38] to-[#ffaa66]",
      },
    ],
  },
  {
    label: "Projects I've built",
    items: [
      {
        title: "WealthClaude",
        subtitle: "AI-powered finance & wealth platform",
        href: "https://www.wealthclaude.com",
        Icon: FiTrendingUp,
        accent: "from-[#ff6b00] to-[#ff8c38]",
        badge: "LIVE",
      },
      {
        title: "WealthClaude Portfolio",
        subtitle: "View my showcased work",
        href: "https://www.wealthclaude.com/u/krishna-amarneni/portfolio",
        Icon: FiBriefcase,
        accent: "from-[#ff6b00]/90 to-[#ff8c38]/90",
      },
      {
        title: "North Falmouth Pharmacy",
        subtitle: "E-commerce & booking website",
        href: "https://www.northfalmouthpharmacy.com",
        Icon: FiActivity,
        accent: "from-[#0a8fe2] to-[#0a66c2]",
      },
    ],
  },
];

const toolsTab: { label: string; items: Link[] }[] = [
  {
    label: "Featured",
    items: [
      {
        title: "Free Finance Course",
        subtitle: "Master FIRE, investing & wealth",
        href: "https://www.wealthclaude.com/learn",
        Icon: FiBookOpen,
        accent: "from-[#ff6b00] via-[#ff8c38] to-[#ffaa66]",
        badge: "NEW",
      },
    ],
  },
  {
    label: "Free resources",
    items: [
      {
        title: "Free Tools",
        subtitle: "Productivity & finance utilities",
        href: "https://www.wealthclaude.com/tools",
        Icon: FiTool,
        accent: "from-[#ff6b00] to-[#ff8c38]",
        badge: "FREE",
      },
      {
        title: "Check Your FIRE Score",
        subtitle: "How close are you to financial freedom?",
        href: "https://www.wealthclaude.com/fire-score",
        Icon: FiTarget,
        accent: "from-[#ff6b00]/90 to-[#ff8c38]/90",
      },
      {
        title: "Download Free Book",
        subtitle: "Your starter guide to wealth building",
        href: "https://www.wealthclaude.com/start",
        Icon: FiDownload,
        accent: "from-[#ff6b00]/90 to-[#ff8c38]/90",
        badge: "FREE",
      },
    ],
  },
];

const socials = [
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/krishnaamarneni",
    Icon: FiLinkedin,
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/channel/UCpTGH8ee494SpVwxA8ziMIA",
    Icon: FiYoutube,
  },
  { name: "X / Twitter", href: "https://x.com/Kp26W39306", Icon: FaXTwitter },
  { name: "Email", href: "mailto:krishna.amarneni@gmail.com", Icon: FiMail },
];

export default function LinktreePage() {
  const [tab, setTab] = useState<Tab>("Links");
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const copyEmail = () => {
    navigator.clipboard.writeText("krishna.amarneni@gmail.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sharePage = () => setShareOpen(true);

  const sections = tab === "Links" ? linksTab : toolsTab;

  return (
    <main className="min-h-screen bg-[#040404] text-white relative overflow-hidden">
      {/* === BACKGROUND === */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-[#ff6b00]/[0.18] rounded-full blur-[160px] animate-[blob1_18s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-10%] right-0 w-[500px] h-[500px] bg-[#ff3d00]/[0.1] rounded-full blur-[140px] animate-[blob2_22s_ease-in-out_infinite]" />
        <div className="absolute top-1/2 left-[-10%] w-[400px] h-[400px] bg-[#ffaa00]/[0.06] rounded-full blur-[120px] animate-[blob3_26s_ease-in-out_infinite]" />
        <div
          className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='92' viewBox='0 0 80 92' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 4 L72 22 L72 58 L40 76 L8 58 L8 22 Z' fill='none' stroke='%23ff6b00' stroke-width='0.6'/%3E%3C/svg%3E")`,
            backgroundSize: "80px 70px",
          }}
        />
      </div>

      {/* === MAIN CARD WRAPPER === */}
      <div className="relative z-10 max-w-md mx-auto px-4 sm:px-5 pt-4 pb-12">
        {/* === TOP ACTION BAR (glassmorphism) === */}
        <div className="flex items-center justify-between mb-3">
          <button
            className="w-10 h-10 rounded-full backdrop-blur-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center hover:bg-white/[0.1] transition-all"
            aria-label="Logo"
          >
            <span className="text-[#ff6b00] text-lg font-bold">✦</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              className="w-10 h-10 rounded-full backdrop-blur-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center hover:bg-white/[0.1] transition-all"
              aria-label="Notifications"
            >
              <FiBell size={16} className="text-white" />
            </button>
            <button
              onClick={sharePage}
              className="w-10 h-10 rounded-full backdrop-blur-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center hover:bg-white/[0.1] transition-all"
              aria-label="Share"
            >
              <FiShare2 size={16} className="text-white" />
            </button>
          </div>
        </div>

        {/* === HERO CARD (orange bleed with 3D avatar) === */}
        <div className="relative rounded-[32px] overflow-hidden h-[360px] sm:h-[400px] bg-gradient-to-b from-[#ff6b00] via-[#ff5500] to-[#cc3a00] shadow-[0_30px_80px_rgba(255,107,0,0.35)] opacity-0 animate-[fadeUp_0.7s_0.1s_forwards]">
          {/* Inner gradient lighting */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,200,150,0.4),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(0,0,0,0.4),transparent_50%)]" />

          {/* Grain on top of orange */}
          <div
            className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* 3D Avatar */}
          <div className="absolute inset-0 flex items-end justify-center">
            <div className="w-full h-full" style={{ transform: `translate(${mouse.x * -4}px, ${mouse.y * -3}px)` }}>
              <HeroAvatar mouseX={mouse.x} mouseY={mouse.y} className="w-full h-full" />
            </div>
          </div>

          {/* Bottom name plate (glassmorphism) */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="rounded-2xl backdrop-blur-2xl bg-black/30 border border-white/[0.12] p-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-white tracking-tight">
                      Krishna Amarneni
                    </h1>
                    <div className="w-5 h-5 rounded-full bg-[#ff6b00] flex items-center justify-center shrink-0 shadow-md">
                      <FiCheck size={11} className="text-white" strokeWidth={3} />
                    </div>
                  </div>
                  <p className="text-white/70 text-[11px] font-mono uppercase tracking-[0.2em] mt-0.5">
                    Builder · SAP · AI · Web
                  </p>
                </div>
                <button
                  onClick={copyEmail}
                  className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center transition-all shrink-0"
                  aria-label="Copy email"
                >
                  {copied ? (
                    <FiCheck size={15} className="text-emerald-300" />
                  ) : (
                    <FiCopy size={14} className="text-white" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* === BIO === */}
        <div className="text-center mt-6 px-2 opacity-0 animate-[fadeUp_0.7s_0.3s_forwards]">
          <p className="text-[#bbb] text-[14px] leading-relaxed">
            I help businesses ship enterprise software, AI agents, and beautiful
            web experiences. Currently building at{" "}
            <span className="text-white font-medium">Coca-Cola</span>.
          </p>
        </div>

        {/* === SOCIAL ICON ROW === */}
        <div className="flex items-center justify-center gap-3 mt-5 opacity-0 animate-[fadeUp_0.7s_0.4s_forwards]">
          {socials.map(({ name, href, Icon }) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={name}
              className="w-11 h-11 rounded-full backdrop-blur-xl bg-white/[0.05] border border-white/[0.08] hover:border-[#ff6b00]/50 hover:bg-[#ff6b00]/10 hover:scale-110 active:scale-95 transition-all duration-200 flex items-center justify-center group"
            >
              <Icon size={16} className="text-[#ddd] group-hover:text-[#ff6b00] transition-colors" />
            </a>
          ))}
        </div>

        {/* === GLASSMORPHISM TAB SWITCHER === */}
        <div className="mt-6 flex items-center justify-center opacity-0 animate-[fadeUp_0.7s_0.5s_forwards]">
          <div className="relative inline-flex p-1 rounded-full backdrop-blur-2xl bg-white/[0.05] border border-white/[0.08]">
            {/* Sliding pill */}
            <div
              className="absolute inset-y-1 left-1 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] shadow-[0_4px_20px_rgba(255,107,0,0.5)] transition-transform duration-300 ease-out"
              style={{
                width: "calc(50% - 4px)",
                transform: tab === "Links" ? "translateX(0)" : "translateX(100%)",
              }}
            />
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative z-10 px-7 py-2 text-[13px] font-semibold rounded-full transition-colors ${
                  tab === t ? "text-white" : "text-[#999]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* === SECTIONED LINKS === */}
        <div className="mt-7 space-y-7">
          {sections.map((sec, sIdx) => (
            <div
              key={sec.label}
              className="opacity-0 animate-[fadeUp_0.7s_forwards]"
              style={{ animationDelay: `${0.6 + sIdx * 0.1}s` }}
            >
              <p className="text-[#666] text-[10px] font-mono uppercase tracking-[0.25em] mb-2.5 ml-1">
                ─ {sec.label}
              </p>
              <div className="space-y-2.5">
                {sec.items.map(({ title, subtitle, href, Icon, accent, badge }) => (
                  <a
                    key={title}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block rounded-2xl overflow-hidden backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] hover:border-[#ff6b00]/40 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_15px_40px_rgba(255,107,0,0.18)] active:scale-[0.985]"
                  >
                    {/* Hover shine */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <div className="absolute -inset-[200%] bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-12 group-hover:translate-x-[100%] translate-x-[-100%] transition-transform duration-1000" />
                    </div>

                    <div className="relative flex items-center gap-3.5 p-4">
                      <div
                        className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center shrink-0 shadow-lg`}
                      >
                        <Icon size={20} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white text-[14.5px] truncate">
                            {title}
                          </p>
                          {badge && (
                            <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#ff6b00]/20 text-[#ff8c38] border border-[#ff6b00]/30">
                              {badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[#999] text-[12px] truncate mt-0.5">
                          {subtitle}
                        </p>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 group-hover:bg-[#ff6b00] group-hover:border-[#ff6b00] transition-all">
                        <FiArrowUpRight
                          size={15}
                          className="text-[#777] group-hover:text-white transition-colors"
                        />
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* === FOOTER === */}
        <div className="mt-12 text-center opacity-0 animate-[fadeUp_0.7s_1s_forwards]">
          <div className="flex items-center justify-center gap-2 text-[10px] text-[#555] font-mono uppercase tracking-[0.2em]">
            <span>Made by</span>
            <span className="text-[#ff6b00]">Krishna</span>
            <span>·</span>
            <span>{new Date().getFullYear()}</span>
          </div>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 mt-3 text-[#666] hover:text-[#ff6b00] text-[12px] transition-colors"
          >
            ← Back to portfolio
          </a>
        </div>
      </div>

      {/* === SHARE MODAL === */}
      {shareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_forwards]"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="w-full sm:max-w-md mx-auto rounded-t-3xl sm:rounded-3xl bg-[#0c0c0c] border border-white/[0.08] p-6 animate-[slideUp_0.3s_forwards]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">Share</h3>
              <button
                onClick={() => setShareOpen(false)}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center"
              >
                <FiX size={16} />
              </button>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText("https://krishna.amarneni.com/linktree");
                setCopied(true);
                setTimeout(() => setShareOpen(false), 1000);
              }}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-[#ff6b00]/40 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center">
                  <FiExternalLink size={16} className="text-white" />
                </div>
                <span className="text-sm font-medium">
                  {copied ? "Link copied!" : "Copy link"}
                </span>
              </div>
              {copied ? (
                <FiCheck size={18} className="text-emerald-400" />
              ) : (
                <FiCopy size={16} className="text-[#777]" />
              )}
            </button>
            <div className="grid grid-cols-3 gap-3 mt-3">
              {socials.slice(0, 3).map(({ name, href, Icon }) => (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-[#ff6b00]/40 transition-all"
                >
                  <Icon size={20} className="text-[#ddd]" />
                  <span className="text-[10px] text-[#999]">{name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === KEYFRAMES === */}
      <style jsx>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes blob1 {
          0%,
          100% {
            transform: translate(-50%, 0) scale(1);
          }
          50% {
            transform: translate(-50%, 30px) scale(1.1);
          }
        }
        @keyframes blob2 {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(-40px, -30px) scale(1.15);
          }
        }
        @keyframes blob3 {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(50px, -20px) scale(0.9);
          }
        }
      `}</style>
    </main>
  );
}
