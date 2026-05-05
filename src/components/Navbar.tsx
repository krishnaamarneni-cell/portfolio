"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { HiMenuAlt3, HiX } from "react-icons/hi";
import { FiHome } from "react-icons/fi";

// Order matches the actual section flow on the page
const navLinks = [
  { name: "About", href: "/#about", id: "about" },
  { name: "Experience", href: "/#experience", id: "experience" },
  { name: "Skills", href: "/#skills", id: "skills" },
  { name: "Projects", href: "/#projects", id: "projects" },
  { name: "Notes", href: "/notes", id: "notes" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("home"); // "home" | section id | "contact"
  const [visible, setVisible] = useState(true);

  // Refs for each nav item — used to position the sliding highlight
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  // Track active section based on scroll
  useEffect(() => {
    const onScroll = () => {
      setVisible(true);

      // If at the very top, "home" is active
      if (window.scrollY < 100) {
        setActive("home");
        return;
      }

      // Walk through sections from bottom to top
      const sections = ["contact", "projects", "skills", "experience", "about"];
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 200) {
          setActive(id);
          return;
        }
      }
      setActive("home");
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Reposition the orange pill whenever active changes (or on resize)
  useLayoutEffect(() => {
    const reposition = () => {
      const container = containerRef.current;
      const target = itemRefs.current[active];
      if (!container || !target) {
        setPill(null);
        return;
      }
      const cRect = container.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();
      setPill({
        left: tRect.left - cRect.left,
        width: tRect.width,
      });
    };

    reposition();
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [active]);

  return (
    <>
      {/* Bottom fixed nav with sliding orange pill */}
      <nav
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 hidden lg:block ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
        }`}
      >
        <div
          ref={containerRef}
          className="relative flex items-center gap-1 px-3 py-2.5 rounded-full bg-[#1a1a1a]/95 backdrop-blur-2xl border border-white/[0.06] shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
        >
          {/* Sliding ORANGE highlight pill */}
          {pill && (
            <div
              className="absolute top-1.5 bottom-1.5 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] shadow-[0_4px_20px_rgba(255,107,0,0.5)] transition-all duration-500 ease-out -z-0"
              style={{ left: pill.left, width: pill.width }}
            />
          )}

          {/* Home icon */}
          <a
            ref={(el) => { itemRefs.current["home"] = el; }}
            href="#"
            className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${
              active === "home" ? "text-black" : "text-[#999] hover:text-white"
            }`}
          >
            <FiHome size={16} />
          </a>

          {/* Nav links */}
          {navLinks.map((link) => (
            <a
              key={link.name}
              ref={(el) => { itemRefs.current[link.id] = el; }}
              href={link.href}
              className={`relative z-10 px-5 py-2 text-sm rounded-full transition-colors duration-300 font-medium whitespace-nowrap ${
                active === link.id ? "text-black" : "text-[#888] hover:text-white"
              }`}
            >
              {link.name}
            </a>
          ))}

          {/* Contact Me CTA */}
          <a
            ref={(el) => { itemRefs.current["contact"] = el; }}
            href="#contact"
            className={`relative z-10 px-5 py-2 text-sm rounded-full font-semibold transition-colors duration-300 whitespace-nowrap ${
              active === "contact" ? "text-black" : "text-black"
            }`}
            style={{
              // The contact button always has its own orange — but blends with pill when active
              background: active === "contact" ? "transparent" : "linear-gradient(to right, #ff6b00, #ff8c38)",
              boxShadow: active === "contact" ? "none" : undefined,
            }}
          >
            Contact me
          </a>
        </div>
      </nav>

      {/* Mobile bottom nav (header bar) */}
      <div className="fixed bottom-4 left-4 right-4 z-50 lg:hidden">
        <div
          className={`flex items-center justify-between px-4 py-3 rounded-2xl bg-[#1a1a1a]/95 backdrop-blur-2xl border border-white/[0.06] shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all duration-500 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
          }`}
        >
          <a
            href="#"
            className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center text-black font-bold text-sm shadow-[0_4px_15px_rgba(255,107,0,0.4)]"
          >
            K
          </a>
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#ff6b00]">
            {active === "home" ? "/ home" : `/ ${active}`}
          </span>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-white/10 text-white"
          >
            {mobileOpen ? <HiX size={18} /> : <HiMenuAlt3 size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile fullscreen menu */}
      <div
        className={`fixed inset-0 z-40 bg-[#0c0c0c] transition-all duration-500 lg:hidden flex flex-col ${
          mobileOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        }`}
      >
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          {[{ name: "Home", href: "#", id: "home" }, ...navLinks, { name: "Contact", href: "#contact", id: "contact" }].map((link, i) => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`text-4xl font-bold transition-all duration-300 py-3 ${
                active === link.id ? "text-[#ff6b00]" : "text-white hover:text-[#ff6b00]"
              }`}
              style={{
                transform: mobileOpen ? "translateY(0)" : "translateY(40px)",
                opacity: mobileOpen ? 1 : 0,
                transition: `all 0.5s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.08}s`,
              }}
            >
              {link.name}
            </a>
          ))}
        </div>
        <div className="pb-12 text-center">
          <a href="mailto:krishna.amarneni@gmail.com" className="text-[#ff6b00] text-sm">
            krishna.amarneni@gmail.com
          </a>
        </div>
      </div>
    </>
  );
}
