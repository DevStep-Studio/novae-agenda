import { and, desc, eq, like, or } from "drizzle-orm";
import { db } from "@/db";
import { appointments, clients, employees, services } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { centsToNumber, normalizeTime } from "@/lib/domain";
import type { AppointmentStatus, SearchResultDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q || q.length < 2) {
    return Response.json({
      data: {
        clients: [],
        employees: [],
        services: [],
        appointments: [],
      } satisfies SearchResultDTO,
    });
  }

  const pattern = `%${q}%`;
  const companyId = auth.user.companyId;

  const [clientMatches, employeeMatches, serviceMatches, aptMatches] = await Promise.all([
    // Clients
    db
      .select({
        id: clients.id,
        name: clients.name,
        phone: clients.phone,
        email: clients.email,
      })
      .from(clients)
      .where(
        and(
          eq(clients.companyId, companyId),
          eq(clients.active, true),
          or(like(clients.name, pattern), like(clients.phone, pattern), like(clients.email, pattern)),
        ),
      )
      .limit(8),

    // Employees
    db
      .select({
        id: employees.id,
        name: employees.name,
        jobTitle: employees.jobTitle,
      })
      .from(employees)
      .where(
        and(
          eq(employees.companyId, companyId),
          eq(employees.active, true),
          or(like(employees.name, pattern), like(employees.jobTitle, pattern)),
        ),
      )
      .limit(8),

    // Services
    db
      .select({
        id: services.id,
        name: services.name,
        price: services.price,
        durationMinutes: services.durationMinutes,
      })
      .from(services)
      .where(and(eq(services.companyId, companyId), eq(services.active, true), like(services.name, pattern)))
      .limit(8),

    // Appointments (matching client or employee name)
    db
      .select({
        id: appointments.id,
        date: appointments.appointmentDate,
        time: appointments.startTime,
        status: appointments.status,
        clientName: clients.name,
        employeeName: employees.name,
      })
      .from(appointments)
      .innerJoin(clients, eq(appointments.clientId, clients.id))
      .innerJoin(employees, eq(appointments.employeeId, employees.id))
      .where(
        and(
          eq(appointments.companyId, companyId),
          or(like(clients.name, pattern), like(employees.name, pattern)),
        ),
      )
      .orderBy(desc(appointments.appointmentDate))
      .limit(8),
  ]);

  const result: SearchResultDTO = {
    clients: clientMatches,
    employees: employeeMatches,
    services: serviceMatches.map((s) => ({
      id: s.id,
      name: s.name,
      price: centsToNumber(s.price),
      durationMinutes: s.durationMinutes,
    })),
    appointments: aptMatches.map((a) => ({
      id: a.id,
      clientName: a.clientName,
      serviceName: "Atendimento",
      employeeName: a.employeeName,
      date: a.date,
      time: normalizeTime(a.time),
      status: a.status as AppointmentStatus,
    })),
  };

  return Response.json({ data: result });
}
