import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, companies, companySettings } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { BookingError, bookingError, sameOrigin } from "@/lib/booking/errors";
import { safeImageUrl } from "@/lib/booking/validation";
import { isValidHexColor } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireRole("manager");
  if (gate.response) return gate.response;

  const companyId = gate.auth.user.companyId;

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId));

  if (!company) {
    return Response.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const settingsRows = await db
    .select()
    .from(companySettings)
    .where(eq(companySettings.companyId, companyId));

  const settingsMap = Object.fromEntries(
    settingsRows.map((s) => [s.key, s.value]),
  );

  return Response.json({
    data: {
      name: company.name,
      slug: company.publicSlug,
      logoUrl: company.logoUrl,
      avatarUrl: settingsMap.avatarUrl || null,
      coverUrl: settingsMap.coverUrl || null,
      coverPosition: settingsMap.coverPosition || "center",
      primaryColor: company.publicColor || company.primaryColor || "#dcff4c",
      bookingThemeMode: settingsMap.bookingThemeMode || "auto",
      businessType: company.businessType,
      publicDescription: company.publicDescription,
    },
  });
}

const brandingSchema = z.object({
  logoUrl: safeImageUrl.optional().nullable(),
  avatarUrl: safeImageUrl.optional().nullable(),
  coverUrl: safeImageUrl.optional().nullable(),
  coverPosition: z.enum(["center", "top", "bottom"]).default("center"),
  primaryColor: z
    .string()
    .refine(isValidHexColor, "Informe uma cor hexadecimal válida (ex: #DCFF4C)"),
  bookingThemeMode: z.enum(["auto", "light", "dark"]).default("auto"),
});

export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const gate = await requireRole("manager");
    if (gate.response) return gate.response;

    const { companyId, userId } = gate.auth.user;
    const body = brandingSchema.parse(await request.json());

    await db.transaction(async (tx) => {
      // 1. Update company record
      await tx
        .update(companies)
        .set({
          logoUrl: body.logoUrl || null,
          publicColor: body.primaryColor,
          primaryColor: body.primaryColor,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId));

      // 2. Helper to upsert company_settings
      const upsertSetting = async (key: string, value: string | null) => {
        if (value === null || value === undefined) {
          await tx
            .delete(companySettings)
            .where(
              and(
                eq(companySettings.companyId, companyId),
                eq(companySettings.key, key),
              ),
            );
        } else {
          const [existing] = await tx
            .select()
            .from(companySettings)
            .where(
              and(
                eq(companySettings.companyId, companyId),
                eq(companySettings.key, key),
              ),
            );

          if (existing) {
            await tx
              .update(companySettings)
              .set({ value })
              .where(eq(companySettings.id, existing.id));
          } else {
            await tx.insert(companySettings).values({
              companyId,
              key,
              value,
            });
          }
        }
      };

      await upsertSetting("avatarUrl", body.avatarUrl || null);
      await upsertSetting("coverUrl", body.coverUrl || null);
      await upsertSetting("coverPosition", body.coverPosition || "center");
      await upsertSetting("bookingThemeMode", body.bookingThemeMode || "auto");

      // 3. Log audit event
      await tx.insert(auditLogs).values({
        companyId,
        userId,
        action: "branding.updated",
        entity: "company",
        entityId: companyId,
        metadata: {
          primaryColor: body.primaryColor,
          bookingThemeMode: body.bookingThemeMode,
          hasLogo: Boolean(body.logoUrl),
          hasCover: Boolean(body.coverUrl),
        },
      });
    });

    return Response.json({ data: { ok: true } });
  } catch (error) {
    return bookingError(error);
  }
}
