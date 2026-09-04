import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireAuth, requireRole, unauthorized } from "@/lib/auth";
import { getCompanySettings, setCompanySetting, type CompanySettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

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
  openTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workingDays: z.array(z.number().min(0).max(6)).min(1).optional(),
  slotIntervalMinutes: z.number().min(5).max(120).optional(),
  defaultDurationMinutes: z.number().min(5).max(480).optional(),
  bufferMinutes: z.number().min(0).max(120).optional(),
  maxLeadDays: z.number().min(0).max(365).optional(),
  timezone: z.string().min(2).max(80).optional(),
});

export async function PUT(request: Request) {
  const gate = await requireRole("admin");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const data = parsed.data;
  const companyId = auth.user.companyId;

  if (data.openTime) await setCompanySetting(companyId, "openTime", data.openTime);
  if (data.closeTime) await setCompanySetting(companyId, "closeTime", data.closeTime);
  if (data.workingDays) await setCompanySetting(companyId, "workingDays", data.workingDays);
  if (data.slotIntervalMinutes !== undefined) await setCompanySetting(companyId, "slotIntervalMinutes", data.slotIntervalMinutes);
  if (data.defaultDurationMinutes !== undefined) await setCompanySetting(companyId, "defaultDurationMinutes", data.defaultDurationMinutes);
  if (data.bufferMinutes !== undefined) await setCompanySetting(companyId, "bufferMinutes", data.bufferMinutes);
  if (data.maxLeadDays !== undefined) await setCompanySetting(companyId, "maxLeadDays", data.maxLeadDays);

  if (data.timezone) {
    await db.update(companies).set({ timezone: data.timezone }).where(eq(companies.id, companyId));
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
