"use client";

import { useRef, ReactNode } from "react";

export default function TiltCard({
  children,
  className = "",
  intensity = 15,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    const glow = glowRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -intensity;
    const rotateY = ((x - centerX) / centerX) * intensity;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

    if (glow) {
      glow.style.opacity = "1";
      glow.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255, 107, 0, 0.12) 0%, transparent 60%)`;
    }
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    const glow = glowRef.current;
    if (card) {
      card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    }
    if (glow) {
      glow.style.opacity = "0";
    }
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative transition-transform duration-200 ease-out ${className}`}
      style={{ transformStyle: "preserve-3d" }}
    >
      {/* Glow overlay */}
      <div
        ref={glowRef}
        className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0 transition-opacity duration-300 z-10"
      />
      {/* Content */}
      <div style={{ transform: "translateZ(30px)", transformStyle: "preserve-3d" }}>
        {children}
      </div>
    </div>
  );
}
