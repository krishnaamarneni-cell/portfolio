"use client";

import { FiMail, FiArrowRight, FiZap } from "react-icons/fi";

export default function NewsletterFeatured() {
  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
      {/* 1200x630 LinkedIn featured card */}
      <div className="relative w-[1200px] h-[630px] rounded-[24px] overflow-hidden bg-gradient-to-br from-[#1a0a02] via-[#0a0a0a] to-[#1a0500] border border-white/[0.08] shadow-[0_30px_100px_rgba(255,107,0,0.25)]">
        {/* Background — animated mesh gradient feel */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[#ff6b00]/[0.15] rounded-full blur-[160px]" />
        <div className="absolute bottom-[-30%] right-[-10%] w-[600px] h-[600px] bg-[#ff3d00]/[0.1] rounded-full blur-[140px]" />
        <div className="absolute top-1/3 left-[-15%] w-[500px] h-[500px] bg-[#ffaa00]/[0.06] rounded-full blur-[120px]" />

        {/* Hex grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='92' viewBox='0 0 80 92' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 4 L72 22 L72 58 L40 76 L8 58 L8 22 Z' fill='none' stroke='%23ff6b00' stroke-width='0.8'/%3E%3C/svg%3E")`,
            backgroundSize: "80px 70px",
          }}
        />

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center px-16 text-center">
          {/* Badge at top */}
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.06] border border-white/[0.12] backdrop-blur-xl mb-8">
            <FiZap size={14} className="text-[#ff6b00]" />
            <span className="text-white text-sm font-mono uppercase tracking-[0.25em]">
              Weekly · Free · No Spam
            </span>
          </div>

          {/* Big headline */}
          <h1 className="text-[88px] font-black leading-[0.92] tracking-tight text-white mb-6 max-w-4xl">
            Smart insights on{" "}
            <span className="bg-gradient-to-r from-[#ff6b00] via-[#ff8c38] to-[#ffaa66] bg-clip-text text-transparent">
              AI, SAP & Wealth.
            </span>
            <br />
            Straight to your inbox.
          </h1>

          {/* Sub */}
          <p className="text-[#bbb] text-2xl leading-relaxed mb-10 max-w-3xl">
            Join <span className="text-white font-bold">5,000+ builders & professionals</span>
            {" "}getting weekly insights on AI agents, SAP systems, and the future of finance.
          </p>

          {/* Email-style CTA */}
          <div className="flex items-center gap-3 p-2 pl-6 rounded-full bg-white/[0.05] border border-white/[0.12] backdrop-blur-xl shadow-2xl">
            <FiMail size={20} className="text-[#888]" />
            <span className="text-[#666] text-lg font-mono pr-12">your@email.com</span>
            <button className="px-7 py-3 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-white font-bold text-lg flex items-center gap-2 shadow-[0_8px_30px_rgba(255,107,0,0.5)]">
              Subscribe Free
              <FiArrowRight size={18} />
            </button>
          </div>

          {/* Trust line */}
          <p className="text-[#666] text-sm mt-8 font-mono uppercase tracking-[0.25em]">
            ✦ KRISHNA AMARNENI · krishna.amarneni.com ✦
          </p>
        </div>
      </div>
    </main>
  );
}
