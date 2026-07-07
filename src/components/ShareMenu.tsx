"use client";

import { useState, useEffect, useRef } from "react";
import {
  FiShare2,
  FiCopy,
  FiCheck,
  FiMail,
  FiX,
} from "react-icons/fi";
import {
  FaXTwitter,
  FaLinkedinIn,
  FaWhatsapp,
  FaFacebookF,
} from "react-icons/fa6";

type Props = {
  title: string;
  description: string;
  url: string;
  /** Tailwind classes for the trigger button */
  buttonClassName?: string;
  /** Label shown on the button next to the icon */
  label?: string;
};

export default function ShareMenu({
  title,
  description,
  url,
  buttonClassName,
  label = "Share",
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  // Close on click outside / Escape
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shareText = `${title} — ${description}`;
  const enc = encodeURIComponent;

  const links = [
    {
      key: "x",
      label: "X (Twitter)",
      icon: FaXTwitter,
      href: `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(url)}`,
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      icon: FaLinkedinIn,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: FaWhatsapp,
      href: `https://wa.me/?text=${enc(`${shareText} ${url}`)}`,
    },
    {
      key: "facebook",
      label: "Facebook",
      icon: FaFacebookF,
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
    },
    {
      key: "email",
      label: "Email",
      icon: FiMail,
      href: `mailto:?subject=${enc(title)}&body=${enc(`${description}\n\n${url}`)}`,
    },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {}
      document.body.removeChild(ta);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: description, url });
      setOpen(false);
    } catch {
      // user cancelled or share unavailable
    }
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          buttonClassName ??
          "inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white/[0.04] border border-[var(--border)] text-[var(--text-primary)] font-semibold text-sm hover:border-[#ff6b00]/40 hover:bg-[#ff6b00]/[0.08] transition-all"
        }
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <FiShare2 size={16} />
        {label}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute z-30 right-0 sm:left-0 sm:right-auto mt-2 min-w-[240px] rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[0_30px_80px_rgba(0,0,0,0.5)] overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <p className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#ff8c38]">
              Share
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-full hover:bg-white/[0.06] text-[var(--text-secondary)] flex items-center justify-center"
              aria-label="Close"
            >
              <FiX size={12} />
            </button>
          </div>

          <ul className="p-1.5">
            {canNativeShare && (
              <li>
                <button
                  type="button"
                  onClick={nativeShare}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--text-primary)] hover:bg-[#ff6b00]/[0.1] hover:text-[#ff8c38] transition-colors"
                >
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center text-black">
                    <FiShare2 size={13} />
                  </span>
                  Share via…
                </button>
              </li>
            )}

            {links.map((l) => (
              <li key={l.key}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--text-primary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)] transition-colors"
                >
                  <span className="w-7 h-7 rounded-full bg-white/[0.04] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)]">
                    <l.icon size={12} />
                  </span>
                  {l.label}
                </a>
              </li>
            ))}

            <li>
              <button
                type="button"
                onClick={copy}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--text-primary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)] transition-colors"
              >
                <span className="w-7 h-7 rounded-full bg-white/[0.04] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)]">
                  {copied ? <FiCheck size={12} className="text-emerald-400" /> : <FiCopy size={12} />}
                </span>
                {copied ? "Link copied!" : "Copy link"}
              </button>
            </li>
          </ul>

          {/* URL preview */}
          <div className="border-t border-[var(--border)] px-4 py-2.5">
            <p className="text-[9px] font-mono text-[var(--text-muted)] truncate" title={url}>
              {url}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
