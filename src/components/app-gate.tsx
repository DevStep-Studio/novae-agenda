"use client";

import { useState } from "react";
import { useStore } from "@/store/store";
import { AuthScreen } from "@/components/auth/auth-screen";
import { OnboardingScreen } from "@/components/auth/onboarding-screen";
import { AppShell } from "@/components/app-shell";

export function AppGate() {
  const { session, loading } = useStore();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  if (loading) {
    return <div className="boot-screen"><span className="boot-spinner" /><p>Carregando sua agenda...</p></div>;
  }

  if (!session) {
    return <AuthScreen onAuthenticated={(needs) => setNeedsOnboarding(needs)} />;
  }

  if (needsOnboarding || !session.company.onboarded) {
    return <OnboardingScreen onComplete={() => { setNeedsOnboarding(false); window.location.reload(); }} />;
  }

  return <AppShell />;
}
