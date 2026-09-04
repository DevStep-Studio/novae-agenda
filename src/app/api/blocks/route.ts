import { and, eq } from "drizzle-orm";
import { isUuid, isValidDateKey, isValidTime } from "@/lib/domain";
import { z } from "zod";
import { db } from "@/db";
import { employees, locations, scheduleBlocks } from "@/db/schema";
import { hasMinRole, requireRole } from "@/lib/auth";
import type { ScheduleBlockDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const date = searchParams.get("date");

  const conditions = [eq(scheduleBlocks.companyId, auth.user.companyId)];
  if (auth.user.role === "employee" && auth.user.employeeId) {
    conditions.push(eq(scheduleBlocks.employeeId, auth.user.employeeId));
  } else if (employeeId && isUuid(employeeId)) {
    conditions.push(eq(scheduleBlocks.employeeId, employeeId));
  }

  const rows = await db.select().from(scheduleBlocks).where(and(...conditions)).orderBy(scheduleBlocks.startsAt);

  const dto: ScheduleBlockDTO[] = rows
    .filter((block) => {
      if (!date) return true;
      const blockStartDate = block.startsAt.toISOString().slice(0, 10);
      const blockEndDate = block.endsAt.toISOString().slice(0, 10);
      return blockStartDate <= date && blockEndDate >= date;
    })
    .map((block) => ({
      id: block.id,
      employeeId: block.employeeId,
      locationId: block.locationId,
      date: block.startsAt.toISOString().slice(0, 10),
      startsAt: block.startsAt.toISOString().slice(11, 16),
      endsAt: block.endsAt.toISOString().slice(11, 16),
      allDay: block.allDay,
      reason: block.reason,
    }));

  return Response.json({ data: dto });
}

const createSchema = z.object({
  employeeId: z.string().optional().nullable(),
  locationId: z.string().optional().nullable(),
  date: z.string(),
  endDate: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  allDay: z.boolean().optional(),
  reason: z.string().min(1, "Informe o motivo do bloqueio.").max(200),
});

export async function POST(request: Request) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { employeeId, locationId, date, endDate, startsAt, endsAt, allDay, reason } = parsed.data;

  const targetEmpId = employeeId && employeeId !== "all" && isUuid(employeeId) ? employeeId : null;
  const targetLocId = locationId && isUuid(locationId) ? locationId : null;

  // An employee may only block their own agenda; managers+ may block anyone or company-wide.
  if (targetEmpId) {
    if (!hasMinRole(auth.user.role, "manager") && auth.user.employeeId !== targetEmpId) {
      return Response.json({ error: "Você só pode bloquear a sua própria agenda." }, { status: 403 });
    }
    const [targetEmployee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, targetEmpId), eq(employees.companyId, auth.user.companyId)))
      .limit(1);
    if (!targetEmployee) {
      return Response.json({ error: "Profissional não encontrado." }, { status: 404 });
    }
  } else if (!hasMinRole(auth.user.role, "manager")) {
    return Response.json({ error: "Apenas administradores podem criar bloqueios gerais." }, { status: 403 });
  }

  if (targetLocId) {
    const [targetLoc] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, targetLocId), eq(locations.companyId, auth.user.companyId)))
      .limit(1);
    if (!targetLoc) return Response.json({ error: "Unidade não encontrada." }, { status: 404 });
  }

  if (!isValidDateKey(date)) {
    return Response.json({ error: "Data inicial inválida." }, { status: 400 });
  }

  const finalEndDate = endDate && isValidDateKey(endDate) ? endDate : date;
  if (finalEndDate < date) {
    return Response.json({ error: "A data final deve ser igual ou posterior à data inicial." }, { status: 400 });
  }

  let startsAtDate: Date;
  let endsAtDate: Date;

  if (allDay || finalEndDate !== date) {
    startsAtDate = new Date(`${date}T00:00:00Z`);
    endsAtDate = new Date(`${finalEndDate}T23:59:59Z`);
  } else {
    const sTime = startsAt && isValidTime(startsAt) ? startsAt : "00:00";
    const eTime = endsAt && isValidTime(endsAt) ? endsAt : "23:59";
    if (sTime >= eTime) {
      return Response.json({ error: "O horário final deve ser depois do inicial." }, { status: 400 });
    }
    startsAtDate = new Date(`${date}T${sTime}:00Z`);
    endsAtDate = new Date(`${date}T${eTime}:00Z`);
  }

  const [created] = await db
    .insert(scheduleBlocks)
    .values({
      companyId: auth.user.companyId,
      employeeId: targetEmpId,
      locationId: targetLocId,
      startsAt: startsAtDate,
      endsAt: endsAtDate,
      reason: reason.trim(),
      allDay: allDay ?? (finalEndDate !== date),
    })
    .returning();

  return Response.json(
    {
      data: {
        id: created.id,
        employeeId: created.employeeId,
        locationId: created.locationId,
        date: created.startsAt.toISOString().slice(0, 10),
        startsAt: created.startsAt.toISOString().slice(11, 16),
        endsAt: created.endsAt.toISOString().slice(11, 16),
        allDay: created.allDay,
        reason: created.reason,
      },
    },
    { status: 201 },
  );
}
