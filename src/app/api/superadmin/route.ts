import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, companies, employees, locations, users } from "@/db/schema";
import { requireSuperadmin } from "@/lib/auth";
import type { SuperadminCompanyDTO, SuperadminStatsDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  const [companyCount] = await db.select({ count: sql<number>`count(*)` }).from(companies);
  const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [employeeCount] = await db.select({ count: sql<number>`count(*)` }).from(employees);
  const [locationCount] = await db.select({ count: sql<number>`count(*)` }).from(locations);
  const [appointmentCount] = await db.select({ count: sql<number>`count(*)` }).from(appointments);

  const allCompanies = await db
    .select({
      id: companies.id,
      name: companies.name,
      businessType: companies.businessType,
      email: companies.email,
      phone: companies.phone,
      createdAt: companies.createdAt,
      onboarded: companies.onboarded,
    })
    .from(companies)
    .orderBy(desc(companies.createdAt))
    .limit(100);

  const companyIds = allCompanies.map((c) => c.id);

  const usersByComp = companyIds.length
    ? await db
        .select({ companyId: users.companyId, count: sql<number>`count(*)` })
        .from(users)
        .groupBy(users.companyId)
    : [];
  const employeesByComp = companyIds.length
    ? await db
        .select({ companyId: employees.companyId, count: sql<number>`count(*)` })
        .from(employees)
        .groupBy(employees.companyId)
    : [];
  const locationsByComp = companyIds.length
    ? await db
        .select({ companyId: locations.companyId, count: sql<number>`count(*)` })
        .from(locations)
        .groupBy(locations.companyId)
    : [];
  const appointmentsByComp = companyIds.length
    ? await db
        .select({ companyId: appointments.companyId, count: sql<number>`count(*)` })
        .from(appointments)
        .groupBy(appointments.companyId)
    : [];

  const usersCountMap = new Map(usersByComp.map((r) => [r.companyId, Number(r.count)]));
  const employeesCountMap = new Map(employeesByComp.map((r) => [r.companyId, Number(r.count)]));
  const locationsCountMap = new Map(locationsByComp.map((r) => [r.companyId, Number(r.count)]));
  const appointmentsCountMap = new Map(appointmentsByComp.map((r) => [r.companyId, Number(r.count)]));

  const recentCompanies: SuperadminCompanyDTO[] = allCompanies.map((c) => ({
    id: c.id,
    name: c.name,
    businessType: c.businessType,
    email: c.email,
    phone: c.phone,
    usersCount: usersCountMap.get(c.id) ?? 0,
    employeesCount: employeesCountMap.get(c.id) ?? 0,
    locationsCount: locationsCountMap.get(c.id) ?? 0,
    appointmentsCount: appointmentsCountMap.get(c.id) ?? 0,
    createdAt: c.createdAt.toISOString(),
    active: c.onboarded,
  }));

  const stats: SuperadminStatsDTO = {
    totalCompanies: Number(companyCount?.count ?? 0),
    totalUsers: Number(userCount?.count ?? 0),
    totalEmployees: Number(employeeCount?.count ?? 0),
    totalLocations: Number(locationCount?.count ?? 0),
    totalAppointments: Number(appointmentCount?.count ?? 0),
    recentCompanies,
  };

  return Response.json({ data: stats });
}
