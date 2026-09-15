/**
 * True in local/dev/test runs (never in a production build).
 * Used to expose one-time auth tokens in API responses so local testing and
 * end-to-end suites don't have to scrape server logs or a real inbox.
 */
export function isDevLike(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.EMAIL_TRANSPORT !== "resend";
}

/** Returns `{ devToken }` in dev-like environments, `{}` otherwise. Spread into a JSON payload. */
export function devTokenField(token: string): Record<string, string> {
  return isDevLike() ? { devToken: token } : {};
}
