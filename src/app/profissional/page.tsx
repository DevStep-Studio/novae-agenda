"use client";

import { useEffect } from "react";
import { StoreProvider, useStore } from "@/store/store";
import { EmployeeDashboard } from "@/components/employee/employee-dashboard";
import { AuthScreen } from "@/components/auth/auth-screen";

function ProfissionalContent() {
  const { session, loading, reloadSession } = useStore();

  if (loading) {
    return (
      <div className="boot-screen">
        <span className="boot-spinner" />
        <p>Carregando painel do profissional...</p>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onAuthenticated={() => void reloadSession()} />;
  }

  return <EmployeeDashboard />;
}

export default function ProfissionalPage() {
  return (
    <StoreProvider>
      <ProfissionalContent />
    </StoreProvider>
  );
}
