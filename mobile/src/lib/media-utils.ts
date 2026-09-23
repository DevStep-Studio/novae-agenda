/**
 * Centralized Media & Image URL Resolution for Reservei Web and Mobile.
 *
 * Rules:
 * 1. Absolute HTTPS/HTTP URLs are preserved.
 * 2. Data URIs (data:image/...) and file URIs (file://...) are preserved for instant preview.
 * 3. Relative URLs starting with / (e.g. /uploads/branding/xyz.webp) are prefixed with the active API base URL.
 * 4. Invalid, empty, or null inputs return null gracefully.
 */

export function resolveMediaUrl(
  url?: string | null,
  apiBaseUrl: string = "https://usereservei.com.br"
): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("file://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }

  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const base = apiBaseUrl.replace(/\/$/, "");
  return `${base}${normalizedPath}`;
}

export const resolveImageUrl = resolveMediaUrl;

export function resolveImageUrlWithFallback(
  url?: string | null,
  apiBaseUrl: string = "https://usereservei.com.br"
): { primary: string | null; fallback: string | null } {
  if (!url || typeof url !== "string") return { primary: null, fallback: null };
  const trimmed = url.trim();
  if (!trimmed) return { primary: null, fallback: null };

  if (trimmed.startsWith("data:") || trimmed.startsWith("file://")) {
    return { primary: trimmed, fallback: null };
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return { primary: trimmed, fallback: null };
  }

  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const base = apiBaseUrl.replace(/\/$/, "");
  const primary = `${base}${normalizedPath}`;
  const fallback = `https://usereservei.com.br${normalizedPath}`;

  return {
    primary,
    fallback: primary === fallback ? null : fallback,
  };
}
