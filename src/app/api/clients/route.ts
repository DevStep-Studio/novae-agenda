import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appointments, clients, payments } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { centsToNumber } from "@/lib/domain";
import type { ClientDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  const where = query
    ? and(eq(clients.companyId, auth.user.companyId), or(ilike(clients.name, `%${query}%`), ilike(clients.phone, `%${query}%`), ilike(clients.email, `%${query}%`)))
    : eq(clients.companyId, auth.user.companyId);

  const rows = await db.select().from(clients).where(where).orderBy(desc(clients.createdAt)).limit(200);
  const ids = rows.map((r) => r.id);

  // Visits + last visit from completed appointments; spent from received payments. Two grouped
  // queries instead of one-per-client (avoids N+1).
  const visitRows = ids.length
    ? await db
        .select({
          clientId: appointments.clientId,
          visits: sql<number>`count(*)`.as("visits"),
          last: sql<string | null>`max(${appointments.appointmentDate})`.as("last"),
        })
        .from(appointments)
        .where(and(inArray(appointments.clientId, ids), eq(appointments.status, "completed")))
        .groupBy(appointments.clientId)
    : [];

  const spentRows = ids.length
    ? await db
        .select({
          clientId: appointments.clientId,
          spent: sql<number>`coalesce(sum(${payments.amount}), 0)`.as("spent"),
        })
        .from(payments)
        .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
        .where(and(inArray(appointments.clientId, ids), eq(payments.status, "paid")))
        .groupBy(appointments.clientId)
    : [];

  const visitsBy = new Map(visitRows.map((r) => [r.clientId, r]));
  const spentBy = new Map(spentRows.map((r) => [r.clientId, centsToNumber(r.spent)]));

  const dto: ClientDTO[] = rows.map((client) => ({
    id: client.id,
    name: client.name,
    phone: client.phone ?? "",
    email: client.email,
    photoUrl: client.photoUrl ?? null,
    notes: client.notes,
    active: client.active,
    initials: initials(client.name),
    color: avatarColor(client.name),
    visits: Number(visitsBy.get(client.id)?.visits ?? 0),
    spent: spentBy.get(client.id) ?? 0,
    lastVisit: visitsBy.get(client.id)?.last ?? null,
    nextVisit: null,
    createdAt: client.createdAt.toISOString(),
  }));

  return Response.json({ data: dto });
}

const createSchema = z.object({
  name: z.string().min(2, "Informe o nome do cliente.").max(120),
  phone: z.string().min(8, "Informe um telefone válido.").max(20),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { name, phone, email, notes } = parsed.data;

  const [created] = await db
    .insert(clients)
    .values({
      companyId: auth.user.companyId,
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      notes: notes?.trim() || null,
      active: true,
    })
    .returning();

  const dto: ClientDTO = {
    id: created.id,
    name: created.name,
    phone: created.phone ?? "",
    email: created.email,
    notes: created.notes,
    active: created.active,
    initials: initials(created.name),
    color: avatarColor(created.name),
    visits: 0,
    spent: 0,
    lastVisit: null,
    nextVisit: null,
    createdAt: created.createdAt.toISOString(),
  };

  return Response.json({ data: dto }, { status: 201 });
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}

const PALETTE = ["#d8e5f0", "#eadbdc", "#e4e0d2", "#e2d9ea", "#d9e8e0", "#e7e0d7", "#dce5ee", "#d6ebe6"];
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  return PALETTE[hash % PALETTE.length];
}
