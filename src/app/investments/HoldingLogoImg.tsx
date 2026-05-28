"use client";

import { holdingLogoUrl, holdingLogoFallbackUrl } from "@/lib/logo";

type Props = {
  domain: string;
  alt: string;
  className?: string;
};

/**
 * Client wrapper that tries Brandfetch first, falls back to Google favicon,
 * then hides itself so the parent can show the ticker initials.
 */
export default function HoldingLogoImg({ domain, alt, className }: Props) {
  const primary = holdingLogoUrl(domain);
  if (!primary) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={primary}
      alt={alt}
      className={className}
      loading="lazy"
      onError={(e) => {
        const img = e.currentTarget;
        const fallback = holdingLogoFallbackUrl(domain);
        if (fallback && img.src !== fallback) {
          img.src = fallback;
        } else {
          img.style.display = "none";
        }
      }}
    />
  );
}
