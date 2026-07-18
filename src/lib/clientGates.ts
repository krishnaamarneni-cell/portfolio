"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * True once the viewport is at least `min` wide. Starts `false` on the server
 * and on the first client paint, then flips after mount. We use this to decide
 * whether to mount the heavy 3D <Canvas> at all: on phones it stays false, so
 * three.js and the multi-MB .glb model are never downloaded or rendered.
 */
export function useIsDesktop(min = 768): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${min}px)`);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [min]);
  return isDesktop;
}

/**
 * Attaches an IntersectionObserver to the returned ref and reports `true` once
 * the element first scrolls within `rootMargin` of the viewport. Fires once,
 * then disconnects — used to defer mounting below-the-fold heavy content until
 * the user is about to reach it.
 */
export function useInView<T extends Element>(
  rootMargin = "300px"
): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);
  return [ref, inView];
}
