import { lockCompany } from "@/lib/booking/service";
import { bookingError } from "@/lib/booking/errors";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employeeSchedules, employees } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { isUuid, isValidTime } from "@/lib/domain";

export const dynamic = "force-dynamic";

const scheduleSchema = z.object({
  schedules: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string(),
        endTime: z.string(),
        breakStart: z.string().nullable().optional(),
        breakEnd: z.string().nullable().optional(),
        active: z.boolean(),
      }),
    )
    .min(1).max(28),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("manager");
  if (gate.response) return gate.response;
  const { auth } = gate;
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Profissional não encontrado." }, { status: 404 });

  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.companyId, auth.user.companyId)))
    .limit(1);

  if (!employee) return Response.json({ error: "Profissional não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Horários inválidos." }, { status: 400 });
  }

  for (const window of parsed.data.schedules) {
    if (!isValidTime(window.startTime) || !isValidTime(window.endTime)) {
      return Response.json({ error: "Horário inválido." }, { status: 400 });
    }
    if (window.startTime >= window.endTime) {
      return Response.json({ error: "O horário de saída deve ser depois da entrada." }, { status: 400 });
    }
  }

  for (const w of parsed.data.schedules) {
    if (Boolean(w.breakStart) !== Boolean(w.breakEnd) || (w.breakStart && w.breakEnd && (!isValidTime(w.breakStart) || !isValidTime(w.breakEnd) || w.breakStart >= w.breakEnd || w.breakStart < w.startTime || w.breakEnd > w.endTime))) return Response.json({error:"Intervalo de almoço inválido."},{status:400});
    if (w.active && parsed.data.schedules.some(other => other !== w && other.active && other.dayOfWeek === w.dayOfWeek && other.startTime < w.endTime && other.endTime > w.startTime)) return Response.json({error:"Períodos de trabalho sobrepostos."},{status:400});
  }
  try { await db.transaction(async tx => {
  await lockCompany(tx, auth.user.companyId);
  await tx.delete(employeeSchedules).where(eq(employeeSchedules.employeeId, id));

  await tx.insert(employeeSchedules).values(
    parsed.data.schedules.map((window) => ({
      employeeId: id,
      dayOfWeek: window.dayOfWeek,
      startTime: `${window.startTime}:00`,
      endTime: `${window.endTime}:00`,
      breakStart: window.breakStart ? `${window.breakStart}:00` : null,
      breakEnd: window.breakEnd ? `${window.breakEnd}:00` : null,
      active: window.active,
    })),
  );

  }); } catch(error) { return bookingError(error); }

  await recordAudit({
    companyId: auth.user.companyId,
    userId: auth.user.userId,
    action: "employee.schedule_updated",
    entity: "employee",
    entityId: id,
    metadata: { days: parsed.data.schedules.map((w) => w.dayOfWeek) },
  });

  return Response.json({ data: { ok: true } });
}
