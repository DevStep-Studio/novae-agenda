import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
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
import { getCompanySettings } from "@/lib/settings";
import { localDate } from "./time";
import { toSlug } from "./validation";

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
          eq(services.paymentType, "PAY_LATER"),
        ),
      )
      .orderBy(asc(services.name)),
    db
      .select({
        id: employees.id,
        name: employees.name,
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
    db.execute<{ service_id: string; count: string }>(
      sql`SELECT aps.service_id, count(*) FROM appointment_services aps JOIN appointments a ON a.id=aps.appointment_id WHERE a.company_id=${company.id} AND a.status='completed' GROUP BY aps.service_id`,
    ),
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
    popularity.rows.map((p) => [p.service_id, Number(p.count)]),
  );
  return {
    company: {
      name: company.name,
      slug: company.publicSlug!,
      description: company.publicDescription,
      category: company.businessType,
      logoUrl: company.logoUrl,
      avatarUrl: (settings as Record<string, unknown>).avatarUrl as string | null || null,
      coverUrl: (settings as Record<string, unknown>).coverUrl as string | null || null,
      coverPosition: ((settings as Record<string, unknown>).coverPosition as string) || "center",
      bookingThemeMode: (((settings as Record<string, unknown>).bookingThemeMode as string) || "auto") as "auto" | "light" | "dark",
      address: company.address,
      phone: company.publicPhone ? company.phone : null,
      whatsapp: company.publicPhone ? company.whatsapp : null,
      instagram: company.publicInstagram ? company.instagram : null,
      color: company.publicColor || company.primaryColor || "#dcff4c",
      photos: company.publicPhotos,
      timezone: company.timezone,
      cancellationHours: company.cancellationHours,
    },
    services: serviceRows.map((s) => ({
      ...s,
      price: Number(s.price),
      bookings: pop.get(s.id) ?? 0,
    })),
    professionals: team.map((e) => ({
      ...e,
      serviceIds: links
        .filter((l) => l.employeeId === e.id)
        .map((l) => l.serviceId),
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
    })),
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
