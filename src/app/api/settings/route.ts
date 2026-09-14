import { lockCompany } from "@/lib/booking/service";
import { assertTimezoneChange } from "@/lib/booking/timezone-setting";
import { BookingError, bookingError } from "@/lib/booking/errors";
import { isValidTime } from "@/lib/domain";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import {
  getCompanySettings,
  setCompanySetting,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const settings = await getCompanySettings(auth.user.companyId);
  const [company] = await db
    .select({ timezone: companies.timezone })
    .from(companies)
    .where(eq(companies.id, auth.user.companyId))
    .limit(1);

  return Response.json({
    data: {
      ...settings,
      timezone: company?.timezone ?? "America/Sao_Paulo",
    },
  });
}

const updateSchema = z.object({
  openTime: z.string().refine(isValidTime).optional(),
  closeTime: z.string().refine(isValidTime).optional(),
  workingDays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  slotIntervalMinutes: z.number().int().min(5).max(120).optional(),
  defaultDurationMinutes: z.number().int().min(5).max(480).optional(),
  bufferMinutes: z.number().int().min(0).max(120).optional(),
  maxLeadDays: z.number().int().min(0).max(365).optional(),
  minLeadMinutes: z.number().int().min(0).max(10080).optional(),
  cancellationHours: z.number().int().min(0).max(720).optional(),
  rescheduleHours: z.number().int().min(0).max(720).optional(),
  dailyBookingLimit: z.number().int().min(0).max(500).optional(),
  allowHolidayBookings: z.boolean().optional(),
  timezone: z.string().min(2).max(80).optional(),
});

export async function PUT(request: Request) {
  const gate = await requireRole("admin");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const companyId = auth.user.companyId;

  try {
    await db.transaction(async (tx) => {
      await lockCompany(tx, companyId);
      const current = await getCompanySettings(companyId, tx);
      if (
        (data.openTime ?? current.openTime) >=
        (data.closeTime ?? current.closeTime)
      )
        throw new BookingError("O fechamento deve ser depois da abertura.");
      if (data.openTime)
        await setCompanySetting(companyId, "openTime", data.openTime, tx);
      if (data.closeTime)
        await setCompanySetting(companyId, "closeTime", data.closeTime, tx);
      if (data.workingDays)
        await setCompanySetting(companyId, "workingDays", data.workingDays, tx);
      if (data.slotIntervalMinutes !== undefined)
        await setCompanySetting(
          companyId,
          "slotIntervalMinutes",
          data.slotIntervalMinutes,
          tx,
        );
      if (data.defaultDurationMinutes !== undefined)
        await setCompanySetting(
          companyId,
          "defaultDurationMinutes",
          data.defaultDurationMinutes,
          tx,
        );
      if (data.bufferMinutes !== undefined)
        await setCompanySetting(
          companyId,
          "bufferMinutes",
          data.bufferMinutes,
          tx,
        );
      if (data.maxLeadDays !== undefined)
        await setCompanySetting(companyId, "maxLeadDays", data.maxLeadDays, tx);
      if (data.minLeadMinutes !== undefined)
        await setCompanySetting(companyId, "minLeadMinutes", data.minLeadMinutes, tx);
      if (data.cancellationHours !== undefined)
        await setCompanySetting(companyId, "cancellationHours", data.cancellationHours, tx);
      if (data.rescheduleHours !== undefined)
        await setCompanySetting(companyId, "rescheduleHours", data.rescheduleHours, tx);
      if (data.dailyBookingLimit !== undefined)
        await setCompanySetting(companyId, "dailyBookingLimit", data.dailyBookingLimit, tx);
      if (data.allowHolidayBookings !== undefined)
        await setCompanySetting(companyId, "allowHolidayBookings", data.allowHolidayBookings ? "true" : "false", tx);

      if (data.timezone) {
        await assertTimezoneChange(tx, companyId, data.timezone);
        await tx
          .update(companies)
          .set({ timezone: data.timezone })
          .where(eq(companies.id, companyId));
      }
    });
  } catch (error) {
    return bookingError(error);
  }

  await recordAudit({
    companyId,
    userId: auth.user.userId,
    action: "company_settings.updated",
    entity: "company_settings",
    entityId: companyId,
    metadata: data,
  });

  const updated = await getCompanySettings(companyId);
  return Response.json({
    data: {
      ...updated,
      timezone: data.timezone ?? auth.companyTimezone,
    },
  });
}
