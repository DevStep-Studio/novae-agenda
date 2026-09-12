import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employeeSchedules, employeeServices, employees, services } from "@/db/schema";
import { requireAuth, requireRole, unauthorized } from "@/lib/auth";
import { centsToNumber, isUuid, normalizeTime } from "@/lib/domain";
import { PlanLimitService } from "@/lib/saas/plan-limits";
import { deleteProfessionalImage, saveProfessionalImage } from "@/lib/storage";
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

  const serviceLinks = await db
    .select({ serviceId: employeeServices.serviceId, serviceName: services.name })
    .from(employeeServices)
    .leftJoin(services, eq(employeeServices.serviceId, services.id))
    .where(eq(employeeServices.employeeId, id));

  const serviceIds = serviceLinks.map((s) => s.serviceId);
  const serviceNames = serviceLinks.map((s) => s.serviceName).filter(Boolean) as string[];

  const scheduleDto: EmployeeScheduleDTO[] = schedules.map((schedule) => ({
    id: schedule.id,
    employeeId: schedule.employeeId,
    locationId: schedule.locationId,
    dayOfWeek: schedule.dayOfWeek,
    startTime: normalizeTime(schedule.startTime),
    endTime: normalizeTime(schedule.endTime),
    breakStart: schedule.breakStart ? normalizeTime(schedule.breakStart) : null,
    breakEnd: schedule.breakEnd ? normalizeTime(schedule.breakEnd) : null,
    active: schedule.active,
  }));

  const dto: EmployeeDTO = {
    id: employee.id,
    name: employee.name,
    jobTitle: employee.jobTitle,
    phone: employee.phone,
    photoUrl: employee.photoUrl,
    bannerUrl: employee.bannerUrl,
    active: employee.active,
    color: "#d6ebe6",
    initials: employee.name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join(""),
    commissionType: employee.commissionType as EmployeeDTO["commissionType"],
    commissionValue: centsToNumber(employee.commissionValue),
    services: serviceNames,
    serviceIds,
    hasLogin: employee.userId !== null,
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
  photoUrl: z.string().max(8_000_000).nullable().optional(),
  bannerUrl: z.string().max(8_000_000).nullable().optional(),
  serviceIds: z.array(z.string()).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("manager");
  if (gate.response) return gate.response;
  const { auth } = gate;
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Profissional não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const data = parsed.data;

  const [current] = await db
    .select({ photoUrl: employees.photoUrl, active: employees.active })
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.companyId, auth.user.companyId)))
    .limit(1);
  if (!current) return Response.json({ error: "Profissional não encontrado." }, { status: 404 });

  if (data.active === true && !current.active) {
    try {
      await PlanLimitService.assertCanAddEmployee(auth.user.companyId);
    } catch (limitErr: any) {
      return Response.json(
        {
          error: limitErr.message || "Limite de funcionários do plano atingido.",
          code: "PLAN_EMPLOYEE_LIMIT_EXCEEDED",
          usage: limitErr.usage,
        },
        { status: 403 }
      );
    }
  }

  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.jobTitle !== undefined) patch.jobTitle = data.jobTitle?.trim() || null;
  if (data.phone !== undefined) patch.phone = data.phone?.trim() || null;
  if (data.active !== undefined) patch.active = data.active;
  if (data.commissionType !== undefined) patch.commissionType = data.commissionType;
  if (data.commissionValue !== undefined) patch.commissionValue = String(data.commissionValue);
  if (data.photoUrl !== undefined) {
    try {
      patch.photoUrl = data.photoUrl
        ? await saveProfessionalImage(data.photoUrl, current.photoUrl)
        : null;
      if (!data.photoUrl && current.photoUrl) await deleteProfessionalImage(current.photoUrl);
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Imagem inválida." }, { status: 400 });
    }
  }
  if (data.bannerUrl !== undefined) {
    try {
      patch.bannerUrl = data.bannerUrl
        ? await saveProfessionalImage(data.bannerUrl)
        : null;
    } catch {
      patch.bannerUrl = data.bannerUrl ?? null;
    }
  }

  if (Object.keys(patch).length > 0) {
    await db
      .update(employees)
      .set(patch)
      .where(and(eq(employees.id, id), eq(employees.companyId, auth.user.companyId)));
  }

  if (data.serviceIds !== undefined) {
    const owned = data.serviceIds.length > 0
      ? await db
          .select({ id: services.id })
          .from(services)
          .where(and(inArray(services.id, data.serviceIds), eq(services.companyId, auth.user.companyId)))
      : [];
    const ownedIds = new Set(owned.map((s) => s.id));
    const linkIds = data.serviceIds.filter((sid) => ownedIds.has(sid));

    await db.delete(employeeServices).where(eq(employeeServices.employeeId, id));
    if (linkIds.length > 0) {
      await db.insert(employeeServices).values(
        linkIds.map((serviceId) => ({
          id: crypto.randomUUID(),
          employeeId: id,
          serviceId,
        }))
      );
    }
  }

  const [updated] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.companyId, auth.user.companyId)));

  if (!updated) return Response.json({ error: "Profissional não encontrado." }, { status: 404 });

  return Response.json({ data: { id: updated.id } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("manager");
  if (gate.response) return gate.response;
  const { auth } = gate;
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Profissional não encontrado." }, { status: 404 });

  const [existing] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.companyId, auth.user.companyId)));

  if (!existing) return Response.json({ error: "Profissional não encontrado." }, { status: 404 });

  await db
    .update(employees)
    .set({ active: false })
    .where(and(eq(employees.id, id), eq(employees.companyId, auth.user.companyId)));

  return Response.json({ data: { id: existing.id } });
}
