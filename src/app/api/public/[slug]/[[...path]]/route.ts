import { quoteBooking, quoteSchema } from "@/lib/booking/pricing";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingEvents, bookingWaitlist, notifications } from "@/db/schema";
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
    const groupsLimit = z.coerce.number().int().min(1).max(3).parse(q.get("groups") ?? 3);
    const days =
      action === "next-availability"
        ? 14
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
    const nextDays = [];
    let firstSlotFound = null;
    const tomorrow = shiftDate(today, 1);

    const formatDayLabel = (d: string) => {
      if (d === today) return "Hoje";
      if (d === tomorrow) return "Amanhã";
      try {
        const parsed = new Date(`${d}T12:00:00Z`);
        const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(parsed);
        const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(parsed);
        const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
        return `${capitalized}, ${dayMonth}`;
      } catch {
        return d;
      }
    };

    for (let i = 0; i < days; i++) {
      const date = shiftDate(input.date, i);
      const slots = engine.slots(date);
      dates.push({ date, count: slots.length });

      if (slots.length > 0) {
        if (!firstSlotFound) {
          firstSlotFound = { date, slot: publicSlot(slots[0]) };
        }
        if (nextDays.length < 5) {
          nextDays.push({
            date,
            label: formatDayLabel(date),
            slots: slots.filter((_, index) => index % Math.max(1, Math.floor(slots.length / 5)) === 0).slice(0, 5).map(publicSlot),
            totalCount: slots.length,
          });
        }
      }
      if (action === "next-availability" && nextDays.length >= groupsLimit) break;
    }

    if (action === "next-availability") {
      if (!firstSlotFound) {
        return Response.json({ data: null }, { headers: { "Cache-Control": "no-store" } });
      }
      return Response.json(
        {
          data: {
            date: firstSlotFound.date,
            slot: firstSlotFound.slot,
            nextDays,
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(
      {
        data: {
          dates,
          slots: engine.slots(input.date).map(publicSlot),
          nextDays,
        },
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
          sessionId: z.string().min(1).max(100),
          event: z.string().min(1).max(50),
        })
        .parse(body);

      // Normalize event names if necessary
      const normalizedEvent = data.event === "booking_page_view" ? "public_profile_view" : data.event;

      await db.insert(bookingEvents).values({
        sessionId: data.sessionId,
        event: normalizedEvent,
        companyId: company.id,
      });
    } else if (path.join("/") === "waitlist") {
      const user = await getIdentity();
      if (!user) throw new BookingError("Entre na sua conta para registrar seu interesse.", 401);
      const data = z.object({
        date: dateSchema,
        locationId: z.uuid(),
        employeeId: z.uuid().nullable().optional(),
        period: z.enum(["any", "morning", "afternoon", "evening"]).default("any"),
        items: selectionSchema,
      }).parse(body);
      const today = localDate(new Date(), company.timezone);
      const selection = data.items.map(i => ({ serviceId: i.serviceId, employeeId: data.employeeId || null }));
      const engine = await loadAvailability(company, data.locationId, selection, data.date, data.date);
      if (data.date < today || data.date > shiftDate(today, engine.settings.maxLeadDays)) throw new BookingError("Escolha um dia dentro do período de agendamento.");
      await db.transaction(async tx => {
        const { lockCompany } = await import("@/lib/booking/service");
        await lockCompany(tx, company.id);
        const existing = await tx.select().from(bookingWaitlist).where(and(eq(bookingWaitlist.companyId, company.id), eq(bookingWaitlist.userId, user.id), eq(bookingWaitlist.requestedDate, data.date), eq(bookingWaitlist.status, "waiting")));
        if (existing.some(e => e.locationId === data.locationId && e.employeeId === (data.employeeId || null) && e.period === data.period && JSON.stringify(e.serviceIds) === JSON.stringify(selection.map(i => i.serviceId)))) return;
        await tx.insert(bookingWaitlist).values({ companyId: company.id, userId: user.id, requestedDate: data.date, locationId: data.locationId, employeeId: data.employeeId || null, period: data.period, serviceIds: selection.map(i => i.serviceId) });
        await tx.insert(notifications).values({ companyId: company.id, type: "waitlist.joined", title: "Novo cliente na lista de espera", body: `${user.name} aguarda vaga para ${data.date}`, entityType: "waitlist" });
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
