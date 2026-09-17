"use client";

import { StoreProvider, useStore } from "@/store/store";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AdminLoginScreen } from "@/components/admin/admin-login-screen";

function AdminContent() {
  const { session, loading, reloadSession } = useStore();

  if (loading) {
    return (
      <div className="boot-screen">
        <span className="boot-spinner" />
        <p>Carregando painel de superadmin...</p>
      </div>
    );
  }

  // Se não houver sessão ou a sessão atual não tiver permissões de superadmin,
  // exibe a tela de login dedicada de Administrador
  if (!session || (!session.isSuperadmin && session.primaryRole !== "superadmin")) {
    return (
      <AdminLoginScreen
        currentSession={session}
        onAuthenticated={() => void reloadSession()}
      />
    );
  }

  return <AdminDashboard />;
}

export default function AdminPage() {
  return (
    <StoreProvider>
      <AdminContent />
    </StoreProvider>
  );
}
