import { and, eq, gte } from "drizzle-orm";
import { isUuid, isValidTime } from "@/lib/domain";
import { z } from "zod";
import { db } from "@/db";
import { scheduleBlocks } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import type { ScheduleBlockDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const date = searchParams.get("date");

  const conditions = [eq(scheduleBlocks.companyId, auth.user.companyId)];
  if (employeeId && isUuid(employeeId)) conditions.push(eq(scheduleBlocks.employeeId, employeeId));

  const rows = await db.select().from(scheduleBlocks).where(and(...conditions)).orderBy(scheduleBlocks.startsAt);

  const dto: ScheduleBlockDTO[] = rows
    .filter((block) => {
      if (!date) return true;
      const blockDate = block.startsAt.toISOString().slice(0, 10);
      return blockDate === date;
    })
    .map((block) => ({
      id: block.id,
      employeeId: block.employeeId,
      date: block.startsAt.toISOString().slice(0, 10),
      startsAt: block.startsAt.toISOString().slice(11, 16),
      endsAt: block.endsAt.toISOString().slice(11, 16),
      allDay: block.allDay,
      reason: block.reason,
    }));

  return Response.json({ data: dto });
}

const createSchema = z.object({
  employeeId: z.string(),
  date: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  allDay: z.boolean().optional(),
  reason: z.string().min(1, "Informe o motivo do bloqueio.").max(200),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { employeeId, date, startsAt, endsAt, allDay, reason } = parsed.data;

  if (!isUuid(employeeId)) {
    return Response.json({ error: "Profissional inválido." }, { status: 400 });
  }
  if (allDay) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: "Data inválida." }, { status: 400 });
    }
  } else if (!isValidTime(startsAt) || !isValidTime(endsAt) || startsAt >= endsAt) {
    return Response.json({ error: "Informe um período válido." }, { status: 400 });
  }

  const startsAtDate = allDay ? new Date(`${date}T00:00:00-03:00`) : new Date(`${date}T${startsAt}:00-03:00`);
  const endsAtDate = allDay ? new Date(`${date}T23:59:59-03:00`) : new Date(`${date}T${endsAt}:00-03:00`);

  const [created] = await db
    .insert(scheduleBlocks)
    .values({
      companyId: auth.user.companyId,
      employeeId,
      startsAt: startsAtDate,
      endsAt: endsAtDate,
      reason: reason.trim(),
      allDay: allDay ?? false,
    })
    .returning();

  return Response.json(
    {
      data: {
        id: created.id,
        employeeId: created.employeeId,
        date: created.startsAt.toISOString().slice(0, 10),
        startsAt: created.startsAt.toISOString().slice(11, 16),
        endsAt: created.endsAt.toISOString().slice(11, 16),
        allDay: created.allDay,
        reason: created.reason,
      },
    },
    { status: 201 },
  );
}
