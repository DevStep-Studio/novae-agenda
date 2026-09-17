"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store/store";
import { AuthScreen } from "@/components/auth/auth-screen";
import { OnboardingScreen } from "@/components/auth/onboarding-screen";
import { ResetPasswordScreen } from "@/components/auth/reset-password-screen";
import { VerifyEmailScreen } from "@/components/auth/verify-email-screen";
import { AppShell } from "@/components/app-shell";
import { MyBookings } from "@/components/booking/my-bookings";
import { EmployeeDashboard } from "@/components/employee/employee-dashboard";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { ReserveiLogo } from "@/components/brand/novae-logo";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import type { ManagementView } from "@/lib/management-routes";

function readTokenParams(): { verify: string | null; reset: string | null } {
  if (typeof window === "undefined") return { verify: null, reset: null };
  const params = new URLSearchParams(window.location.search);
  return { verify: params.get("verify"), reset: params.get("reset") };
}

function clearQuery() {
  if (typeof window !== "undefined") window.history.replaceState({}, "", window.location.pathname);
}

export function AppGate({ initialView }: { initialView?: ManagementView } = {}) {
  const { session, loading, reloadSession, logout } = useStore();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [params, setParams] = useState(readTokenParams);

  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  // Redireciona para /login se tentar acessar /gestao, /notificacoes ou /profissional sem sessão.
  // Não age enquanto a tela de reset de senha ou confirmação de e-mail estiver em exibição.
  useEffect(() => {
    if (!loading && !session && !params.reset && !params.verify && typeof window !== "undefined") {
      const pathname = window.location.pathname;
      if (
        pathname.startsWith("/gestao") ||
        pathname.startsWith("/notificacoes") ||
        pathname.startsWith("/profissional")
      ) {
        const returnTo = encodeURIComponent(pathname + window.location.search);
        window.location.replace(`/login?returnTo=${returnTo}`);
      }
    }
  }, [loading, session, params.reset, params.verify]);

  // Se estiver na rota /login e já possuir sessão ativa, redireciona para o destino ou painel
  useEffect(() => {
    if (!loading && session && !params.reset && !params.verify && typeof window !== "undefined") {
      if (window.location.pathname === "/login") {
        const searchParams = new URLSearchParams(window.location.search);
        const returnTo = searchParams.get("returnTo");
        const destination =
          returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
            ? returnTo
            : session.targetPortal ||
              (session.primaryRole === "employee"
                ? "/profissional"
                : session.primaryRole === "superadmin"
                ? "/admin"
                : "/gestao");
        window.location.replace(destination);
      }
    }
  }, [loading, session, params.reset, params.verify]);

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
        <ReserveiLogo size={36} priority />
        <span className="boot-spinner" />
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 500 }}>Carregando sua agenda...</p>
      </div>
    );
  }

  // Previne exibir a tela de login mantendo a URL de rotas internas no navegador
  if (!session) {
    if (
      typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/gestao") ||
        window.location.pathname.startsWith("/notificacoes") ||
        window.location.pathname.startsWith("/profissional"))
    ) {
      return (
        <div className="boot-screen">
          <ReserveiLogo size={36} priority />
          <span className="boot-spinner" />
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 500 }}>Redirecionando para o login...</p>
        </div>
      );
    }
    return <AuthScreen onAuthenticated={(needs) => setNeedsOnboarding(needs)} />;
  }

  // Se já estiver logado na página /login, aguarda redirecionamento para o dashboard
  if (typeof window !== "undefined" && window.location.pathname === "/login") {
    return (
      <div className="boot-screen">
        <ReserveiLogo size={36} priority />
        <span className="boot-spinner" />
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 500 }}>Acessando seu painel...</p>
      </div>
    );
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

  // Profile experiences:
  if (session.primaryRole === "superadmin" || session.targetPortal === "/admin") {
    return <AdminDashboard />;
  }

  if (session.primaryRole === "employee" || session.targetPortal === "/profissional") {
    return <EmployeeDashboard />;
  }

  if (
    session.primaryRole === "client" ||
    session.targetPortal === "/minhas-reservas" ||
    session.targetPortal === "/cliente"
  ) {
    return <MyBookings />;
  }

  // Business (owner, admin, manager)
  if (needsOnboarding || !session.company?.onboarded) {
    return (
      <OnboardingScreen
        onComplete={async () => {
          await reloadSession();
          setNeedsOnboarding(false);
        }}
        onLogout={logout}
      />
    );
  }

  return <AppShell initialView={initialView} />;
}
