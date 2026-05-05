"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { HiMenuAlt3, HiX } from "react-icons/hi";
import { FiHome } from "react-icons/fi";
import { RxDragHandleDots2 } from "react-icons/rx";

// Order matches the actual section flow on the page
const navLinks = [
  { name: "About", href: "/#about", id: "about" },
  { name: "Experience", href: "/#experience", id: "experience" },
  { name: "Skills", href: "/#skills", id: "skills" },
  { name: "Projects", href: "/#projects", id: "projects" },
  { name: "Notes", href: "/notes", id: "notes" },
];

const STORAGE_KEY = "navbar-position";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("home");
  const [visible, setVisible] = useState(true);

  // Drag state
  const navRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  // Position state (null = use default bottom-center anchor)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const justDragged = useRef(false);

  // Restore saved position on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPos(JSON.parse(saved));
    } catch {}
  }, []);

  // Track active section based on scroll
  useEffect(() => {
    const onScroll = () => {
      setVisible(true);
      if (window.scrollY < 100) {
        setActive("home");
        return;
      }
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

  // Reposition the orange pill when active changes
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
      setPill({ left: tRect.left - cRect.left, width: tRect.width });
    };
    reposition();
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [active, pos]);

  // === DRAG HANDLERS ===
  const startDrag = (clientX: number, clientY: number) => {
    const nav = navRef.current;
    if (!nav) return;
    const rect = nav.getBoundingClientRect();
    dragOffset.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
    setIsDragging(true);
    justDragged.current = false;
  };

  const moveDrag = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    justDragged.current = true;
    const nav = navRef.current;
    if (!nav) return;
    const rect = nav.getBoundingClientRect();
    let x = clientX - dragOffset.current.x;
    let y = clientY - dragOffset.current.y;
    // Clamp to viewport
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    x = Math.max(0, Math.min(maxX, x));
    y = Math.max(0, Math.min(maxY, y));
    setPos({ x, y });
  };

  const endDrag = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (pos) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } catch {}
    }
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => moveDrag(e.clientX, e.clientY);
    const onMouseUp = () => endDrag();
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = () => endDrag();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  // Reset position to default
  const resetPosition = () => {
    setPos(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  // Position styles
  const navStyle: React.CSSProperties = pos
    ? { left: `${pos.x}px`, top: `${pos.y}px`, bottom: "auto" }
    : {};

  return (
    <>
      {/* Bottom fixed nav — DRAGGABLE */}
      <nav
        ref={navRef}
        className={`fixed z-50 transition-opacity duration-500 hidden lg:block ${
          pos ? "" : "bottom-6 left-1/2 -translate-x-1/2"
        } ${visible ? "opacity-100" : "opacity-0 pointer-events-none"} ${
          isDragging ? "cursor-grabbing scale-[1.02]" : ""
        }`}
        style={{
          ...navStyle,
          transition: isDragging
            ? "none"
            : "opacity 0.5s, transform 0.2s ease-out",
        }}
      >
        <div
          ref={containerRef}
          className="relative flex items-center gap-1 px-2 py-2.5 rounded-full bg-[#1a1a1a]/95 backdrop-blur-2xl border border-white/[0.06] shadow-[0_10px_40px_rgba(0,0,0,0.5)] group"
        >
          {/* === DRAG HANDLE === */}
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              startDrag(e.clientX, e.clientY);
            }}
            onTouchStart={(e) => {
              if (e.touches[0]) startDrag(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onDoubleClick={resetPosition}
            title="Drag to move · Double-click to reset position"
            className={`relative z-10 w-7 h-10 flex items-center justify-center text-[#555] hover:text-[#ff6b00] transition-colors ${
              isDragging ? "cursor-grabbing text-[#ff6b00]" : "cursor-grab"
            }`}
          >
            <RxDragHandleDots2 size={18} />
          </button>

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
            href="/"
            onClick={(e) => {
              if (justDragged.current) {
                e.preventDefault();
                justDragged.current = false;
              }
            }}
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
              onClick={(e) => {
                if (justDragged.current) {
                  e.preventDefault();
                  justDragged.current = false;
                }
              }}
              className={`relative z-10 px-5 py-2 text-sm rounded-full transition-colors duration-300 font-medium whitespace-nowrap ${
                active === link.id ? "text-black" : "text-[#888] hover:text-white"
              }`}
            >
              {link.name}
            </a>
          ))}

          {/* Contact Me CTA — orange outline */}
          <a
            href="/#contact"
            onClick={(e) => {
              if (justDragged.current) {
                e.preventDefault();
                justDragged.current = false;
              }
            }}
            className="relative z-10 ml-1 px-5 py-2 text-sm rounded-full font-semibold whitespace-nowrap text-[#ff6b00] border border-[#ff6b00]/50 bg-[#ff6b00]/[0.06] hover:bg-[#ff6b00] hover:text-black hover:border-[#ff6b00] hover:shadow-[0_4px_20px_rgba(255,107,0,0.4)] hover:scale-[1.03] active:scale-95 transition-all duration-200"
          >
            Contact me
          </a>
        </div>

        {/* "Drag me" hint — appears briefly on first hover */}
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-[#ff6b00] text-black text-[10px] font-mono uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">
          ✦ Drag the dots to move · Double-click to reset
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
            href="/"
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
          {[{ name: "Home", href: "/", id: "home" }, ...navLinks, { name: "Contact", href: "/#contact", id: "contact" }].map((link, i) => (
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
