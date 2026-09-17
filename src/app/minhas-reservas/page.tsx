import { StoreProvider } from "@/store/store";
import { MyBookings } from "@/components/booking/my-bookings";

export const metadata = {
  title: "Minhas Reservas | Reservei",
  description: "Acompanhe, remarque ou cancele seus agendamentos no Reservei.",
  robots: { index: false, follow: false },
};

export default function MinhasReservasPage() {
  return (
    <StoreProvider>
      <MyBookings />
    </StoreProvider>
  );
}
