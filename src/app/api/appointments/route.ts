import { lockCompany } from "@/lib/booking/service";
import { bookingError, sameOrigin } from "@/lib/booking/errors";
import { and, asc, between, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  appointmentHistory,
  appointmentServices,
  appointments,
  clients,
  employeeServices,
  employees,
  locations,
  notifications,
  payments,
  services,
} from "@/db/schema";
import { forbidden, requireAuth, requireRole, unauthorized } from "@/lib/auth";
import { assertBookable } from "@/lib/availability";
import { recordAudit } from "@/lib/audit";
import {
  addMinutesToTime,
  centsToNumber,
  isUuid,
  isValidDateKey,
  isValidTime,
  normalizeTime,
  timeToMinutes,
} from "@/lib/domain";
import { getCompanySettings } from "@/lib/settings";
import type { AppointmentDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role === "client") return forbidden("Acesso restrito à equipe.");

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const employeeId = searchParams.get("employeeId");

  const conditions = [eq(appointments.companyId, auth.user.companyId)];

  if (from && isValidDateKey(from)) {
    conditions.push(
      to && isValidDateKey(to)
        ? between(appointments.appointmentDate, from, to)
        : eq(appointments.appointmentDate, from),
    );
  }
  if (employeeId && employeeId !== "all" && isUuid(employeeId)) {
    if (auth.user.role === "employee" && auth.user.employeeId !== employeeId) {
      return unauthorized();
    }
    conditions.push(eq(appointments.employeeId, employeeId));
  }

  if (auth.user.role === "employee" && auth.user.employeeId) {
    conditions.push(eq(appointments.employeeId, auth.user.employeeId));
  }

  const rows = await db
    .select({
      id: appointments.id,
      locationId: appointments.locationId,
      locationName: locations.name,
      appointmentDate: appointments.appointmentDate,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      clientId: appointments.clientId,
      clientName: clients.name,
      clientPhone: clients.phone,
      clientPhotoUrl: clients.photoUrl,
      employeeId: appointments.employeeId,
      employeeName: employees.name,
      total: appointments.total,
      status: appointments.status,
      notes: appointments.notes,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.id))
    .innerJoin(employees, eq(appointments.employeeId, employees.id))
    .leftJoin(locations, eq(appointments.locationId, locations.id))
    .where(and(...conditions))
    .orderBy(asc(appointments.appointmentDate), asc(appointments.startTime))
    .limit(1000);

  const appointmentIds = rows.map((row) => row.id);
  const serviceRows = appointmentIds.length
    ? await db
        .select({
          appointmentId: appointmentServices.appointmentId,
          serviceId: appointmentServices.serviceId,
          durationMinutes: appointmentServices.durationMinutes,
        })
        .from(appointmentServices)
        .innerJoin(services, eq(appointmentServices.serviceId, services.id))
        .where(inArray(appointmentServices.appointmentId, appointmentIds))
    : [];

  const serviceByAppointment = new Map<
    string,
    {
      serviceId: string;
      serviceName: string;
      serviceColor: string | null;
      durationMinutes: number;
    }
  >();
  const serviceMeta = new Map<string, { name: string; color: string | null }>();
  if (serviceRows.length) {
    const serviceIds = [...new Set(serviceRows.map((row) => row.serviceId))];
    const serviceDefs = await db
      .select({ id: services.id, name: services.name, color: services.color })
      .from(services)
      .where(inArray(services.id, serviceIds));
    for (const def of serviceDefs)
      serviceMeta.set(def.id, { name: def.name, color: def.color });
  }
  for (const row of serviceRows) {
    const meta = serviceMeta.get(row.serviceId);
    if (!meta) continue;
    const existing = serviceByAppointment.get(row.appointmentId);
    if (existing) {
      existing.serviceName = `${existing.serviceName} + ${meta.name}`;
      existing.durationMinutes += row.durationMinutes;
    } else {
      serviceByAppointment.set(row.appointmentId, {
        serviceId: row.serviceId,
        serviceName: meta.name,
        serviceColor: meta.color,
        durationMinutes: row.durationMinutes,
      });
    }
  }

  const paymentRows = appointmentIds.length
    ? await db
        .select({
          appointmentId: payments.appointmentId,
          method: payments.method,
          status: payments.status,
        })
        .from(payments)
        .where(
          and(
            inArray(payments.appointmentId, appointmentIds),
            eq(payments.status, "paid"),
          ),
        )
    : [];
  const paymentByApt = new Map<string, string>();
  for (const p of paymentRows) paymentByApt.set(p.appointmentId, p.method);

  const dto: AppointmentDTO[] = rows.map((row) => {
    const svc = serviceByAppointment.get(row.id);
    return {
      id: row.id,
      locationId: row.locationId,
      locationName: row.locationName,
      date: row.appointmentDate,
      startTime: normalizeTime(row.startTime),
      endTime: normalizeTime(row.endTime),
      durationMinutes: svc?.durationMinutes ?? 30,
      clientId: row.clientId,
      clientName: row.clientName,
      clientPhone: row.clientPhone ?? "",
      clientPhotoUrl: row.clientPhotoUrl ?? null,
      clientInitials: initials(row.clientName),
      clientColor: "#d8e5f0",
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      employeeInitials: initials(row.employeeName),
      serviceId: svc?.serviceId ?? "",
      serviceName: svc?.serviceName ?? "Serviço",
      serviceColor: svc?.serviceColor ?? null,
      total: centsToNumber(row.total),
      status: row.status as AppointmentDTO["status"],
      notes: row.notes,
      paid: paymentByApt.has(row.id) || row.status === "completed",
      paymentMethod:
        (paymentByApt.get(row.id) as AppointmentDTO["paymentMethod"]) ?? null,
    };
  });

  return Response.json({ data: dto });
}

