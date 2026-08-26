/**
 * Validates and sanitizes profile banner URLs to prevent XSS and malicious injections.
 * Enforces allowed protocols and length constraints.
 */
export function sanitizeBannerUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmedUrl = url.trim();

  // Enforce maximum length constraint for safety
  if (trimmedUrl.length > 2048) {
    return '';
  }

  try {
    const parsed = new URL(trimmedUrl);
    // Restrict strictly to safe web protocols
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // Invalid URL structure fails safely
  }

  return '';
}