import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, companies, companySettings } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { bookingError, sameOrigin } from "@/lib/booking/errors";
import { isValidHexColor } from "@/lib/branding";
import { saveBrandingImage } from "@/lib/storage";

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
      avatarUrl: settingsMap.avatar_url || settingsMap.avatarUrl || null,
      coverUrl: settingsMap.cover_url || settingsMap.coverUrl || null,
      coverPosition: settingsMap.cover_position || settingsMap.coverPosition || "center",
      primaryColor: company.publicColor || company.primaryColor || "#dcff4c",
      bookingThemeMode: (settingsMap.booking_theme_mode || settingsMap.bookingThemeMode || "auto") as "auto" | "light" | "dark",
      businessType: company.businessType,
      publicDescription: company.publicDescription,
    },
  });
}

const flexibleImageSchema = z
  .string()
  .refine(
    (v) =>
      !v ||
      v.startsWith("data:image/") ||
      /^https?:\/\//.test(v) ||
      /^\/(?!\/)/.test(v),
    "Use uma imagem válida (upload, HTTPS ou caminho local).",
  );

const brandingSchema = z.object({
  logoUrl: flexibleImageSchema.optional().nullable(),
  avatarUrl: flexibleImageSchema.optional().nullable(),
  coverUrl: flexibleImageSchema.optional().nullable(),
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

    // 1. Fetch current company & settings to track previous images
    const [currentCompany] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId));

    const settingsRows = await db
      .select()
      .from(companySettings)
      .where(eq(companySettings.companyId, companyId));

    const settingsMap = Object.fromEntries(
      settingsRows.map((s) => [s.key, s.value]),
    );

    // 2. Process dataUrls into secure filesystem files (stored as /uploads/branding/...)
    const storedLogoUrl = body.logoUrl
      ? await saveBrandingImage(body.logoUrl, currentCompany?.logoUrl)
      : null;
    const storedAvatarUrl = body.avatarUrl
      ? await saveBrandingImage(
          body.avatarUrl,
          settingsMap.avatar_url || settingsMap.avatarUrl,
        )
      : null;
    const storedCoverUrl = body.coverUrl
      ? await saveBrandingImage(
          body.coverUrl,
          settingsMap.cover_url || settingsMap.coverUrl,
        )
      : null;

    await db.transaction(async (tx) => {
      // 3. Update company record
      await tx
        .update(companies)
        .set({
          logoUrl: storedLogoUrl,
          publicColor: body.primaryColor,
          primaryColor: body.primaryColor,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId));

      // 4. Helper to upsert company_settings
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
              .set({ value, updatedAt: new Date() })
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

      // Store both snake_case (canonical) and camelCase for full compatibility
      await upsertSetting("avatar_url", storedAvatarUrl);
      await upsertSetting("avatarUrl", storedAvatarUrl);
      await upsertSetting("cover_url", storedCoverUrl);
      await upsertSetting("coverUrl", storedCoverUrl);
      await upsertSetting("cover_position", body.coverPosition || "center");
      await upsertSetting("coverPosition", body.coverPosition || "center");
      await upsertSetting("booking_theme_mode", body.bookingThemeMode || "auto");
      await upsertSetting("bookingThemeMode", body.bookingThemeMode || "auto");

      // 5. Log audit event
      await tx.insert(auditLogs).values({
        companyId,
        userId,
        action: "branding.updated",
        entity: "company",
        entityId: companyId,
        metadata: {
          primaryColor: body.primaryColor,
          bookingThemeMode: body.bookingThemeMode,
          hasLogo: Boolean(storedLogoUrl),
          hasCover: Boolean(storedCoverUrl),
        },
      });
    });

    return Response.json({
      data: {
        ok: true,
        logoUrl: storedLogoUrl,
        avatarUrl: storedAvatarUrl,
        coverUrl: storedCoverUrl,
        primaryColor: body.primaryColor,
        bookingThemeMode: body.bookingThemeMode,
      },
    });
  } catch (error) {
    return bookingError(error);
  }
}
