"use client";

import { useEffect } from "react";
import { StoreProvider, useStore } from "@/store/store";
import { AppGate } from "@/components/app-gate";

function GestaoGuard() {
  const { session, loading } = useStore();

  useEffect(() => {
    if (!loading && session && session.primaryRole === "client") {
      window.location.replace("/cliente");
    }
  }, [session, loading]);

  return <AppGate />;
}

export default function GestaoPage() {
  return (
    <StoreProvider>
      <GestaoGuard />
    </StoreProvider>
  );
}
