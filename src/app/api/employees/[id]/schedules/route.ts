import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employeeSchedules, employees } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { isUuid, isValidTime } from "@/lib/domain";

export const dynamic = "force-dynamic";

const scheduleSchema = z.object({
  schedules: z
    .array(
      z.object({
        dayOfWeek: z.number().min(0).max(6),
        startTime: z.string(),
        endTime: z.string(),
        breakStart: z.string().nullable().optional(),
        breakEnd: z.string().nullable().optional(),
        active: z.boolean(),
      }),
    )
    .min(1),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
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

  await db.delete(employeeSchedules).where(eq(employeeSchedules.employeeId, id));

  await db.insert(employeeSchedules).values(
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

  return Response.json({ data: { ok: true } });
}
