"use client";

import { useState, useEffect } from "react";
import { HiMenuAlt3, HiX } from "react-icons/hi";
import { FiHome } from "react-icons/fi";

const navLinks = [
  { name: "Skills", href: "#skills" },
  { name: "About", href: "#about" },
  { name: "Experience", href: "#experience" },
  { name: "Projects", href: "#projects" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      setVisible(true);

      const sections = ["skills", "about", "experience", "projects", "contact"];
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.getBoundingClientRect().top <= 200) {
          setActive(sections[i]);
          break;
        }
      }
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Bottom fixed nav — like reference site */}
      <nav
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${
          visible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-10 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-1 px-3 py-2.5 rounded-full bg-[#1a1a1a]/95 backdrop-blur-2xl border border-white/[0.06] shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
          {/* Home icon */}
          <a
            href="#"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
              !active
                ? "bg-[#ff6b00] text-black"
                : "text-[#999] hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            <FiHome size={16} />
          </a>

          {/* Nav links */}
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className={`px-5 py-2 text-sm rounded-full transition-all duration-300 font-medium whitespace-nowrap ${
                active === link.href.slice(1)
                  ? "bg-white/[0.08] text-white"
                  : "text-[#888] hover:text-white"
              }`}
            >
              {link.name}
            </a>
          ))}

          {/* Contact Me CTA */}
          <a
            href="#contact"
            className={`px-5 py-2 text-sm rounded-full font-semibold transition-all duration-300 whitespace-nowrap ${
              active === "contact"
                ? "bg-[#ff6b00] text-black"
                : "bg-[#ff6b00] text-black hover:bg-[#ff8c38]"
            }`}
          >
            Contact me
          </a>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-4 left-4 right-4 z-50 lg:hidden">
        <div
          className={`flex items-center justify-between px-4 py-3 rounded-2xl bg-[#1a1a1a]/95 backdrop-blur-2xl border border-white/[0.06] shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all duration-500 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
          }`}
        >
          <a href="#" className="w-10 h-10 rounded-full bg-[#ff6b00] flex items-center justify-center text-black font-bold text-sm">
            K
          </a>
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
          {[{ name: "Home", href: "#" }, ...navLinks, { name: "Contact", href: "#contact" }].map((link, i) => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="text-4xl font-bold text-white hover:text-[#ff6b00] transition-all duration-300 py-3"
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
