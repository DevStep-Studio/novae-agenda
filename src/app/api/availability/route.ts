import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, services } from "@/db/schema";
import { getAvailabilitySlots } from "@/lib/availability";
import { requireAuth, unauthorized } from "@/lib/auth";
import { isUuid, isValidDateKey } from "@/lib/domain";
import type { AvailabilityResponse } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId") ?? "";
  const date = searchParams.get("date") ?? "";
  const serviceId = searchParams.get("serviceId") ?? "";
  const durationRaw = searchParams.get("duration") ?? "";

  if (!isUuid(employeeId)) {
    return Response.json({ error: "Selecione um profissional válido." }, { status: 400 });
  }
  if (!isValidDateKey(date)) {
    return Response.json({ error: "Data inválida." }, { status: 400 });
  }

  let durationMinutes = parseInt(durationRaw, 10);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    const [service] = await db
      .select({ durationMinutes: services.durationMinutes })
      .from(services)
      .where(and(eq(services.id, serviceId), eq(services.companyId, auth.user.companyId)))
      .limit(1);
    if (!service) return Response.json({ error: "Serviço não encontrado." }, { status: 404 });
    durationMinutes = service.durationMinutes;
  }

  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.companyId, auth.user.companyId)))
    .limit(1);
  if (!employee) return Response.json({ error: "Profissional não encontrado." }, { status: 404 });

  const slots = await getAvailabilitySlots({
    companyId: auth.user.companyId,
    employeeId,
    date,
    durationMinutes,
    timezone: auth.companyTimezone,
  });

  const response: AvailabilityResponse = { date, employeeId, durationMinutes, slots };
  return Response.json({ data: response });
}
