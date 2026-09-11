import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appointments, clients, payments } from "@/db/schema";
import { requireAuth, requireRole, unauthorized } from "@/lib/auth";
import { centsToNumber, normalizePhoneDigits } from "@/lib/domain";
import { saveClientImage } from "@/lib/storage";
import type { ClientDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  const where = query
    ? and(eq(clients.companyId, auth.user.companyId), or(sql`lower(${clients.name}) LIKE ${`%${query.toLowerCase()}%`}`, sql`${clients.phone} LIKE ${`%${query}%`}`, sql`lower(${clients.email}) LIKE ${`%${query.toLowerCase()}%`}`))
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

  const statusRows = ids.length
    ? await db
        .select({
          clientId: appointments.clientId,
          cancelled: sql<number>`coalesce(sum(case when ${appointments.status} = 'cancelled' then 1 else 0 end), 0)`.as("cancelled"),
          noShow: sql<number>`coalesce(sum(case when ${appointments.status} = 'no_show' then 1 else 0 end), 0)`.as("noShow"),
          nextVisit: sql<string | null>`min(case when ${appointments.status} in ('scheduled', 'confirmed') and ${appointments.appointmentDate} >= curdate() then ${appointments.appointmentDate} else null end)`.as("nextVisit"),
        })
        .from(appointments)
        .where(inArray(appointments.clientId, ids))
        .groupBy(appointments.clientId)
    : [];

  const visitsBy = new Map(visitRows.map((r) => [r.clientId, r]));
  const spentBy = new Map(spentRows.map((r) => [r.clientId, centsToNumber(r.spent)]));
  const statusBy = new Map(statusRows.map((r) => [r.clientId, r]));

  const dto: ClientDTO[] = rows.map((client) => {
    const visits = Number(visitsBy.get(client.id)?.visits ?? 0);
    const spent = spentBy.get(client.id) ?? 0;
    const st = statusBy.get(client.id);
    const cancelledCount = Number(st?.cancelled ?? 0);
    const noShowCount = Number(st?.noShow ?? 0);
    const nextVisit = st?.nextVisit ?? null;

    const tags: string[] = [];
    if (spent >= 500 || visits >= 8) tags.push("VIP");
    else if (visits >= 3) tags.push("Recorrente");
    else if (visits <= 1) tags.push("Novo");

    if (noShowCount >= 2) tags.push("No-show frequente");

    return {
      id: client.id,
      name: client.name,
      phone: client.phone ?? "",
      email: client.email,
      photoUrl: client.photoUrl ?? null,
      notes: client.notes,
      internalNotes: client.internalNotes,
      active: client.active,
      initials: initials(client.name),
      color: avatarColor(client.name),
      visits,
      spent,
      averageTicket: visits > 0 ? spent / visits : 0,
      tags,
      cancelledCount,
      noShowCount,
      lastVisit: visitsBy.get(client.id)?.last ?? null,
      nextVisit,
      createdAt: client.createdAt.toISOString(),
    };
  });

  return Response.json({ data: dto });
}

const createSchema = z.object({
  name: z.string().min(2, "Informe o nome do cliente.").max(120),
  phone: z.string().min(8, "Informe um telefone válido.").max(20),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")).nullable(),
  photoUrl: z.string().optional().nullable(),
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
  const { name, phone, email, photoUrl, notes } = parsed.data;

  // Different formats of the same number ("(21) 99999-9999" vs "21999999999")
  // must not create two client records — compare on normalized digits rather
  // than exact string match.
  const normalizedIncoming = normalizePhoneDigits(phone);
  const existing = await db
    .select({ id: clients.id, name: clients.name, phone: clients.phone })
    .from(clients)
    .where(eq(clients.companyId, auth.user.companyId));
  const duplicate = existing.find(
    (c) => c.phone && normalizePhoneDigits(c.phone) === normalizedIncoming,
  );
  if (duplicate) {
    return Response.json(
      { error: `Já existe um cliente com este telefone: ${duplicate.name}.` },
      { status: 409 },
    );
  }

  let savedPhotoUrl: string | null = null;
  if (photoUrl && photoUrl.trim()) {
    try {
      savedPhotoUrl = await saveClientImage(photoUrl);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Imagem do cliente inválida." },
        { status: 400 },
      );
    }
  }

  const clientId = crypto.randomUUID();
  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  const trimmedEmail = email && email.trim() ? email.trim().toLowerCase() : null;
  const trimmedNotes = notes?.trim() || null;
  const createdAt = new Date();

  await db
    .insert(clients)
    .values({
      id: clientId,
      companyId: auth.user.companyId,
      name: trimmedName,
      photoUrl: savedPhotoUrl,
      phone: trimmedPhone,
      email: trimmedEmail,
      notes: trimmedNotes,
      active: true,
      createdAt,
    });

  const dto: ClientDTO = {
    id: clientId,
    name: trimmedName,
    phone: trimmedPhone,
    email: trimmedEmail,
    photoUrl: savedPhotoUrl,
    notes: trimmedNotes,
    active: true,
    initials: initials(trimmedName),
    color: avatarColor(trimmedName),
    visits: 0,
    spent: 0,
    lastVisit: null,
    nextVisit: null,
    createdAt: createdAt.toISOString(),
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
