import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getStaffSession, logout as apiLogout, type SessionInfo } from "./auth";
import { clearSession, setUnauthorizedHandler } from "./api-client";
import { registerForPushNotifications, unregisterPushNotifications } from "./push-notifications";

const SESSION_CACHE_KEY = "reservei_session_cache_v1";

interface SessionContextValue {
  session: SessionInfo | null;
  loading: boolean;
  /** Re-fetches GET /api/auth/session (call after login, or to pick up role/company changes). */
  refresh: () => Promise<SessionInfo | null>;
  setSessionData: (data: SessionInfo | null) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const setSessionData = useCallback((data: SessionInfo | null) => {
    setSession(data);
    if (data) {
      if (Platform.OS !== "web") {
        void SecureStore.setItemAsync(SESSION_CACHE_KEY, JSON.stringify(data)).catch(() => null);
      }
    } else {
      if (Platform.OS !== "web") {
        void SecureStore.deleteItemAsync(SESSION_CACHE_KEY).catch(() => null);
      }
    }
  }, []);

  const refresh = useCallback(async (): Promise<SessionInfo | null> => {
    try {
      const data = await getStaffSession();
      if (data && data.userId) {
        setSessionData(data);
        // Register push token with backend for this user
        void registerForPushNotifications();
        return data;
      }
      setSessionData(null);
      return null;
    } catch {
      return null;
    }
  }, [setSessionData]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSessionData(null);
      void unregisterPushNotifications();
    });
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [setSessionData]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (Platform.OS !== "web") {
        try {
          const cached = await SecureStore.getItemAsync(SESSION_CACHE_KEY);
          if (cached && !cancelled) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.userId) {
              setSession(parsed);
              setLoading(false);
            }
          }
        } catch {}
      }

      await refresh();
      if (!cancelled) setLoading(false);
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await unregisterPushNotifications();
    } catch {
      // Ignore errors unregistering push
    }
    try {
      await apiLogout();
    } catch {
      // Ignore network errors on logout
    }
    await clearSession();
    setSessionData(null);
  }, [setSessionData]);

  const value = useMemo(
    () => ({ session, loading, refresh, setSessionData, signOut }),
    [session, loading, refresh, setSessionData, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
