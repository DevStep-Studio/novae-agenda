"use client";

import { useEffect } from "react";
import { StoreProvider, useStore } from "@/store/store";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AuthScreen } from "@/components/auth/auth-screen";

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

  if (!session) {
    return <AuthScreen onAuthenticated={() => void reloadSession()} />;
  }

  if (!session.isSuperadmin && session.primaryRole !== "superadmin") {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#ffffff", background: "#080808", minHeight: "100vh" }}>
        <h2 style={{ fontSize: 22, color: "#f87171" }}>Acesso Restrito</h2>
        <p style={{ marginTop: 12, color: "rgba(255,255,255,0.7)" }}>Esta área é reservada exclusivamente para o superadmin da plataforma Reservei.</p>
        <a href="/" style={{ display: "inline-block", marginTop: 24, padding: "10px 20px", background: "#dcff4c", color: "#080808", borderRadius: 8, fontWeight: 700, textDecoration: "none" }}>
          Voltar ao meu painel
        </a>
      </div>
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
