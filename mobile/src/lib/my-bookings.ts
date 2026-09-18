import { api } from "./api-client";

// Mirrors the shape returned by listBookingDetails() in src/lib/booking/service.ts
// (root project) — GET /api/my/bookings. bookings.total/subtotal are MySQL decimal
// columns, which Drizzle returns as strings.
export type MyBookingItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePhotoUrl: string | null;
  employeeJobTitle: string | null;
  startTime: string;
  endTime: string;
  date: string;
  status: string;
  price: string;
  durationMinutes: number;
  serviceId: string;
  name: string;
};

export type MyBooking = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  total: string;
  company: {
    name: string;
    businessType: string | null;
    logoUrl: string | null;
    color: string | null;
    address: string | null;
    phone: string | null;
    slug: string | null;
    cancellationHours: number;
  };
  items: MyBookingItem[];
  canChange: boolean;
};

export async function getMyBookings() {
  return api<MyBooking[]>("/api/my/bookings");
}

export async function cancelMyBooking(id: string) {
  return api<{ id: string }>(`/api/my/bookings/${id}/cancel`, { method: "POST" });
}
