import { getIdentity } from "@/lib/auth";
import { BookingError, bookingError, sameOrigin } from "@/lib/booking/errors";
import { db } from "@/db";
import { clients, notifications, users } from "@/db/schema";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { normalizePhoneDigits } from "@/lib/domain";
import type { ClientNoticeDTO } from "@/shared/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getIdentity();
    if (!user) {
      return Response.json(
        { data: [] },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const clientRows = await db
      .select({ id: clients.id, companyId: clients.companyId, phone: clients.phone })
      .from(clients)
      .where(eq(clients.userId, user.id));

    const userPhoneDigits = user.phone ? normalizePhoneDigits(user.phone) : "";

    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        companyId: notifications.companyId,
        userId: notifications.userId,
        entityType: notifications.entityType,
        entityId: notifications.entityId,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(
        and(
          isNull(notifications.readAt),
          inArray(notifications.type, [
            "client_notice_cancelled",
            "client_notice_rescheduled",
          ]),
          or(
            eq(notifications.userId, user.id),
            isNull(notifications.userId),
          ),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(20);

    const notices: ClientNoticeDTO[] = [];

    for (const row of rows) {
      let payload: Record<string, unknown> = {};
      if (row.body) {
        try {
          payload = JSON.parse(row.body);
        } catch {
          payload = { reason: row.body };
        }
      }

      // If notice has no userId, check if it was intended for this user's phone or company
      if (!row.userId && payload.clientPhone && userPhoneDigits) {
        const noticePhoneDigits = normalizePhoneDigits(String(payload.clientPhone));
        if (noticePhoneDigits !== userPhoneDigits) {
          continue;
        }
      }

      const actionType =
        (payload.actionType as "cancelled" | "rescheduled") ||
        (row.type === "client_notice_cancelled" ? "cancelled" : "rescheduled");

      notices.push({
        id: row.id,
        type: row.type,
        title: row.title,
        actionType,
        companyName: (payload.companyName as string) || "Estabelecimento",
        companyPhone: (payload.companyPhone as string) || null,
        serviceName: (payload.serviceName as string) || "Serviço",
        employeeName: (payload.employeeName as string) || null,
        date: (payload.date as string) || undefined,
        startTime: (payload.startTime as string) || undefined,
        oldDate: (payload.oldDate as string) || (payload.date as string) || undefined,
        oldStartTime: (payload.oldStartTime as string) || (payload.startTime as string) || undefined,
        newDate: (payload.newDate as string) || undefined,
        newStartTime: (payload.newStartTime as string) || undefined,
        reason: (payload.reason as string) || null,
        createdAt: row.createdAt.toISOString(),
      });
    }

    return Response.json(
      { data: notices },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return bookingError(error);
  }
}

const markReadSchema = z.object({
  id: z.string().optional(),
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await getIdentity();
    if (!user) throw new BookingError("Entre na sua conta.", 401);

    const body = await request.json().catch(() => ({}));
    const parsed = markReadSchema.parse(body);

    const now = new Date();

    if (parsed.id) {
      await db
        .update(notifications)
        .set({ readAt: now })
        .where(eq(notifications.id, parsed.id));
    } else if (parsed.ids && parsed.ids.length > 0) {
      await db
        .update(notifications)
        .set({ readAt: now })
        .where(inArray(notifications.id, parsed.ids));
    } else if (parsed.all) {
      await db
        .update(notifications)
        .set({ readAt: now })
        .where(
          and(
            eq(notifications.userId, user.id),
            isNull(notifications.readAt),
            inArray(notifications.type, [
              "client_notice_cancelled",
              "client_notice_rescheduled",
            ]),
          ),
        );
    }

    return Response.json({ data: { success: true } });
  } catch (error) {
    return bookingError(error);
  }
}
