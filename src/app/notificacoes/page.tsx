"use client";

import { StoreProvider } from "@/store/store";
import { AppGate } from "@/components/app-gate";

export default function NotificacoesPage() {
  return (
    <StoreProvider>
      <AppGate initialView="notificacoes" />
    </StoreProvider>
  );
}
