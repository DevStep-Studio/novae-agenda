import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, auditLogs, companies, employees, locations, subscriptions, users } from "@/db/schema";
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

  // Subscriptions metrics
  const subs = await db.select().from(subscriptions);
  const activeSubs = subs.filter((s) => s.status === "active");
  const trialSubs = subs.filter((s) => s.status === "trialing");

  // MRR estimation: monthly (89.90) + yearly (799 / 12 = 66.58)
  const estimatedMRR = activeSubs.reduce((sum, s) => {
    return sum + (s.plan === "pro_yearly" ? 799 / 12 : 89.9);
  }, 0);

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

  const [usersByComp, employeesByComp, locationsByComp, appointmentsByComp] = await Promise.all([
    companyIds.length ? db.select({ companyId: users.companyId, count: sql<number>`count(*)` }).from(users).groupBy(users.companyId) : [],
    companyIds.length ? db.select({ companyId: employees.companyId, count: sql<number>`count(*)` }).from(employees).groupBy(employees.companyId) : [],
    companyIds.length ? db.select({ companyId: locations.companyId, count: sql<number>`count(*)` }).from(locations).groupBy(locations.companyId) : [],
    companyIds.length ? db.select({ companyId: appointments.companyId, count: sql<number>`count(*)` }).from(appointments).groupBy(appointments.companyId) : [],
  ]);

  const usersCountMap = new Map(usersByComp.map((r) => [r.companyId, Number(r.count)]));
  const employeesCountMap = new Map(employeesByComp.map((r) => [r.companyId, Number(r.count)]));
  const locationsCountMap = new Map(locationsByComp.map((r) => [r.companyId, Number(r.count)]));
  const appointmentsCountMap = new Map(appointmentsByComp.map((r) => [r.companyId, Number(r.count)]));
  const subsByComp = new Map(subs.map((s) => [s.companyId, s]));

  const recentCompanies: SuperadminCompanyDTO[] = allCompanies.map((c) => {
    const sub = subsByComp.get(c.id);
    return {
      id: c.id,
      name: c.name,
      businessType: c.businessType,
      email: c.email,
      phone: c.phone,
      usersCount: usersCountMap.get(c.id) ?? 0,
      employeesCount: employeesCountMap.get(c.id) ?? 0,
      locationsCount: locationsCountMap.get(c.id) ?? 0,
      appointmentsCount: appointmentsCountMap.get(c.id) ?? 0,
      plan: sub?.plan ?? "trial",
      subscriptionStatus: sub?.status ?? "trialing",
      createdAt: c.createdAt.toISOString(),
      active: c.onboarded,
    };
  });

  const logs = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entity: auditLogs.entity,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(10);

  const stats: SuperadminStatsDTO = {
    totalCompanies: Number(companyCount?.count ?? 0),
    totalUsers: Number(userCount?.count ?? 0),
    totalEmployees: Number(employeeCount?.count ?? 0),
    totalLocations: Number(locationCount?.count ?? 0),
    totalAppointments: Number(appointmentCount?.count ?? 0),
    activeSubscriptions: activeSubs.length,
    trialSubscriptions: trialSubs.length,
    estimatedMRR: Math.round(estimatedMRR),
    recentCompanies,
    recentLogs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      createdAt: l.createdAt.toISOString(),
    })),
  };

  return Response.json({ data: stats });
}
