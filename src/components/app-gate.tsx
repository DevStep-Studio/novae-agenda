"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store/store";
import { AuthScreen } from "@/components/auth/auth-screen";
import { OnboardingScreen } from "@/components/auth/onboarding-screen";
import { ResetPasswordScreen } from "@/components/auth/reset-password-screen";
import { VerifyEmailScreen } from "@/components/auth/verify-email-screen";
import { AppShell } from "@/components/app-shell";
import { applyTheme, getStoredTheme } from "@/lib/theme";

function readTokenParams(): { verify: string | null; reset: string | null } {
  if (typeof window === "undefined") return { verify: null, reset: null };
  const params = new URLSearchParams(window.location.search);
  return { verify: params.get("verify"), reset: params.get("reset") };
}

function clearQuery() {
  if (typeof window !== "undefined") window.history.replaceState({}, "", window.location.pathname);
}

export function AppGate() {
  const { session, loading, reloadSession, logout } = useStore();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [params, setParams] = useState(readTokenParams);

  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  // Password reset link — available whether or not there's a session.
  if (params.reset) {
    return (
      <ResetPasswordScreen
        token={params.reset}
        onDone={() => {
          clearQuery();
          setParams({ verify: null, reset: null });
        }}
      />
    );
  }

  // E-mail confirmation link.
  if (params.verify) {
    return (
      <VerifyEmailScreen
        token={params.verify}
        authenticated={Boolean(session)}
        onVerified={async () => {
          clearQuery();
          setParams({ verify: null, reset: null });
          await reloadSession();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="boot-screen">
        <span className="boot-spinner" />
        <p>Carregando sua agenda...</p>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onAuthenticated={(needs) => setNeedsOnboarding(needs)} />;
  }

  if (!session.emailVerified) {
    return (
      <VerifyEmailScreen
        email={session.email}
        authenticated
        onVerified={() => reloadSession()}
        onLogout={logout}
      />
    );
  }

  if (needsOnboarding || !session.company?.onboarded) {
    return (
      <OnboardingScreen
        onComplete={async () => {
          await reloadSession();
          setNeedsOnboarding(false);
        }}
      />
    );
  }

  return <AppShell />;
}
