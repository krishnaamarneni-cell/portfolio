"use client";

import { FiGithub, FiLinkedin, FiMail, FiArrowUp } from "react-icons/fi";
import ScrollReveal from "./ScrollReveal";

export default function Footer() {
  const marqueeText = "Let's work together \u00A0\u2022\u00A0 ";
  const repeatedText = Array(12).fill(marqueeText).join("");

  return (
    <footer className="relative">
      {/* Big name header at bottom of page */}
      <div className="py-28 lg:py-40 px-6 lg:px-10 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal direction="flipX">
            <p className="text-[#ff6b00] text-sm font-mono mb-6 tracking-[0.3em] uppercase">
              // Let&apos;s build something great
            </p>
          </ScrollReveal>
          <ScrollReveal direction="zoom3d" delay={0.1}>
            <h2 className="text-6xl md:text-8xl lg:text-[140px] font-bold leading-[0.9] tracking-tight">
              <span className="text-[var(--text-primary)]">Krishna</span>
              <br />
              <span className="text-gradient">Amarneni</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal direction="rotate3d" delay={0.2}>
            <div className="mt-8 flex flex-wrap items-center gap-4 text-[var(--text-muted)] text-sm">
              <span>SAP Expert</span>
              <span className="text-[#ff6b00]">&bull;</span>
              <span>Full-Stack Developer</span>
              <span className="text-[#ff6b00]">&bull;</span>
              <span>AI Agent Builder</span>
              <span className="text-[#ff6b00]">&bull;</span>
              <span>New Jersey, USA</span>
            </div>
          </ScrollReveal>
        </div>
      </div>

      {/* Scrolling marquee */}
      <div className="relative overflow-hidden border-t border-b border-[var(--border)] py-6">
        <div className="marquee-track flex whitespace-nowrap">
          <span className="marquee-content text-2xl md:text-4xl font-bold text-[var(--text-primary)]/[0.07] uppercase tracking-wider">
            {repeatedText}
          </span>
          <span className="marquee-content text-2xl md:text-4xl font-bold text-[var(--text-primary)]/[0.07] uppercase tracking-wider">
            {repeatedText}
          </span>
        </div>
        <style jsx>{`
          .marquee-track {
            animation: marquee 30s linear infinite;
          }
          .marquee-content {
            flex-shrink: 0;
          }
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
      </div>

      {/* Footer bar */}
      <div className="border-t border-[var(--border)] py-10 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#ff6b00] flex items-center justify-center text-black font-bold text-sm">
                K
              </div>
              <div>
                <p className="text-[var(--text-primary)] font-medium text-sm">Krishna Amarneni</p>
                <p className="text-[var(--text-muted)] text-xs">Full-Stack Developer &middot; AI Builder &middot; SAP Expert</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {[
                { icon: FiGithub, href: "https://github.com/krishnaamarneni", label: "GitHub" },
                { icon: FiLinkedin, href: "https://linkedin.com/in/krishnaamarneni", label: "LinkedIn" },
                { icon: FiMail, href: "mailto:krishna.amarneni@gmail.com", label: "Email Krishna Amarneni" },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="w-9 h-9 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[#ff6b00] hover:border-[#ff6b00]/20 transition-all"
                >
                  <Icon size={16} />
                </a>
              ))}

              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                aria-label="Back to top"
                title="Back to top"
                className="w-9 h-9 rounded-lg bg-[#ff6b00]/10 flex items-center justify-center text-[#ff6b00] hover:bg-[#ff6b00]/20 transition-all ml-2"
              >
                <FiArrowUp size={16} />
              </button>
            </div>
          </div>

          <div className="section-divider mt-6 mb-4" />

          <p className="text-center text-xs text-[var(--text-muted)]">
            &copy; {new Date().getFullYear()} Krishna Amarneni &middot; Built with Next.js, Tailwind CSS &amp; TypeScript
          </p>
        </div>
      </div>
    </footer>
  );
}
