import { bookingError, BookingError } from "@/lib/booking/errors";
import { safeImageUrl } from "@/lib/booking/validation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employeeServices, employees, serviceCategories, services } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireAuth, requireRole, unauthorized } from "@/lib/auth";
import { centsToNumber } from "@/lib/domain";
import type { ServiceDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const rows = await db
    .select({
      id: services.id,
      name: services.name,
      categoryId: services.categoryId,
      categoryName: serviceCategories.name,
      description: services.description,
      price: services.price,
      durationMinutes: services.durationMinutes,
      color: services.color,
      active: services.active,
      bufferMinutes: services.bufferMinutes, imageUrl: services.imageUrl, deliveryMode: services.deliveryMode, paymentType: services.paymentType, depositAmount: services.depositAmount, cancellationPolicy: services.cancellationPolicy,
    })
    .from(services)
    .leftJoin(serviceCategories, eq(services.categoryId, serviceCategories.id))
    .where(eq(services.companyId, auth.user.companyId))
    .orderBy(asc(services.name));

  const dto: ServiceDTO[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    description: row.description,
    price: centsToNumber(row.price),
    durationMinutes: row.durationMinutes,
    color: row.color,
    active: row.active,
    bufferMinutes: row.bufferMinutes, imageUrl: row.imageUrl, deliveryMode: row.deliveryMode, paymentType: row.paymentType, depositAmount: Number(row.depositAmount), cancellationPolicy: row.cancellationPolicy,
  }));

  return Response.json({ data: dto });
}

const createSchema = z.object({
  name: z.string().min(2, "Informe o nome do serviço.").max(120),
  categoryId: z.string().optional().nullable(),
  description: z.string().max(1000).optional(),
  price: z.number().min(0, "O valor não pode ser negativo.").max(1000000),
  durationMinutes: z.number().int().min(5, "A duração mínima é de 5 minutos.").max(1440),
  color: z.string().optional().nullable(),
  employeeIds: z.array(z.uuid()).max(100).optional(),
  bufferMinutes: z.number().int().min(0).max(180).default(0),
  imageUrl: safeImageUrl.optional().nullable(),
  deliveryMode: z.enum(["IN_PERSON","ONLINE"]).default("IN_PERSON"),
  paymentType: z.enum(["PAY_LATER","FULL_PAYMENT","DEPOSIT"]).default("PAY_LATER"),
  depositAmount: z.number().min(0).default(0),
  cancellationPolicy: z.string().max(1000).optional(),
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
  const { name, categoryId, description, price, durationMinutes, color } = parsed.data;

  let validCategoryId: string | null = null;
  if (categoryId) {
    const [category] = await db
      .select({ id: serviceCategories.id })
      .from(serviceCategories)
      .where(and(eq(serviceCategories.id, categoryId), eq(serviceCategories.companyId, auth.user.companyId)))
      .limit(1);
    if (category) validCategoryId = category.id;
  }

  let created: any;
  try {
    created = await db.transaction(async tx => {
      if (parsed.data.depositAmount > price) throw new BookingError("O sinal não pode exceder o preço.");
      const employeeIds = [...new Set(parsed.data.employeeIds ?? [])];
      const team = employeeIds.length ? await tx.select().from(employees).where(and(eq(employees.companyId, auth.user.companyId), inArray(employees.id, employeeIds))) : [];
      if (team.length !== employeeIds.length) throw new BookingError("Profissional inválido.");

      const serviceId = crypto.randomUUID();
      await tx
        .insert(services)
        .values({
          id: serviceId,
          companyId: auth.user.companyId,
          name: name.trim(),
          categoryId: validCategoryId,
          description: description?.trim() || null,
          price: price.toFixed(2),
          durationMinutes,
          color: color || null,
          active: true,
          bufferMinutes: parsed.data.bufferMinutes,
          imageUrl: parsed.data.imageUrl || null,
          deliveryMode: parsed.data.deliveryMode,
          paymentType: parsed.data.paymentType,
          depositAmount: parsed.data.depositAmount.toFixed(2),
          cancellationPolicy: parsed.data.cancellationPolicy || null,
        });

      if (employeeIds.length) {
        await tx.insert(employeeServices).values(team.map(e => ({
          employeeId: e.id,
          serviceId: serviceId,
          commissionType: e.commissionType,
          commissionValue: e.commissionValue,
        })));
      }

      return {
        id: serviceId,
        name: name.trim(),
        categoryId: validCategoryId,
        description: description?.trim() || null,
        price: price.toFixed(2),
        durationMinutes,
        color: color || null,
        active: true,
      };
    });
  } catch(error) {
    return bookingError(error);
  }

  await recordAudit({
    companyId: auth.user.companyId,
    userId: auth.user.userId,
    action: "service.created",
    entity: "service",
    entityId: created.id,
    metadata: { name: created.name, price: centsToNumber(created.price) },
  });

  const dto: ServiceDTO = {
    id: created.id,
    name: created.name,
    categoryId: created.categoryId,
    categoryName: null,
    description: created.description,
    price: centsToNumber(created.price),
    durationMinutes: created.durationMinutes,
    color: created.color,
    active: created.active,
  };

  return Response.json({ data: dto }, { status: 201 });
}
