import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { getStaffSession, logout as apiLogout, type SessionInfo } from "./auth";
import { clearSession, hasStoredSession, setUnauthorizedHandler } from "./api-client";

interface SessionContextValue {
  session: SessionInfo | null;
  loading: boolean;
  /** Re-fetches GET /api/auth/session (call after login, or to pick up role/company changes). */
  refresh: () => Promise<SessionInfo | null>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<SessionInfo | null> => {
    try {
      const data = await getStaffSession();
      if (data && data.userId) {
        setSession(data);
        return data;
      }
      setSession(null);
      return null;
    } catch {
      setSession(null);
      return null;
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSession(null);
    });
    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      await refresh();
      if (!cancelled) setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Ignore network errors on logout
    }
    await clearSession();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, loading, refresh, signOut }),
    [session, loading, refresh, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
