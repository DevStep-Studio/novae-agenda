import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  appointments,
  auditLogs,
  bookingEvents,
  companies,
  companySettings,
  coupons,
  employeeSchedules,
  employees,
  products,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { BookingError, bookingError, sameOrigin } from "@/lib/booking/errors";
import { parsePromoBanners } from "@/lib/booking/customization";
import {
  accessibleColor,
  safeImageUrl,
  slugSchema,
} from "@/lib/booking/validation";
import { lockCompany } from "@/lib/booking/service";
export const dynamic = "force-dynamic";
export async function GET() {
  const gate = await requireRole("manager");
  if (gate.response) return gate.response;
  const companyId = gate.auth.user.companyId;
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId));
  const [schedules, extras, promotions, funnel, settingsRows] = await Promise.all([
    db
      .select({
        id: employeeSchedules.id,
        employeeId: employeeSchedules.employeeId,
        dayOfWeek: employeeSchedules.dayOfWeek,
        startTime: employeeSchedules.startTime,
        endTime: employeeSchedules.endTime,
        breakStart: employeeSchedules.breakStart,
        breakEnd: employeeSchedules.breakEnd,
        active: employeeSchedules.active,
      })
      .from(employeeSchedules)
      .innerJoin(employees, eq(employeeSchedules.employeeId, employees.id))
      .where(eq(employees.companyId, companyId)),
    db.select().from(products).where(eq(products.companyId, companyId)),
    db.select().from(coupons).where(eq(coupons.companyId, companyId)),
    db
      .select({ event: bookingEvents.event, count: sql<number>`count(*)` })
      .from(bookingEvents)
      .where(eq(bookingEvents.companyId, companyId))
      .groupBy(bookingEvents.event),
    db.select().from(companySettings).where(eq(companySettings.companyId, companyId)),
  ]);

  const settingsMap: Record<string, string> = {};
  for (const row of settingsRows) {
    if (row.key && row.value) settingsMap[row.key] = row.value;
  }
  const promoBanners = parsePromoBanners(
    settingsMap.booking_promo_banners || settingsMap.bookingPromoBanners
  );

  return Response.json({
    data: { company, promoBanners, schedules, products: extras, coupons: promotions, funnel },
  });
}
const profileSchema = z.object({
  slug: slugSchema,
  enabled: z.boolean(),
  name: z.string().trim().min(2).max(120),
  description: z.string().max(2000),
  category: z.string().max(120),
  address: z.string().max(500),
  phone: z.string().max(25),
  whatsapp: z.string().max(25),
  instagram: z
    .string()
    .max(100)
    .regex(/^(@?[a-zA-Z0-9_.]+)?$/, "Informe apenas o usuário do Instagram."),
  logoUrl: safeImageUrl,
  photos: z.array(safeImageUrl).max(8),
  color: z
    .string()
    .refine(
      accessibleColor,
      "Escolha uma cor com contraste suficiente para texto branco.",
    ),
  showPhone: z.boolean(),
  showInstagram: z.boolean(),
  cancellationHours: z.union([
    z.literal(-1),
    z.literal(0),
    z.literal(2),
    z.literal(6),
    z.literal(12),
    z.literal(24),
    z.literal(48),
    z.literal(72),
  ]),
  allowProducts: z.boolean(),
  timezone: z.string().refine((t) => {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: t });
      return true;
    } catch {
      return false;
    }
  }, "Fuso inválido."),
  promoBanners: z.any().optional(),
  bookingPromoBanners: z.any().optional(),
});
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const gate = await requireRole("manager");
    if (gate.response) return gate.response;
    const { companyId, userId } = gate.auth.user;
    const d = profileSchema.parse(await request.json());
    await db.transaction(async (tx) => {
      await lockCompany(tx, companyId);
      const [current] = await tx
        .select()
        .from(companies)
        .where(eq(companies.id, companyId));
      // Existing appointment wall times must keep their meaning. Changing timezone after scheduling needs an explicit data migration.
      if (current.timezone !== d.timezone) {
        const [row] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(appointments)
          .where(eq(appointments.companyId, companyId));
        if (Number(row?.count))
          throw new BookingError(
            "O fuso não pode ser alterado após criar atendimentos. Contate o suporte.",
            422,
          );
      }
      await tx
        .update(companies)
        .set({
          publicSlug: d.slug,
          publicEnabled: d.enabled,
          name: d.name,
          publicDescription: d.description,
          businessType: d.category,
          address: d.address,
          phone: d.phone,
          whatsapp: d.whatsapp,
          instagram: d.instagram,
          logoUrl: d.logoUrl || null,
          publicPhotos: d.photos.filter(Boolean),
          publicColor: d.color,
          publicPhone: d.showPhone,
          publicInstagram: d.showInstagram,
          cancellationHours: d.cancellationHours,
          allowProducts: d.allowProducts,
          timezone: d.timezone,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId));

      if (d.promoBanners !== undefined || d.bookingPromoBanners !== undefined) {
        const parsedBanners = parsePromoBanners(d.promoBanners ?? d.bookingPromoBanners);
        const json = JSON.stringify(parsedBanners);
        await tx
          .insert(companySettings)
          .values({
            companyId,
            key: "booking_promo_banners",
            value: json,
          })
          .onDuplicateKeyUpdate({
            set: {
              value: json,
              updatedAt: new Date(),
            },
          });
        await tx
          .insert(companySettings)
          .values({
            companyId,
            key: "bookingPromoBanners",
            value: json,
          })
          .onDuplicateKeyUpdate({
            set: {
              value: json,
              updatedAt: new Date(),
            },
          });
      }

      await tx
        .insert(auditLogs)
        .values({
          companyId,
          userId,
          action: "booking.settings_updated",
          entity: "company",
          entityId: companyId,
          metadata: { slug: d.slug, enabled: d.enabled },
        });
    });
    return Response.json({ data: { ok: true } });
  } catch (error) {
    return bookingError(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const gate = await requireRole("manager");
    if (gate.response) return gate.response;
    const companyId = gate.auth.user.companyId;
    const body = await request.json();
    if (body.kind === "product") {
      const d = z
        .object({
          name: z.string().trim().min(2).max(120),
          description: z.string().max(500).default(""),
          price: z.number().min(0).max(100000),
          active: z.boolean().default(true),
          id: z.uuid().optional(),
        })
        .parse(body);
      if (d.id)
        await db
          .update(products)
          .set({
            name: d.name,
            description: d.description,
            price: d.price.toFixed(2),
            active: d.active,
            updatedAt: new Date(),
          })
          .where(and(eq(products.companyId, companyId), eq(products.id, d.id)));
      else
        await db
          .insert(products)
          .values({
            companyId,
            name: d.name,
            description: d.description,
            price: d.price.toFixed(2),
          });
    } else if (body.kind === "coupon") {
      const d = z
        .object({
          code: z
            .string()
            .trim()
            .min(2)
            .max(40)
            .regex(/^[a-zA-Z0-9_-]+$/),
          type: z.enum(["percentage", "fixed"]),
          value: z.number().positive().max(100000),
          active: z.boolean().default(true),
          id: z.uuid().optional(),
        })
        .parse(body);
      if (d.type === "percentage" && d.value > 100)
        throw new BookingError("O percentual máximo é 100%.");
      if (d.id)
        await db
          .update(coupons)
          .set({ active: d.active })
          .where(and(eq(coupons.companyId, companyId), eq(coupons.id, d.id)));
      else
        await db
          .insert(coupons)
          .values({
            companyId,
            code: d.code.toUpperCase(),
            type: d.type,
            value: d.value.toFixed(2),
          });
    } else throw new BookingError("Ação inválida.");
    return Response.json({ data: { ok: true } });
  } catch (error) {
    return bookingError(error);
  }
}
