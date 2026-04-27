"use client";

import { useRef, useState, ReactNode } from "react";
import { toPng } from "html-to-image";
import { FiDownload, FiCheck } from "react-icons/fi";

export default function DownloadCard({
  children,
  filename,
  width,
  height,
  label = "Download PNG",
}: {
  children: ReactNode;
  filename: string;
  width: number;
  height: number;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    if (!ref.current || busy) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(ref.current, {
        cacheBust: true,
        pixelRatio: 2, // 2x for retina-quality
        width,
        height,
      });
      const link = document.createElement("a");
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2500);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Download failed — check the browser console.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Card */}
      <div ref={ref} className="shrink-0">
        {children}
      </div>

      {/* Download button */}
      <button
        onClick={handleDownload}
        disabled={busy}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-white font-bold text-sm shadow-[0_8px_30px_rgba(255,107,0,0.5)] hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-wait"
      >
        {downloaded ? (
          <>
            <FiCheck size={16} />
            Downloaded!
          </>
        ) : busy ? (
          <>
            <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <FiDownload size={16} />
            {label} ({width}×{height})
          </>
        )}
      </button>
    </div>
  );
}
