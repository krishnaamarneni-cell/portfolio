import type { MetadataRoute } from "next";
import { fieldNotes } from "@/lib/field-notes";

function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "https://krishnaamarneni.com";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();

  const noteEntries: MetadataRoute.Sitemap = fieldNotes.map((n) => ({
    url: `${base}/notes/${n.slug}`,
    lastModified: n.date ? new Date(n.date) : now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${base}/notes`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${base}/investments`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/systems`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/sap`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...noteEntries,
  ];
}
