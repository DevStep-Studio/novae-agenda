"use client";

import { StoreProvider, useStore } from "@/store/store";
import { MyBookings } from "@/components/booking/my-bookings";
import { ReserveiLogo } from "@/components/brand/novae-logo";

function ClientContent() {
  const { loading } = useStore();

  if (loading) {
    return (
      <div className="boot-screen">
        <ReserveiLogo size={36} priority />
        <span className="boot-spinner" />
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 500 }}>Carregando seus agendamentos...</p>
      </div>
    );
  }

  return <MyBookings />;
}

export default function ClientePage() {
  return (
    <StoreProvider>
      <ClientContent />
    </StoreProvider>
  );
}
