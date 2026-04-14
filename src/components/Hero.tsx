"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { FiArrowDown } from "react-icons/fi";
import dynamic from "next/dynamic";

const Avatar3D = dynamic(
  () => import("./Avatar3D").then((mod) => ({ default: mod.HeroAvatar })),
  { ssr: false }
);

const roles = [
  "Full-Stack Developer",
  "AI Agent Developer",
  "SAP Business Analyst",
  "Vibe Coder",
  "Finance Tech Builder",
];

export default function Hero() {
  const [roleIndex, setRoleIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLElement>(null);
  const [currentTime, setCurrentTime] = useState("");
  const [landed, setLanded] = useState(false);

  const handleLanded = useCallback(() => {
    setLanded(true);
  }, []);

  useEffect(() => {
    const currentRole = roles[roleIndex];
    let timeout: NodeJS.Timeout;
    if (!deleting && text.length < currentRole.length) {
      timeout = setTimeout(() => setText(currentRole.slice(0, text.length + 1)), 80);
    } else if (!deleting && text.length === currentRole.length) {
      timeout = setTimeout(() => setDeleting(true), 2200);
    } else if (deleting && text.length > 0) {
      timeout = setTimeout(() => setText(text.slice(0, -1)), 40);
    } else if (deleting && text.length === 0) {
      setDeleting(false);
      setRoleIndex((prev) => (prev + 1) % roles.length);
    }
    return () => clearTimeout(timeout);
  }, [text, deleting, roleIndex]);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/New_York",
          hour12: false,
        })
      );
    };
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setMousePos({ x, y });
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative h-screen flex items-center justify-center"
      style={{ overflow: "clip" }}
    >
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-[-40px] opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='92' viewBox='0 0 80 92' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 4 L72 22 L72 58 L40 76 L8 58 L8 22 Z' fill='none' stroke='%23ff6b00' stroke-width='0.8'/%3E%3C/svg%3E")`,
            backgroundSize: "80px 70px",
            transform: `translate(${mousePos.x * -12}px, ${mousePos.y * -12}px)`,
            transition: "transform 0.4s ease-out",
          }}
        />
        <div className="absolute top-[10%] left-[8%] w-[120px] h-[120px] opacity-[0.06] animate-[floatHex1_12s_ease-in-out_infinite]">
          <svg viewBox="0 0 120 120"><path d="M60 10 L105 35 L105 85 L60 110 L15 85 L15 35 Z" fill="none" stroke="#ff6b00" strokeWidth="1.5"/></svg>
        </div>
        <div className="absolute top-[20%] right-[12%] w-[180px] h-[180px] opacity-[0.05] animate-[floatHex2_15s_ease-in-out_infinite]">
          <svg viewBox="0 0 120 120"><path d="M60 10 L105 35 L105 85 L60 110 L15 85 L15 35 Z" fill="none" stroke="#ff6b00" strokeWidth="1"/></svg>
        </div>
        <div className="absolute bottom-[15%] left-[15%] w-[90px] h-[90px] opacity-[0.07] animate-[floatHex3_10s_ease-in-out_infinite]">
          <svg viewBox="0 0 120 120"><path d="M60 10 L105 35 L105 85 L60 110 L15 85 L15 35 Z" fill="none" stroke="#ff6b00" strokeWidth="2"/></svg>
        </div>
        <div className="absolute bottom-[25%] right-[8%] w-[140px] h-[140px] opacity-[0.04] animate-[floatHex1_18s_ease-in-out_infinite_reverse]">
          <svg viewBox="0 0 120 120"><path d="M60 10 L105 35 L105 85 L60 110 L15 85 L15 35 Z" fill="none" stroke="#ff6b00" strokeWidth="1"/></svg>
        </div>
        <div
          className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-[#ff6b00]/[0.03] rounded-full blur-[200px]"
          style={{
            transform: `translate(${mousePos.x * 20}px, ${mousePos.y * 20}px)`,
            transition: "transform 0.5s ease-out",
          }}
        />
        <div
          className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-[#ff6b00]/[0.04] rounded-full blur-[150px]"
          style={{
            transform: `translate(${mousePos.x * -15}px, ${mousePos.y * -15}px)`,
            transition: "transform 0.5s ease-out",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 lg:px-10">
        {/* MOBILE layout: stacked vertically */}
        <div className="flex flex-col items-center justify-center md:hidden">
          <h1
            className="text-5xl sm:text-6xl font-black leading-[0.85] tracking-tighter text-white uppercase select-none opacity-0 animate-[slideInLeft_1s_0.4s_forwards]"
          >
            KRISHNA
          </h1>

          <div className="shrink-0 -my-2 opacity-0 animate-[fadeIn_0.3s_0.2s_forwards]">
            <Avatar3D mouseX={mousePos.x} mouseY={mousePos.y} onLanded={handleLanded} className="w-[280px] h-[360px]" />
          </div>

          <h1
            className="text-5xl sm:text-6xl font-black leading-[0.85] tracking-tighter text-gradient uppercase select-none opacity-0 animate-[slideInRight_1s_0.4s_forwards]"
          >
            AMARNENI
          </h1>

          <div className="mt-6 text-center opacity-0 animate-[fadeIn_1s_0.8s_forwards]">
            <p className="text-[#777] text-xs italic tracking-wider mb-1">SAP Expert &amp; AI Builder · Full-Stack Dev</p>
            <div className="text-base font-light h-7">
              <span className="text-[#999]">{text}</span>
              <span className="text-[#ff6b00] animate-pulse">|</span>
            </div>
            <p className="text-[#777] text-xs mt-2">New Jersey, USA · {currentTime} EST</p>
          </div>
        </div>

        {/* DESKTOP layout: KRISHNA [AVATAR] AMARNENI — all in one row */}
        <div className="hidden md:flex items-center justify-center">
          {/* KRISHNA */}
          <h1
            className="text-6xl lg:text-7xl xl:text-[90px] font-black leading-[0.85] tracking-tighter text-white uppercase select-none opacity-0 animate-[slideInLeft_1s_0.4s_forwards]"
            style={{
              transform: `translate(${mousePos.x * -5}px, ${mousePos.y * -3}px)`,
              transition: "transform 0.4s ease-out",
            }}
          >
            KRISHNA
          </h1>

          {/* Avatar */}
          <div className="shrink-0 mx-0 opacity-0 animate-[fadeIn_0.3s_0.2s_forwards]">
            <Avatar3D mouseX={mousePos.x} mouseY={mousePos.y} onLanded={handleLanded} />
          </div>

          {/* AMARNENI */}
          <h1
            className="text-6xl lg:text-7xl xl:text-[90px] font-black leading-[0.85] tracking-tighter text-gradient uppercase select-none opacity-0 animate-[slideInRight_1s_0.4s_forwards]"
            style={{
              transform: `translate(${mousePos.x * 5}px, ${mousePos.y * 3}px)`,
              transition: "transform 0.4s ease-out",
            }}
          >
            AMARNENI
          </h1>
        </div>

        {/* Labels row below (desktop only) */}
        <div className="hidden md:flex justify-between items-start mt-4 opacity-0 animate-[fadeIn_1s_0.8s_forwards]">
          <div>
            <p className="text-[#777] text-sm italic tracking-wider mb-1">SAP Expert &amp; AI Builder</p>
            <div className="text-lg font-light h-7">
              <span className="text-[#999]">{text}</span>
              <span className="text-[#ff6b00] animate-pulse">|</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[#777] text-sm italic tracking-wider mb-1">Full-Stack Developer</p>
            <p className="text-[#777] text-sm">New Jersey, USA · {currentTime} EST</p>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-0 animate-[fadeIn_0.8s_1.4s_forwards]">
        <span className="text-[#555] text-xs tracking-widest uppercase">Scroll</span>
        <FiArrowDown className="text-[#ff6b00] animate-bounce" size={18} />
      </div>
    </section>
  );
}
