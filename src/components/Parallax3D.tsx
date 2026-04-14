"use client";

import { useEffect, useRef, ReactNode } from "react";

export default function Parallax3D({
  children,
  speed = 0.05,
  rotateIntensity = 3,
  className = "",
}: {
  children: ReactNode;
  speed?: number;
  rotateIntensity?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const center = rect.top + rect.height / 2;
        const distFromCenter = (center - windowHeight / 2) / windowHeight;

        const translateY = distFromCenter * speed * 100;
        const rotateX = distFromCenter * rotateIntensity;

        el.style.transform = `perspective(1200px) translateY(${translateY}px) rotateX(${rotateX}deg)`;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [speed, rotateIntensity]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ willChange: "transform", transition: "transform 0.1s linear" }}
    >
      {children}
    </div>
  );
}
