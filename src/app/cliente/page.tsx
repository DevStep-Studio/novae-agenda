"use client";

import { StoreProvider, useStore } from "@/store/store";
import { ClientPortal } from "@/components/client/client-portal";
import { ReserveiLogo } from "@/components/brand/novae-logo";

function ClientContent() {
  const { session, loading, logout } = useStore();

  if (loading) {
    return (
      <div className="boot-screen">
        <ReserveiLogo size={36} priority />
        <span className="boot-spinner" />
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 500 }}>Carregando seu espaço...</p>
      </div>
    );
  }

  return <ClientPortal initialSession={session} onLogout={logout} />;
}

export default function ClientePage() {
  return (
    <StoreProvider>
      <ClientContent />
    </StoreProvider>
  );
}
