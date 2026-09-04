/**
 * Best-effort client IP extraction from a Next.js Request.
 * Falls back to a stable sentinel so rate-limit buckets still work locally.
 */
export function clientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    headers.get("x-vercel-forwarded-for") ??
    "0.0.0.0"
  );
}
