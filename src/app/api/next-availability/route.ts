import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { bookingError, BookingError } from "@/lib/booking/errors";
import { loadAvailability } from "@/lib/booking/engine";
import { searchSchema } from "@/lib/booking/validation";
import { localDate, shiftDate } from "@/lib/booking/time";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  try {
    const [company] = await db.select().from(companies).where(eq(companies.id, gate.auth.user.companyId));
    const q = new URL(request.url).searchParams;
    const input = searchSchema.parse({ locationId: q.get("locationId"), date: q.get("date") || localDate(new Date(), company.timezone), items: JSON.parse(q.get("items") || "[]") });
    if (gate.auth.user.role === "employee" && input.items.some(i => i.employeeId !== gate.auth.user.employeeId)) throw new BookingError("Selecione sua própria agenda.", 403);
    const today = localDate(new Date(), company.timezone);
    const searchDate = input.date < today ? today : input.date;
    if (searchDate > shiftDate(today, 366)) throw new BookingError("Data fora do período de busca.");
    const engine = await loadAvailability(company, input.locationId, input.items, searchDate, shiftDate(searchDate, 6));
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = shiftDate(searchDate, i);
      const slots = engine.slots(date);
      if (slots.length) days.push({ date, slots: slots.slice(0, 6).map(s => ({ startTime: s.startTime, endTime: s.endTime, employeeId: s.items[0].employeeId })) });
      if (days.length >= 3) break;
    }
    return Response.json({ data: days }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return bookingError(error); }
}
