"use client";

import { StoreProvider } from "@/store/store";
import { AppGate } from "@/components/app-gate";

export default function HomePage() {
  return (
    <StoreProvider>
      <AppGate />
    </StoreProvider>
  );
}
