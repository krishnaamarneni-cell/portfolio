"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
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
    <main className="min-h-screen text-white relative overflow-hidden bg-[#050505]">
      {/* === BACKGROUND === pure solid black, no glows or textures leaking */}

      {/* === FULL-BLEED ORANGE HERO (no card, edge-to-edge like Guy Raz) === */}
      <div className="relative z-10 w-full opacity-0 animate-[fadeUp_0.7s_0.1s_forwards]">
        <div className="relative w-full h-[500px] sm:h-[560px] bg-[#cc3a00] overflow-hidden">
          {/* Inner gradient lighting */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,200,150,0.4),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(0,0,0,0.4),transparent_50%)]" />
          {/* Grain texture */}
          <div
            className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Top action buttons FLOATING ON TOP of orange */}
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
            <button
              className="w-10 h-10 rounded-full backdrop-blur-xl bg-white/20 border border-white/30 flex items-center justify-center hover:bg-white/30 transition-all"
              aria-label="Logo"
            >
              <span className="text-white text-lg font-bold">✦</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                className="w-10 h-10 rounded-full backdrop-blur-xl bg-white/20 border border-white/30 flex items-center justify-center hover:bg-white/30 transition-all"
                aria-label="Notifications"
              >
                <FiBell size={16} className="text-white" />
              </button>
              <button
                onClick={sharePage}
                className="w-10 h-10 rounded-full backdrop-blur-xl bg-white/20 border border-white/30 flex items-center justify-center hover:bg-white/30 transition-all"
                aria-label="Share"
              >
                <FiShare2 size={16} className="text-white" />
              </button>
            </div>
          </div>

          {/*
            ===== EASY-TO-EDIT IMAGE POSITION =====
            Adjust these values to move/scale the photo:
              IMG_SCALE     — zoom level (1.0 = normal, 1.4 = bigger crop)
              IMG_OFFSET_Y  — vertical position in % (0 = top, 50 = center, 100 = bottom)
              IMG_OFFSET_X  — horizontal position in % (50 = center)
              IMG_FADE_HEIGHT — height of bottom fade overlay (e.g. "180px")
          */}
          <div className="absolute inset-0 overflow-hidden">
            <Image
              src="/Krishna.amarneni_ai-removebg-preview.png"
              alt="Krishna Amarneni"
              fill
              priority
              className="object-cover"
              style={{
                objectPosition: "50% 25%", // X% Y% — change these to reposition
                transform: `scale(1.15) translate(${mouse.x * -4}px, ${mouse.y * -3}px)`,
                transformOrigin: "center top",
              }}
            />
          </div>

          {/* Bottom fade — strong dark band, fully solid black before hero ends */}
          <div
            className="absolute inset-x-0 bottom-0 h-[300px] pointer-events-none z-[5]"
            style={{
              background:
                "linear-gradient(to bottom, transparent 0%, rgba(5,5,5,0.1) 20%, rgba(5,5,5,0.5) 40%, rgba(5,5,5,0.9) 55%, #050505 70%)",
            }}
          />

          {/* Name + Twitter-Premium-style verified at bottom */}
          <div className="absolute bottom-[68px] left-0 right-0 flex items-center justify-center gap-2 pointer-events-none z-10">
            <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow-lg">
              Krishna Amarneni
            </h1>
            {/* Twitter Premium gold verified badge (scalloped SVG) */}
            <svg
              viewBox="0 0 22 22"
              className="w-6 h-6 shrink-0 drop-shadow"
              aria-label="Verified"
            >
              <defs>
                <linearGradient id="goldVerified" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffd95a" />
                  <stop offset="50%" stopColor="#f7b733" />
                  <stop offset="100%" stopColor="#d18a00" />
                </linearGradient>
              </defs>
              <path
                d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"
                fill="url(#goldVerified)"
              />
            </svg>
          </div>

          {/* Tagline directly under name */}
          <div className="absolute bottom-[28px] left-0 right-0 px-6 text-center pointer-events-none z-10">
            <p className="text-white/95 text-[13px] font-medium drop-shadow leading-snug">
              Builder of AI agents, SAP systems & beautiful web experiences
            </p>
          </div>
        </div>
      </div>

      {/* === BELOW-HERO CONTENT (constrained max-width) === */}
      <div className="relative z-10 max-w-md mx-auto px-5 -mt-2 pb-12">
        {/* About me */}
        <div className="text-center px-2 mb-6 opacity-0 animate-[fadeUp_0.7s_0.25s_forwards]">
          <p className="text-[#cfc0b8] text-[13.5px] leading-relaxed">
            Hey, I&apos;m Krishna 👋 — a Full-Stack Developer & SAP Business Analyst based in
            New Jersey. I build AI agents at <span className="text-white font-semibold">WealthClaude</span>,
            ship enterprise systems at <span className="text-white font-semibold">Coca-Cola</span>, and
            craft modern web experiences in my free time.
          </p>
          <p className="text-[#ff8c38] text-[11px] font-mono uppercase tracking-[0.25em] mt-3">
            ✦ Available for collaborations
          </p>
        </div>

        {/* === SOCIAL ICON ROW (directly below the card) === */}
        <div className="flex items-center justify-center gap-3 mt-5 opacity-0 animate-[fadeUp_0.7s_0.3s_forwards]">
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
        <div className="mt-6 flex items-center justify-center opacity-0 animate-[fadeUp_0.7s_0.4s_forwards]">
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
