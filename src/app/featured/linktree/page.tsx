"use client";

import Image from "next/image";
import {
  FiLinkedin,
  FiYoutube,
  FiMail,
  FiBookOpen,
  FiTool,
  FiGlobe,
  FiArrowRight,
  FiCheck,
} from "react-icons/fi";
import { FaXTwitter } from "react-icons/fa6";

export default function LinktreeFeatured() {
  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
      {/* 1200x630 LinkedIn featured card */}
      <div className="relative w-[1200px] h-[630px] rounded-[24px] overflow-hidden bg-gradient-to-br from-[#1a0500] via-[#0a0a0a] to-[#050505] border border-white/[0.08] shadow-[0_30px_100px_rgba(255,107,0,0.3)]">
        {/* Glow blobs */}
        <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] bg-[#ff6b00]/[0.2] rounded-full blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#ff3d00]/[0.12] rounded-full blur-[120px]" />

        {/* Hex grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='92' viewBox='0 0 80 92' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 4 L72 22 L72 58 L40 76 L8 58 L8 22 Z' fill='none' stroke='%23ff6b00' stroke-width='0.8'/%3E%3C/svg%3E")`,
            backgroundSize: "80px 70px",
          }}
        />

        {/* Two-column layout */}
        <div className="relative z-10 h-full grid grid-cols-[1.3fr_1fr] gap-8 p-14">
          {/* LEFT: Pitch */}
          <div className="flex flex-col justify-center">
            <p className="text-[#ff6b00] text-xs font-mono tracking-[0.3em] uppercase mb-5">
              ✦ All my links · One page
            </p>

            <h1 className="text-[68px] font-black leading-[0.92] tracking-tight text-white mb-5">
              Everything I build,
              <br />
              <span className="bg-gradient-to-r from-[#ff6b00] via-[#ff8c38] to-[#ffaa66] bg-clip-text text-transparent">
                in one link.
              </span>
            </h1>

            <p className="text-[#bbb] text-lg leading-relaxed mb-7 max-w-lg">
              Free finance courses, AI tools, my newsletter, projects & socials —
              all on one page. Built it myself, so it actually loads fast.
            </p>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-2 mb-7">
              {["Free Course", "Free Tools", "FIRE Score", "Newsletter", "Projects"].map(
                (badge) => (
                  <span
                    key={badge}
                    className="px-3 py-1.5 rounded-full bg-white/[0.05] border border-[#ff6b00]/20 text-[#ff8c38] text-xs font-mono uppercase tracking-wider"
                  >
                    {badge}
                  </span>
                )
              )}
            </div>

            {/* URL CTA */}
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] shadow-[0_8px_30px_rgba(255,107,0,0.5)] w-fit">
              <span className="text-white font-bold text-base font-mono">
                krishnaamarneni.com/linktree
              </span>
              <FiArrowRight size={18} className="text-white" />
            </div>
          </div>

          {/* RIGHT: Phone-style preview */}
          <div className="flex items-center justify-center">
            <div className="relative w-[280px] h-[520px] rounded-[36px] bg-[#050505] border-[6px] border-[#1a1a1a] shadow-[0_30px_80px_rgba(0,0,0,0.6)] overflow-hidden">
              {/* Phone notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#1a1a1a] rounded-b-2xl z-30" />

              {/* Mini linktree screenshot */}
              <div className="relative w-full h-full overflow-hidden">
                {/* Orange hero with photo */}
                <div className="relative w-full h-[280px] bg-[#cc3a00] overflow-hidden">
                  <Image
                    src="/Krishna.amarneni_ai-removebg-preview.png"
                    alt="Krishna"
                    fill
                    className="object-cover"
                    style={{
                      objectPosition: "50% 25%",
                      transform: "scale(1.15)",
                      transformOrigin: "center top",
                    }}
                  />
                  {/* Bottom fade */}
                  <div
                    className="absolute inset-x-0 bottom-0 h-[160px]"
                    style={{
                      background:
                        "linear-gradient(to bottom, transparent 0%, rgba(5,5,5,0.5) 50%, #050505 100%)",
                    }}
                  />
                </div>

                {/* Name + verified */}
                <div className="absolute top-[230px] left-0 right-0 flex flex-col items-center gap-1.5 z-20">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-white font-bold text-base">Krishna Amarneni</h3>
                    <svg viewBox="0 0 22 22" className="w-3.5 h-3.5">
                      <defs>
                        <linearGradient id="goldMini" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#ffd95a" />
                          <stop offset="100%" stopColor="#d18a00" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"
                        fill="url(#goldMini)"
                      />
                    </svg>
                  </div>
                  <p className="text-white/80 text-[8px] font-medium">Builder · SAP · AI · Web</p>
                </div>

                {/* Mini link cards */}
                <div className="absolute top-[310px] left-3 right-3 space-y-1.5">
                  {[
                    { Icon: FiBookOpen, name: "Free Course", color: "from-[#ff6b00] to-[#ff8c38]" },
                    { Icon: FiTool, name: "Free Tools", color: "from-[#ff6b00] to-[#ff8c38]" },
                    { Icon: FiGlobe, name: "Portfolio", color: "from-[#ff6b00] to-[#ff8c38]" },
                  ].map(({ Icon, name, color }) => (
                    <div
                      key={name}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.04] border border-white/[0.08]"
                    >
                      <div
                        className={`w-7 h-7 rounded-md bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}
                      >
                        <Icon size={12} className="text-white" />
                      </div>
                      <span className="text-white text-[10px] font-semibold flex-1">{name}</span>
                      <FiArrowRight size={9} className="text-[#666]" />
                    </div>
                  ))}
                </div>

                {/* Mini social row */}
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                  {[FiLinkedin, FiYoutube, FaXTwitter, FiMail].map((Icon, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center"
                    >
                      <Icon size={10} className="text-[#aaa]" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
