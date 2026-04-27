"use client";

import Image from "next/image";
import { FiArrowRight } from "react-icons/fi";
import DownloadCard from "@/components/DownloadCard";

/* DESIGN 1 — Bold typography + photo on right */
export default function Banner1() {
  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-start overflow-auto p-8">
      <DownloadCard filename="krishna-banner-1" width={1584} height={396}>
      <div className="relative w-[1584px] h-[396px] overflow-hidden bg-gradient-to-br from-[#0a0a0a] via-[#1a0500] to-[#050505] shrink-0">
        {/* Glow */}
        <div className="absolute top-[-30%] right-[15%] w-[700px] h-[700px] bg-[#ff6b00]/[0.22] rounded-full blur-[160px]" />
        <div className="absolute bottom-[-40%] left-[5%] w-[500px] h-[500px] bg-[#ff3d00]/[0.12] rounded-full blur-[130px]" />

        {/* Hex grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='92' viewBox='0 0 80 92' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 4 L72 22 L72 58 L40 76 L8 58 L8 22 Z' fill='none' stroke='%23ff6b00' stroke-width='0.8'/%3E%3C/svg%3E")`,
            backgroundSize: "80px 70px",
          }}
        />

        <div className="relative z-10 h-full grid grid-cols-[1fr_400px] items-center px-20 gap-12">
          {/* LEFT — keep clear for LinkedIn profile photo overlap (~250px circle bottom-left) */}
          <div className="pl-[260px]">
            <p className="text-[#ff6b00] text-[12px] font-mono tracking-[0.4em] uppercase mb-3">
              ✦ Builder · SAP · AI · Web ✦
            </p>
            <h1 className="text-[68px] font-black leading-[0.95] tracking-tight text-white mb-4">
              I build at the intersection of{" "}
              <span className="bg-gradient-to-r from-[#ff6b00] via-[#ff8c38] to-[#ffaa66] bg-clip-text text-transparent">
                AI, SAP & Web.
              </span>
            </h1>
            <a className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] shadow-[0_8px_30px_rgba(255,107,0,0.5)]">
              <span className="text-white font-bold text-sm font-mono">krishnaamarneni.com</span>
              <FiArrowRight size={14} className="text-white" />
            </a>
          </div>

          {/* RIGHT — Photo with orange backdrop */}
          <div className="relative w-[340px] h-[340px] rounded-[28px] overflow-hidden bg-[#cc3a00]">
            <Image
              src="/Krishna.amarneni_ai-removebg-preview.png"
              alt="Krishna"
              fill
              priority
              className="object-cover object-[center_18%]"
              style={{ transform: "scale(1.1)" }}
            />
          </div>
        </div>
      </div>
      </DownloadCard>
    </main>
  );
}
