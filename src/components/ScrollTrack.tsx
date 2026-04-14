"use client";

import { useEffect, useRef } from "react";

export default function ScrollTrack({
  text = "EXPERIENCE",
  direction = "left",
}: {
  text?: string;
  direction?: "left" | "right";
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const windowH = window.innerHeight;
        const progress = (windowH - rect.top) / (windowH + rect.height);
        const clampedProgress = Math.max(0, Math.min(1, progress));
        const move = direction === "left"
          ? -(clampedProgress * 600)
          : -600 + (clampedProgress * 600);

        el.style.transform = `translateX(${move}px)`;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [direction]);

  const repeated = `${text} · ${text} · ${text} · ${text} · ${text} · ${text} · `;

  return (
    <div className="overflow-hidden py-8 select-none pointer-events-none">
      <div
        ref={trackRef}
        className="whitespace-nowrap will-change-transform"
        style={{ transition: "transform 0.05s linear" }}
      >
        <span className="text-[120px] md:text-[160px] lg:text-[200px] font-bold text-stroke-orange leading-none tracking-tight">
          {repeated}
        </span>
      </div>
    </div>
  );
}
