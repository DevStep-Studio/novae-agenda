"use client";

import { useEffect, type ReactNode } from "react";
import { StoreProvider, useStore } from "@/store/store";
import { ReserveiLogo } from "@/components/brand/novae-logo";

function ManagementAccess({ children }: { children: ReactNode }) {
  const { session, loading } = useStore();
  const redirectingToClient = !loading && session?.primaryRole === "client";

  useEffect(() => {
    if (redirectingToClient) window.location.replace("/cliente");
  }, [redirectingToClient]);

  if (redirectingToClient) {
    return (
      <div className="boot-screen">
        <ReserveiLogo size={36} priority />
        <span className="boot-spinner" />
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 500 }}>Abrindo seu espaço...</p>
      </div>
    );
  }

  return children;
}

export default function ManagementLayout({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <ManagementAccess>{children}</ManagementAccess>
    </StoreProvider>
  );
}
