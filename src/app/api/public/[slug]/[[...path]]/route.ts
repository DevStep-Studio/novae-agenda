import { quoteBooking, quoteSchema } from "@/lib/booking/pricing";
import { z } from "zod";
import { db } from "@/db";
import { bookingEvents, bookingWaitlist } from "@/db/schema";
import { getIdentity } from "@/lib/auth";
import { publicCatalog, publicCompany } from "@/lib/booking/catalog";
import { loadAvailability } from "@/lib/booking/engine";
import { BookingError, bookingError, sameOrigin } from "@/lib/booking/errors";
import { ownedBooking } from "@/lib/booking/service";
import { localDate, shiftDate } from "@/lib/booking/time";
import {
  dateSchema,
  searchSchema,
  selectionSchema,
} from "@/lib/booking/validation";
import { consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ slug: string; path?: string[] }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const limit = await consumeRateLimit(`public:${clientIp(request)}`, {
      limit: 180,
      windowMs: 60000,
      blockMs: 60000,
    });
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);
    const { slug, path = [] } = await params,
      action = path.join("/");
    if (!action || action === "services" || action === "professionals") {
      const catalog = await publicCatalog(slug);
      return Response.json(
        {
          data:
            action === "services"
              ? catalog.services
              : action === "professionals"
                ? catalog.professionals
                : catalog,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!["availability", "next-availability"].includes(action))
      throw new BookingError("Página não encontrada.", 404);
    const q = new URL(request.url).searchParams,
      company = await publicCompany(slug);
    let items: unknown;
    try {
      items = JSON.parse(q.get("items") ?? "[]");
    } catch {
      throw new BookingError("Seleção inválida.");
    }
    const input = searchSchema.parse({
      locationId: q.get("locationId"),
      date: q.get("date") ?? localDate(new Date(), company.timezone),
      items,
    });
    const days =
      action === "next-availability"
        ? 60
        : z.coerce
            .number()
            .int()
            .min(1)
            .max(31)
            .parse(q.get("days") ?? 1);
    const today = localDate(new Date(), company.timezone);
    if (
      input.date < shiftDate(today, -31) ||
      input.date > shiftDate(today, 366)
    )
      throw new BookingError("Data fora do período de busca.");
    const exclude = q.get("bookingId") ?? undefined;
    if (exclude) {
      z.uuid().parse(exclude);
      const user = await getIdentity();
      if (!user) throw new BookingError("Entre na sua conta.", 401);
      const booking = await ownedBooking(exclude, user.id);
      if (booking.companyId !== company.id)
        throw new BookingError("Agendamento não encontrado.", 404);
    }
    const engine = await loadAvailability(
      company,
      input.locationId,
      input.items,
      input.date,
      shiftDate(input.date, days - 1),
      db,
      exclude,
    );
    const dates = [];
    for (let i = 0; i < days; i++) {
      const date = shiftDate(input.date, i),
        slots = engine.slots(date);
      if (action === "next-availability" && slots.length)
        return Response.json({ data: { date, slot: publicSlot(slots[0]) } });
      dates.push({ date, count: slots.length });
    }
    return Response.json(
      {
        data:
          action === "next-availability"
            ? null
            : { dates, slots: engine.slots(input.date).map(publicSlot) },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return bookingError(error);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const { slug, path = [] } = await params;
    const company = await publicCompany(slug);
    const limit = await consumeRateLimit(`public-write:${clientIp(request)}`, {
      limit: 60,
      windowMs: 60000,
      blockMs: 60000,
    });
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);
    const body = await request.json();
    if (path.join("/") === "quote") {
      const quote = await quoteBooking(company, quoteSchema.parse(body));
      return Response.json({
        data: {
          subtotal: quote.subtotal,
          discount: quote.discount,
          total: quote.total,
        },
      });
    }
    if (path.join("/") === "events") {
      const data = z
        .object({
          sessionId: z.uuid(),
          event: z.enum([
            "public_profile_view",
            "service_selected",
            "date_selected",
            "time_selected",
            "checkout_started",
          ]),
        })
        .parse(body);
      await db.insert(bookingEvents).values({ ...data, companyId: company.id });
    } else if (path.join("/") === "waitlist") {
      const user = await getIdentity();
      if (!user) throw new BookingError("Entre na sua conta.", 401);
      const data = z
        .object({ date: dateSchema, items: selectionSchema })
        .parse(body);
      await db.insert(bookingWaitlist).values({
        companyId: company.id,
        userId: user.id,
        requestedDate: data.date,
        serviceIds: data.items.map((i) => i.serviceId),
      });
    } else throw new BookingError("Página não encontrada.", 404);
    return Response.json({ data: { ok: true } });
  } catch (error) {
    return bookingError(error);
  }
}

function publicSlot(slot: import("@/lib/booking/engine").AvailableSlot) {
  return {
    startTime: slot.startTime,
    endTime: slot.endTime,
    items: slot.items.map(
      ({
        commissionType: _commissionType,
        commissionValue: _commissionValue,
        ...item
      }) => item,
    ),
  };
}
