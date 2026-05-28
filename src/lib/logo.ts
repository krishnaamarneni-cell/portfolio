/**
 * Returns a logo URL for a given domain via Google's favicon service.
 * Safe to call from both server and client components.
 */
export function holdingLogoUrl(domain?: string | null): string | null {
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    domain
  )}&sz=128`;
}
