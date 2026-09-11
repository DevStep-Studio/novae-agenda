import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireAuth, requireRole, unauthorized } from "@/lib/auth";
import type { LocationDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const rows = await db
    .select({
      id: locations.id,
      companyId: locations.companyId,
      name: locations.name,
      address: locations.address,
      phone: locations.phone,
      openTime: locations.openTime,
      closeTime: locations.closeTime,
      active: locations.active,
    })
    .from(locations)
    .where(and(eq(locations.companyId, auth.user.companyId), eq(locations.active, true)))
    .orderBy(asc(locations.name));

  const dtos: LocationDTO[] = rows.map((loc) => ({
    id: loc.id,
    companyId: loc.companyId,
    name: loc.name,
    address: loc.address,
    phone: loc.phone,
    openTime: loc.openTime.slice(0, 5),
    closeTime: loc.closeTime.slice(0, 5),
    active: loc.active,
  }));

  return Response.json({ data: dtos });
}

const createSchema = z.object({
  name: z.string().min(2, "Informe o nome da unidade.").max(120),
  address: z.string().max(255).optional(),
  phone: z.string().max(20).optional(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de abertura inválido.").optional(),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de fechamento inválido.").optional(),
});

export async function POST(request: Request) {
  const gate = await requireRole("admin");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { name, address, phone, openTime, closeTime } = parsed.data;

  const locationId = crypto.randomUUID();
  const trimmedName = name.trim();
  const trimmedAddress = address?.trim() || null;
  const trimmedPhone = phone?.trim() || null;
  const formattedOpenTime = openTime ? `${openTime}:00` : "08:00:00";
  const formattedCloseTime = closeTime ? `${closeTime}:00` : "19:00:00";

  await db
    .insert(locations)
    .values({
      id: locationId,
      companyId: auth.user.companyId,
      name: trimmedName,
      address: trimmedAddress,
      phone: trimmedPhone,
      openTime: formattedOpenTime,
      closeTime: formattedCloseTime,
      active: true,
    });

  const created = {
    id: locationId,
    companyId: auth.user.companyId,
    name: trimmedName,
    address: trimmedAddress,
    phone: trimmedPhone,
    openTime: formattedOpenTime,
    closeTime: formattedCloseTime,
    active: true,
  };

  await recordAudit({
    companyId: auth.user.companyId,
    userId: auth.user.userId,
    action: "location.created",
    entity: "location",
    entityId: created.id,
    metadata: { name: created.name },
  });

  const dto: LocationDTO = {
    id: created.id,
    companyId: created.companyId,
    name: created.name,
    address: created.address,
    phone: created.phone,
    openTime: created.openTime.slice(0, 5),
    closeTime: created.closeTime.slice(0, 5),
    active: created.active,
  };

  return Response.json({ data: dto }, { status: 201 });
}
