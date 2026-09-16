import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  appointmentServices,
  companies,
  companySettings,
  employeeLocations,
  employees,
  employeeServices,
  locations,
  products,
  serviceCategories,
  services,
  employeeSchedules,
} from "@/db/schema";
import type { DbExecutor } from "@/lib/availability";
import { BookingError } from "./errors";
import { parseCopyOverrides, parseSectionsConfig } from "./customization";
import { DEFAULT_FONT_PACK } from "./fonts";
import { getCompanySettings } from "@/lib/settings";
import { localDate } from "./time";

export async function publicCompany(slug: string, executor: DbExecutor = db) {
  const normalizedSlug = slug.toLowerCase().trim();

  const [company] = await executor.select().from(companies).where(and(eq(companies.publicSlug, normalizedSlug), eq(companies.publicEnabled, true)));
  if (!company)
    throw new BookingError(
      "Esta página de agendamento não está disponível.",
      404,
    );
  return company;
}
export async function publicCatalog(slug: string) {
  const company = await publicCompany(slug);
  const [
    serviceRows,
    team,
    units,
    links,
    locationLinks,
    productRows,
    settings,
    rawSettingsRows,
    popularity,
    schedules,
  ] = await Promise.all([
    db
      .select({
        id: services.id,
        name: services.name,
        description: services.description,
        category: serviceCategories.name,
        price: services.price,
        durationMinutes: services.durationMinutes,
        bufferMinutes: services.bufferMinutes,
        imageUrl: services.imageUrl,
        deliveryMode: services.deliveryMode,
        paymentType: services.paymentType,
        cancellationPolicy: services.cancellationPolicy,
      })
      .from(services)
      .leftJoin(
        serviceCategories,
        eq(services.categoryId, serviceCategories.id),
      )
      .where(
        and(
          eq(services.companyId, company.id),
          eq(services.active, true),
          inArray(services.paymentType, ["PAY_LATER", "QUOTE", "FULL_PAYMENT", "DEPOSIT"]),
        ),
      )
      .orderBy(asc(services.name)),
    db
      .select({
        id: employees.id,
        name: employees.name,
        phone: employees.phone,
        photoUrl: employees.photoUrl,
        jobTitle: employees.jobTitle,
        locationId: employees.locationId,
      })
      .from(employees)
      .where(
        and(eq(employees.companyId, company.id), eq(employees.active, true)),
      )
      .orderBy(asc(employees.name)),
    db
      .select({
        id: locations.id,
        name: locations.name,
        address: locations.address,
        openTime: locations.openTime,
        closeTime: locations.closeTime,
      })
      .from(locations)
      .where(
        and(eq(locations.companyId, company.id), eq(locations.active, true)),
      )
      .orderBy(asc(locations.name)),
    db
      .select({
        employeeId: employeeServices.employeeId,
        serviceId: employeeServices.serviceId,
      })
      .from(employeeServices)
      .innerJoin(employees, eq(employeeServices.employeeId, employees.id))
      .where(eq(employees.companyId, company.id)),
    db
      .select({
        employeeId: employeeLocations.employeeId,
        locationId: employeeLocations.locationId,
      })
      .from(employeeLocations)
      .innerJoin(employees, eq(employeeLocations.employeeId, employees.id))
      .where(eq(employees.companyId, company.id)),
    company.allowProducts
      ? db
          .select({
            id: products.id,
            name: products.name,
            description: products.description,
            price: products.price,
          })
          .from(products)
          .where(
            and(eq(products.companyId, company.id), eq(products.active, true)),
          )
      : Promise.resolve([]),
    getCompanySettings(company.id),
    db
      .select({ key: companySettings.key, value: companySettings.value })
      .from(companySettings)
      .where(eq(companySettings.companyId, company.id)),
    db
      .select({
        serviceId: appointmentServices.serviceId,
        count: sql<number>`count(*)`,
      })
      .from(appointmentServices)
      .innerJoin(appointments, eq(appointments.id, appointmentServices.appointmentId))
      .where(
        and(
          eq(appointments.companyId, company.id),
          eq(appointments.status, "completed"),
        ),
      )
      .groupBy(appointmentServices.serviceId),
    db
      .select({ day: employeeSchedules.dayOfWeek })
      .from(employeeSchedules)
      .innerJoin(employees, eq(employeeSchedules.employeeId, employees.id))
      .where(
        and(
          eq(employees.companyId, company.id),
          eq(employees.active, true),
          eq(employeeSchedules.active, true),
        ),
      ),
  ]);
  const pop = new Map(
    popularity.map((p) => [p.serviceId, Number(p.count)]),
  );
  // getCompanySettings() only surfaces the fixed CompanySettings shape (open/close
  // time, buffers, etc) — branding fields live in company_settings under separate
  // keys, so they're read from the raw rows instead (mirrors GET /api/business/branding).
  const settingsMap = Object.fromEntries(rawSettingsRows.map((r) => [r.key, r.value]));
  return {
    company: {
      name: company.name,
      slug: company.publicSlug!,
      description: company.publicDescription,
      category: company.businessType,
      logoUrl: company.logoUrl,
      avatarUrl: settingsMap.avatar_url || settingsMap.avatarUrl || null,
      coverUrl: settingsMap.cover_url || settingsMap.coverUrl || null,
      coverPosition: settingsMap.cover_position || settingsMap.coverPosition || "center",
      bookingThemeMode: (settingsMap.booking_theme_mode || settingsMap.bookingThemeMode || "auto") as "auto" | "light" | "dark",
      bookingFontFamily: settingsMap.booking_font_family || settingsMap.bookingFontFamily || DEFAULT_FONT_PACK,
      copyOverrides: parseCopyOverrides(settingsMap.booking_copy_overrides || settingsMap.bookingCopyOverrides),
      sectionsConfig: parseSectionsConfig(settingsMap.booking_sections_config || settingsMap.bookingSectionsConfig),
      address: company.address,
      phone: company.publicPhone ? company.phone : null,
      whatsapp: company.publicPhone ? company.whatsapp : null,
      instagram: company.publicInstagram ? company.instagram : null,
      color: company.publicColor || company.primaryColor || "#3b82f6",
      photos: company.publicPhotos,
      timezone: company.timezone,
      cancellationHours: company.cancellationHours,
    },
    services: serviceRows.map((s) => ({
      ...s,
      price: Number(s.price),
      bookings: pop.get(s.id) ?? 0,
    })),
    professionals: team.map((e) => {
      const explicitServiceIds = links
        .filter((l) => l.employeeId === e.id)
        .map((l) => l.serviceId);
      return {
        ...e,
        serviceIds:
          explicitServiceIds.length > 0
            ? explicitServiceIds
            : serviceRows.map((s) => s.id),
        locationIds: (() => {
          const ids = [
            ...new Set([
              ...locationLinks
                .filter((l) => l.employeeId === e.id)
                .map((l) => l.locationId),
              ...(e.locationId ? [e.locationId] : []),
            ]),
          ];
          return ids.length > 0 ? ids : units.map((u) => u.id);
        })(),
      };
    }),
    locations: units,
    products: productRows.map((p) => ({ ...p, price: Number(p.price) })),
    settings: {
      ...settings,
      workingDays: settings.workingDays.filter((d) =>
        schedules.some((s) => s.day === d),
      ),
    },
    today: localDate(new Date(), company.timezone),
  };
}
export type PublicCatalog = Awaited<ReturnType<typeof publicCatalog>>;
