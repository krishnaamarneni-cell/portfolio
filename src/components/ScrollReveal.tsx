"use client";

import { useEffect, useRef, ReactNode } from "react";

type Direction = "up" | "left" | "right" | "scale" | "rotate3d" | "flipX" | "flipY" | "zoom3d";

export default function ScrollReveal({
  children,
  direction = "up",
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const classMap: Record<Direction, string> = {
    up: "reveal",
    left: "reveal-left",
    right: "reveal-right",
    scale: "reveal-scale",
    rotate3d: "reveal-rotate3d",
    flipX: "reveal-flipX",
    flipY: "reveal-flipY",
    zoom3d: "reveal-zoom3d",
  };

  return (
    <div
      ref={ref}
      className={`${classMap[direction]} ${className}`}
      style={{ transitionDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}
