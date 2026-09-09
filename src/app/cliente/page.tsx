"use client";

import { StoreProvider } from "@/store/store";
import { ClientPortal } from "@/components/client/client-portal";

export default function ClientePage() {
  return (
    <StoreProvider>
      <ClientPortal />
    </StoreProvider>
  );
}
