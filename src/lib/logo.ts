/**
 * Logo URL helpers. Brandfetch's CDN serves high-quality square logos by
 * domain — no API key needed for these public domain-keyed requests.
 * Google's favicon service is a small but reliable fallback when Brandfetch
 * doesn't recognise the domain.
 *
 * Safe to call from both server and client components.
 */

export function holdingLogoUrl(domain?: string | null): string | null {
  if (!domain) return null;
  return `https://cdn.brandfetch.io/${encodeURIComponent(domain)}`;
}

export function holdingLogoFallbackUrl(domain?: string | null): string | null {
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    domain
  )}&sz=128`;
}