const createSchema = z.object({
  locationId: z.string().optional(),
  clientId: z.string(),
  employeeId: z.string(),
  serviceIds: z.array(z.string()).min(1, "Selecione ao menos um serviço."),
  date: z.string(),
  startTime: z.string(),
  status: z.enum(["scheduled", "confirmed"]).optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;

  try {
    sameOrigin(request);
    return await db.transaction(async (tx) => {
      await lockCompany(tx, auth.user.companyId);
      const body = await request.json().catch(() => null);
      const parsed = createSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
          { status: 400 },
        );
      }
      const {
        locationId,
        clientId,
        employeeId,
        serviceIds,
        date,
        startTime,
        status,
        notes,
      } = parsed.data;

      if (!isUuid(clientId) || !isUuid(employeeId)) {
        return Response.json(
          { error: "Cliente ou profissional inválido." },
          { status: 400 },
        );
      }
      if (!isValidDateKey(date) || !isValidTime(startTime)) {
        return Response.json(
          { error: "Data ou horário inválido." },
          { status: 400 },
        );
      }

      // An employee may only create appointments on their own agenda.
      if (
        auth.user.role === "employee" &&
        auth.user.employeeId !== employeeId
      ) {
        return Response.json(
          { error: "Você só pode criar atendimentos na sua própria agenda." },
          { status: 403 },
        );
      }

      const [client] = await tx
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(
            eq(clients.id, clientId),
            eq(clients.companyId, auth.user.companyId),
          ),
        )
        .limit(1);
      if (!client)
        return Response.json(
          { error: "Cliente não encontrado." },
          { status: 404 },
        );

      const [employee] = await tx
        .select({
          id: employees.id,
          name: employees.name,
          active: employees.active,
          locationId: employees.locationId,
        })
        .from(employees)
        .where(
          and(
            eq(employees.id, employeeId),
            eq(employees.companyId, auth.user.companyId),
          ),
        )
        .limit(1);
      if (!employee || !employee.active)
        return Response.json(
          { error: "Profissional não encontrado." },
          { status: 404 },
        );

      const serviceRows = await tx
        .select({
          id: services.id,
          price: services.price,
          durationMinutes: services.durationMinutes,
          bufferMinutes: services.bufferMinutes,
        })
        .from(services)
        .where(
          and(
            inArray(services.id, serviceIds),
            eq(services.companyId, auth.user.companyId),
            eq(services.active, true),
          ),
        );

      if (serviceRows.length !== serviceIds.length) {
        return Response.json(
          { error: "Um ou mais serviços são inválidos ou estão inativos." },
          { status: 400 },
        );
      }

      // Ensure THIS employee is linked to every requested service.
      const links = await tx
        .select({ serviceId: employeeServices.serviceId })
        .from(employeeServices)
        .where(
          and(
            eq(employeeServices.employeeId, employeeId),
            inArray(employeeServices.serviceId, serviceIds),
          ),
        );
      const linkedIds = new Set(links.map((link) => link.serviceId));
      if (serviceIds.some((id) => !linkedIds.has(id))) {
        return Response.json(
          {
            error:
              "Este profissional não realiza um dos serviços selecionados.",
          },
          { status: 400 },
        );
      }

      if (locationId) {
        if (!isUuid(locationId))
          return Response.json({ error: "Unidade inválida." }, { status: 400 });
        const [location] = await tx
          .select()
          .from(locations)
          .where(
            and(
              eq(locations.id, locationId),
              eq(locations.companyId, auth.user.companyId),
              eq(locations.active, true),
            ),
          );
        if (!location)
          return Response.json(
            { error: "Unidade não encontrada." },
            { status: 404 },
          );
      }
      const settings = await getCompanySettings(auth.user.companyId, tx);
      const orderedServices = serviceIds.map((id) =>
        serviceRows.find((s) => s.id === id)!,
      );
      const durationMinutes = orderedServices.reduce(
        (sum, service, index) =>
          sum +
          service.durationMinutes +
          (index < orderedServices.length - 1
            ? Math.max(settings.bufferMinutes, service.bufferMinutes)
            : 0),
        0,
      );
      const total = serviceRows.reduce(
        (sum, service) => sum + centsToNumber(service.price),
        0,
      );
      const endTime = addMinutesToTime(startTime, durationMinutes);
      const bufferMinutes = Math.max(
        settings.bufferMinutes,
        orderedServices.at(-1)!.bufferMinutes,
      );
      const check = await assertBookable({
        companyId: auth.user.companyId,
        employeeId,
        date,
        timezone: auth.companyTimezone,
        executor: tx,
        locationId: locationId || employee.locationId || undefined,
        durationMinutes,
        bufferMinutes,
        startMinutes: timeToMinutes(startTime),
        endMinutes: timeToMinutes(endTime),
      });
      if (!check.ok) {
        return Response.json({ error: check.error }, { status: check.status });
      }

      let targetLocationId =
        locationId && isUuid(locationId) ? locationId : null;
      if (!targetLocationId) {
        const [defaultLoc] = await tx
          .select({ id: locations.id })
          .from(locations)
          .where(
            and(
              eq(locations.companyId, auth.user.companyId),
              eq(locations.active, true),
            ),
          )
          .limit(1);
        targetLocationId = defaultLoc?.id ?? null;
      }

      const [created] = await tx
        .insert(appointments)
        .values({
          companyId: auth.user.companyId,
          locationId: targetLocationId,
          clientId,
          employeeId,
          appointmentDate: date,
          startTime: `${startTime}:00`,
          endTime: `${endTime}:00`,
          status: status ?? "scheduled",
          bufferMinutes,
          total: total.toFixed(2),
          notes: notes?.trim() || null,
        })
        .returning();

      // copy commission config into appointment services snapshot
      for (const service of serviceRows) {
        const [link] = await tx
          .select({
            employeeId: employeeServices.employeeId,
            commissionType: employeeServices.commissionType,
            commissionValue: employeeServices.commissionValue,
          })
          .from(employeeServices)
          .where(
            and(
              eq(employeeServices.employeeId, employeeId),
              eq(employeeServices.serviceId, service.id),
            ),
          )
          .limit(1);

        let commissionType = "none";
        let commissionValue = 0;
        if (link) {
          commissionType = link.commissionType;
          commissionValue = centsToNumber(link.commissionValue);
        }
        let commissionAmount = 0;
        if (commissionType === "percentage")
          commissionAmount =
            (centsToNumber(service.price) * commissionValue) / 100;
        if (commissionType === "fixed") commissionAmount = commissionValue;

        await tx.insert(appointmentServices).values({
          appointmentId: created.id,
          serviceId: service.id,
          price: service.price,
          durationMinutes: service.durationMinutes,
          commissionType,
          commissionValue: String(commissionValue),
          commissionAmount: commissionAmount.toFixed(2),
        });
      }

      await tx
        .insert(appointmentHistory)
        .values({
          appointmentId: created.id,
          actorId: auth.user.userId,
          action: "appointment.created",
          metadata: { date, startTime, endTime },
        });
      await recordAudit({
        companyId: auth.user.companyId,
        userId: auth.user.userId,
        action: "appointment.created",
        entity: "appointment",
        entityId: created.id,
        metadata: { date, startTime, endTime, employeeId, clientId, total },
      });

      await tx.insert(notifications).values({
        companyId: auth.user.companyId,
        type: "appointment_created",
        title: "Novo atendimento criado",
        body: `${normalizeTime(startTime)} · ${employee.name}`,
        entityType: "appointment",
        entityId: created.id,
      });

      return Response.json({ data: { id: created.id } }, { status: 201 });
    });
  } catch (error) {
    return bookingError(error);
  }
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}
