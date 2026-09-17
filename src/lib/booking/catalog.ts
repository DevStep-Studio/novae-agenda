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
  bookingPages,
} from "@/db/schema";
import type { DbExecutor } from "@/lib/availability";
import type { PageBuilderDocument } from "@/components/booking/page-builder/page-builder-types";
import { BookingError } from "./errors";
import { parseCopyOverrides, parseSectionsConfig } from "./customization";
import { DEFAULT_FONT_PACK } from "./fonts";
import { getCompanySettings } from "@/lib/settings";
import { localDate } from "./time";

export async function publicCompany(slug: string, executor: DbExecutor = db) {
  const normalizedSlug = slug.toLowerCase().trim();

  // Try finding with explicit publicEnabled = true first
  let [company] = await executor
    .select()
    .from(companies)
    .where(
      and(
        sql`lower(trim(${companies.publicSlug})) = ${normalizedSlug}`,
        eq(companies.publicEnabled, true)
      )
    );

  // If not found, check if company exists with matching slug and enable it
  if (!company) {
    const [existing] = await executor
      .select()
      .from(companies)
      .where(sql`lower(trim(${companies.publicSlug})) = ${normalizedSlug}`);

    if (existing) {
      try {
        await executor
          .update(companies)
          .set({ publicEnabled: true, updatedAt: new Date() })
          .where(eq(companies.id, existing.id));
        existing.publicEnabled = true;
      } catch {}
      company = existing;
    }
  }

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
    pageRows,
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
    db
      .select()
      .from(bookingPages)
      .where(eq(bookingPages.companyId, company.id))
      .limit(1),
  ]);
  const pop = new Map(
    popularity.map((p) => [p.serviceId, Number(p.count)]),
  );
  const publishedPage = pageRows[0];
  // getCompanySettings() only surfaces the fixed CompanySettings shape (open/close
  // time, buffers, etc) — branding fields live in company_settings under separate
  // keys, so they're read from the raw rows instead (mirrors GET /api/business/branding).
  const settingsMap = Object.fromEntries(rawSettingsRows.map((r) => [r.key, r.value]));
  return {
    company: {
      name: company.name,
      slug: company.publicSlug || slug,
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
      pageBuilder:
        publishedPage?.status === "published" && publishedPage?.publishedLayout
          ? {
              layout: (typeof publishedPage.publishedLayout === "string"
                ? JSON.parse(publishedPage.publishedLayout)
                : publishedPage.publishedLayout) as PageBuilderDocument,
              tokens: (typeof publishedPage.globalTokens === "string"
                ? JSON.parse(publishedPage.globalTokens)
                : (publishedPage.globalTokens || null)) as any,
            }
          : null,
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
      workingDays: (settings?.workingDays ?? [1, 2, 3, 4, 5, 6]).filter((d) =>
        (schedules ?? []).length === 0 || (schedules ?? []).some((s) => s.day === d),
      ),
    },
    today: localDate(new Date(), company.timezone || "America/Sao_Paulo"),
  };
}
export type PublicCatalog = Awaited<ReturnType<typeof publicCatalog>>;
