import { BookingError, bookingError } from "@/lib/booking/errors";
import { safeImageUrl } from "@/lib/booking/validation";
import { lockCompany } from "@/lib/booking/service";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employeeServices, employees, serviceCategories, services } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { centsToNumber, isUuid } from "@/lib/domain";
import type { ServiceDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  categoryId: z.string().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  price: z.number().min(0).max(1000000).optional(),
  durationMinutes: z.number().int().min(5).max(1440).optional(),
  color: z.string().nullable().optional(),
  active: z.boolean().optional(),
  employeeIds: z.array(z.uuid()).max(100).optional(),
  bufferMinutes: z.number().int().min(0).max(180).optional(),
  imageUrl: safeImageUrl.optional().nullable(),
  deliveryMode: z.enum(["IN_PERSON","ONLINE"]).optional(),
  paymentType: z.enum(["PAY_LATER","FULL_PAYMENT","DEPOSIT"]).optional(),
  depositAmount: z.number().min(0).optional(),
  cancellationPolicy: z.string().max(1000).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Serviço não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  const data = parsed.data;
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.description !== undefined) patch.description = data.description?.trim() || null;
  if (data.price !== undefined) patch.price = data.price.toFixed(2);
  if (data.durationMinutes !== undefined) patch.durationMinutes = data.durationMinutes;
  if (data.color !== undefined) patch.color = data.color || null;
  if (data.active !== undefined) patch.active = data.active;
  if (data.categoryId !== undefined) patch.categoryId = data.categoryId;

  for (const key of ["bufferMinutes","imageUrl","deliveryMode","paymentType","cancellationPolicy"] as const) if (data[key] !== undefined) patch[key] = data[key];
  if (data.depositAmount !== undefined) patch.depositAmount = data.depositAmount.toFixed(2);
  let updated;
  try {
    updated = await db.transaction(async tx => {
      await lockCompany(tx, auth.user.companyId);
      const [existing] = await tx.select().from(services).where(and(eq(services.id, id), eq(services.companyId, auth.user.companyId)));
      if (!existing) throw new BookingError("Serviço não encontrado.", 404);
      if ((data.depositAmount ?? Number(existing.depositAmount)) > (data.price ?? Number(existing.price))) throw new BookingError("O sinal não pode exceder o preço.");
      if (data.categoryId) {
        const [category] = await tx.select().from(serviceCategories).where(and(eq(serviceCategories.id, data.categoryId), eq(serviceCategories.companyId, auth.user.companyId)));
        if (!category) throw new BookingError("Categoria inválida.");
      }
      if (data.employeeIds) {
        const ids = [...new Set(data.employeeIds)];
        const team = ids.length ? await tx.select().from(employees).where(and(eq(employees.companyId, auth.user.companyId), inArray(employees.id, ids))) : [];
        if (team.length !== ids.length) throw new BookingError("Profissional inválido.");
        const previous = await tx.select().from(employeeServices).where(eq(employeeServices.serviceId, id));
        await tx.delete(employeeServices).where(eq(employeeServices.serviceId, id));
        if (team.length) {
          await tx.insert(employeeServices).values(team.map(e => ({
            serviceId: id,
            employeeId: e.id,
            commissionType: previous.find(l => l.employeeId === e.id)?.commissionType ?? e.commissionType,
            commissionValue: previous.find(l => l.employeeId === e.id)?.commissionValue ?? e.commissionValue,
          })));
        }
      }
      await tx.update(services).set({ ...patch, updatedAt: new Date() }).where(and(eq(services.id, id), eq(services.companyId, auth.user.companyId)));
      const [result] = await tx.select().from(services).where(and(eq(services.id, id), eq(services.companyId, auth.user.companyId)));
      return result;
    });
  } catch(error) {
    return bookingError(error);
  }

  if (!updated) return Response.json({ error: "Serviço não encontrado." }, { status: 404 });

  const dto: ServiceDTO = {
    id: updated.id,
    name: updated.name,
    categoryId: updated.categoryId,
    categoryName: null,
    description: updated.description,
    price: centsToNumber(updated.price),
    durationMinutes: updated.durationMinutes,
    color: updated.color,
    active: updated.active,
  };

  return Response.json({ data: dto });
}
