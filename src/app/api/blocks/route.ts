import { and, eq } from "drizzle-orm";
import { isUuid, isValidTime } from "@/lib/domain";
import { z } from "zod";
import { db } from "@/db";
import { employees, scheduleBlocks } from "@/db/schema";
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
      const blockDate = block.startsAt.toISOString().slice(0, 10);
      return blockDate === date;
    })
    .map((block) => ({
      id: block.id,
      employeeId: block.employeeId,
      date: block.startsAt.toISOString().slice(0, 10),
      startsAt: block.startsAt.toISOString().slice(11, 16),
      endsAt: block.endsAt.toISOString().slice(11, 16),
      allDay: block.allDay,
      reason: block.reason,
    }));

  return Response.json({ data: dto });
}

const createSchema = z.object({
  employeeId: z.string(),
  date: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
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
  const { employeeId, date, startsAt, endsAt, allDay, reason } = parsed.data;

  if (!isUuid(employeeId)) {
    return Response.json({ error: "Profissional inválido." }, { status: 400 });
  }

  // An employee may only block their own agenda; managers+ may block anyone in the company.
  if (!hasMinRole(auth.user.role, "manager") && auth.user.employeeId !== employeeId) {
    return Response.json({ error: "Você só pode bloquear a sua própria agenda." }, { status: 403 });
  }
  const [targetEmployee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.companyId, auth.user.companyId)))
    .limit(1);
  if (!targetEmployee) {
    return Response.json({ error: "Profissional não encontrado." }, { status: 404 });
  }
  if (allDay) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: "Data inválida." }, { status: 400 });
    }
  } else if (!isValidTime(startsAt) || !isValidTime(endsAt) || startsAt >= endsAt) {
    return Response.json({ error: "Informe um período válido." }, { status: 400 });
  }

  const startsAtDate = allDay ? new Date(`${date}T00:00:00-03:00`) : new Date(`${date}T${startsAt}:00-03:00`);
  const endsAtDate = allDay ? new Date(`${date}T23:59:59-03:00`) : new Date(`${date}T${endsAt}:00-03:00`);

  const [created] = await db
    .insert(scheduleBlocks)
    .values({
      companyId: auth.user.companyId,
      employeeId,
      startsAt: startsAtDate,
      endsAt: endsAtDate,
      reason: reason.trim(),
      allDay: allDay ?? false,
    })
    .returning();

  return Response.json(
    {
      data: {
        id: created.id,
        employeeId: created.employeeId,
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
