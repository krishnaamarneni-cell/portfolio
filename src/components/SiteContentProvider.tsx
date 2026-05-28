"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { SITE_CONTENT_FALLBACK } from "@/lib/site-content-fallback";
import type { SiteContent } from "@/lib/site-content-types";

const SiteContentContext = createContext<SiteContent>(SITE_CONTENT_FALLBACK);

export function useSiteContent(): SiteContent {
  return useContext(SiteContentContext);
}

export default function SiteContentProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [content, setContent] = useState<SiteContent>(SITE_CONTENT_FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site-content")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.content) setContent(d.content as SiteContent);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SiteContentContext.Provider value={content}>
      {children}
    </SiteContentContext.Provider>
  );
}
