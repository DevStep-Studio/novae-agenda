"use client";

import { StoreProvider } from "@/store/store";
import { AppGate } from "@/components/app-gate";

export default function LoginPage() {
  return (
    <StoreProvider>
      <AppGate />
    </StoreProvider>
  );
}
