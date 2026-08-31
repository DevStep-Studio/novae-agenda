import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employeeSchedules, employees } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { centsToNumber, isUuid, normalizeTime } from "@/lib/domain";
import type { EmployeeDTO, EmployeeScheduleDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Profissional não encontrado." }, { status: 404 });

  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.companyId, auth.user.companyId)))
    .limit(1);

  if (!employee) return Response.json({ error: "Profissional não encontrado." }, { status: 404 });

  const schedules = await db
    .select()
    .from(employeeSchedules)
    .where(eq(employeeSchedules.employeeId, id))
    .orderBy(employeeSchedules.dayOfWeek);

  const scheduleDto: EmployeeScheduleDTO[] = schedules.map((schedule) => ({
    id: schedule.id,
    dayOfWeek: schedule.dayOfWeek,
    startTime: normalizeTime(schedule.startTime),
    endTime: normalizeTime(schedule.endTime),
    breakStart: schedule.breakStart ? normalizeTime(schedule.breakStart) : null,
    breakEnd: schedule.breakEnd ? normalizeTime(schedule.breakEnd) : null,
  }));

  const dto: EmployeeDTO = {
    id: employee.id,
    name: employee.name,
    jobTitle: employee.jobTitle,
    phone: employee.phone,
    active: employee.active,
    color: "#d6ebe6",
    initials: employee.name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join(""),
    commissionType: employee.commissionType as EmployeeDTO["commissionType"],
    commissionValue: centsToNumber(employee.commissionValue),
    services: [],
    serviceIds: [],
  };

  return Response.json({ data: { ...dto, schedules: scheduleDto } });
}

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  jobTitle: z.string().max(80).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  active: z.boolean().optional(),
  commissionType: z.enum(["none", "percentage", "fixed"]).optional(),
  commissionValue: z.number().min(0).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Profissional não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  const data = parsed.data;
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.jobTitle !== undefined) patch.jobTitle = data.jobTitle?.trim() || null;
  if (data.phone !== undefined) patch.phone = data.phone?.trim() || null;
  if (data.active !== undefined) patch.active = data.active;
  if (data.commissionType !== undefined) patch.commissionType = data.commissionType;
  if (data.commissionValue !== undefined) patch.commissionValue = String(data.commissionValue);

  const [updated] = await db
    .update(employees)
    .set(patch)
    .where(and(eq(employees.id, id), eq(employees.companyId, auth.user.companyId)))
    .returning();

  if (!updated) return Response.json({ error: "Profissional não encontrado." }, { status: 404 });

  return Response.json({ data: { id: updated.id } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Profissional não encontrado." }, { status: 404 });

  const [deactivated] = await db
    .update(employees)
    .set({ active: false })
    .where(and(eq(employees.id, id), eq(employees.companyId, auth.user.companyId)))
    .returning({ id: employees.id });

  if (!deactivated) return Response.json({ error: "Profissional não encontrado." }, { status: 404 });

  return Response.json({ data: { id: deactivated.id } });
}
