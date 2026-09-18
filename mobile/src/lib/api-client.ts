import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// expo-secure-store has no Keychain/Keystore equivalent on web and throws at call
// time there. The mobile app's real targets are iOS/Android (App Store, Play
// Store) — this in-memory fallback exists only so `expo start --web` doesn't
// hard-crash during development/preview; it is never what a shipped build uses.
const webMemoryStore = new Map<string, string>();
const Store = Platform.OS === "web"
  ? {
      getItemAsync: async (key: string) => webMemoryStore.get(key) ?? null,
      setItemAsync: async (key: string, value: string) => {
        webMemoryStore.set(key, value);
      },
      deleteItemAsync: async (key: string) => {
        webMemoryStore.delete(key);
      },
    }
  : SecureStore;

/**
 * Reservei's backend (the Next.js app this folder is a sibling of) authenticates
 * with a single httpOnly cookie, `agenda_session` (+ optional `active_company_id`
 * for multi-tenant users) — see src/lib/auth.ts in the root project. There is no
 * bearer-token path anywhere in the API (confirmed by full-repo grep), and we are
 * not allowed to add one without touching the web app, so this client manages the
 * session cookie itself instead of relying on a native cookie jar:
 *
 *   1. On login, read the `Set-Cookie` response header directly. Unlike browser
 *      fetch (which treats Set-Cookie as a forbidden response header for CORS/XSS
 *      reasons that don't apply to a first-party native app), React Native's fetch
 *      exposes it via `response.headers.get("set-cookie")`.
 *   2. Persist the raw cookie pair string in SecureStore (Keychain/Keystore).
 *   3. Attach it as a `Cookie` header on every subsequent request by hand.
 *
 * If a future backend change adds bearer-token auth, this is the only file that
 * needs to change.
 */

const DEFAULT_API_URL = "https://usereservei.com.br";
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/$/, "");

const SESSION_COOKIE_KEY = "reservei_session_cookie";
const RELEVANT_COOKIE_NAMES = ["agenda_session", "active_company_id"];

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let cachedCookieHeader: string | null | undefined; // undefined = not loaded yet

async function loadStoredCookie(): Promise<string | null> {
  if (cachedCookieHeader !== undefined) return cachedCookieHeader;
  cachedCookieHeader = await Store.getItemAsync(SESSION_COOKIE_KEY);
  return cachedCookieHeader;
}

async function persistCookie(cookieHeader: string | null) {
  cachedCookieHeader = cookieHeader;
  if (cookieHeader) {
    await Store.setItemAsync(SESSION_COOKIE_KEY, cookieHeader);
  } else {
    await Store.deleteItemAsync(SESSION_COOKIE_KEY);
  }
}

/** Merges newly-set cookies from a Set-Cookie response header into the stored pair. */
function mergeCookies(existing: string | null, setCookieHeader: string): string {
  const current = new Map<string, string>();
  for (const part of (existing ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name && rest.length) current.set(name, rest.join("="));
  }

  // A combined Set-Cookie header (multiple cookies from one response) is joined with
  // ", " per the Fetch spec's getSetCookie()/splitCookiesString behavior; individual
  // cookie attributes (Path=, HttpOnly, etc.) are comma-free so a naive split on ", "
  // is safe here in practice for this backend's own cookies.
  const cookieStrings = setCookieHeader.split(/,(?=\s*[^;=\s]+=)/);
  for (const cookieString of cookieStrings) {
    const firstPair = cookieString.trim().split(";")[0];
    const [name, ...rest] = firstPair.split("=");
    if (name && RELEVANT_COOKIE_NAMES.includes(name.trim())) {
      current.set(name.trim(), rest.join("="));
    }
  }

  return Array.from(current.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

type ApiOptions = RequestInit & { skipAuth?: boolean };

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const cookie = await loadStoredCookie();
  const { skipAuth, ...init } = options;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(cookie && !skipAuth ? { cookie } : {}),
      ...(init.headers ?? {}),
    },
  });

  const setCookieHeader = res.headers.get("set-cookie");
  if (setCookieHeader) {
    await persistCookie(mergeCookies(cookie, setCookieHeader));
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = body?.error ?? "Não foi possível concluir a operação. Tente novamente.";
    throw new ApiError(message, res.status, body?.code);
  }

  return body?.data as T;
}

export async function clearSession() {
  await persistCookie(null);
}

export async function hasStoredSession(): Promise<boolean> {
  const cookie = await loadStoredCookie();
  return Boolean(cookie && cookie.includes("agenda_session="));
}

// Mirrors formatPhoneForWhatsApp in src/lib/api-client.ts (root project) —
// same file, same export name there too.
export function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return "";
  return digits.length <= 11 ? `55${digits}` : digits;
}
