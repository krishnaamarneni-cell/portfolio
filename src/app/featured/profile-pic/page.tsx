"use client";

import Image from "next/image";
import DownloadCard from "@/components/DownloadCard";

/* LinkedIn profile pic — 400x400 (displayed as a circle) */
export default function ProfilePic() {
  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center p-8 gap-12 flex-wrap">
      {/* Square version (upload this to LinkedIn — they auto-circle it) */}
      <DownloadCard filename="krishna-profile-pic" width={400} height={400} label="Download Profile Pic">
        <div className="relative w-[400px] h-[400px] overflow-hidden bg-gradient-to-br from-[#ff6b00] via-[#ff5500] to-[#cc3a00]">
          {/* Lighting */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,200,150,0.5),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(0,0,0,0.4),transparent_50%)]" />
          {/* Grain */}
          <div
            className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
          />
          {/* Photo */}
          <Image
            src="/Krishna.amarneni_ai-removebg-preview.png"
            alt="Krishna Amarneni"
            fill
            priority
            className="object-cover object-[center_15%]"
            style={{ transform: "scale(1.18)" }}
          />
        </div>
      </DownloadCard>

      {/* Circle preview (how it'll look on LinkedIn) */}
      <div className="flex flex-col items-center gap-4">
        <p className="text-white text-sm font-mono tracking-[0.2em] uppercase">
          How it&apos;ll show on LinkedIn
        </p>
        <div className="relative w-[400px] h-[400px] rounded-full overflow-hidden bg-gradient-to-br from-[#ff6b00] via-[#ff5500] to-[#cc3a00] shadow-[0_30px_80px_rgba(255,107,0,0.4)] border-[4px] border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,200,150,0.5),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(0,0,0,0.4),transparent_50%)]" />
          <div
            className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
          />
          <Image
            src="/Krishna.amarneni_ai-removebg-preview.png"
            alt="Krishna Amarneni"
            fill
            priority
            className="object-cover object-[center_15%]"
            style={{ transform: "scale(1.18)" }}
          />
        </div>
      </div>
    </main>
  );
}
