"use client";

import { useState, ReactNode, createElement } from "react";

type Tag = "span" | "div" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

/**
 * Wrap any text with a soft orange spotlight that follows the cursor on hover.
 * Usage:
 *   <HoverSpotlight as="h2" className="...">Things I've Built</HoverSpotlight>
 */
export default function HoverSpotlight({
  children,
  as = "span",
  className = "",
  glowSize = 280,
  glowOpacity = 0.6,
}: {
  children: ReactNode;
  as?: Tag;
  className?: string;
  glowSize?: number;
  glowOpacity?: number;
}) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  return createElement(
    as,
    {
      className: `relative inline-block ${className}`,
      onMouseMove: (e: React.MouseEvent<HTMLElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      },
      onMouseEnter: () => setActive(true),
      onMouseLeave: () => setActive(false),
      style: { position: "relative" as const },
    },
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute rounded-full transition-opacity duration-300 -z-10"
        style={{
          width: `${glowSize}px`,
          height: `${glowSize}px`,
          left: pos.x,
          top: pos.y,
          transform: "translate(-50%, -50%)",
          opacity: active ? glowOpacity : 0,
          background:
            "radial-gradient(circle, rgba(255,140,56,1) 0%, rgba(255,107,0,0.6) 30%, transparent 70%)",
          filter: "blur(40px)",
          willChange: "left, top, opacity",
        }}
      />
      <span className="relative z-10">{children}</span>
    </>
  );
}
