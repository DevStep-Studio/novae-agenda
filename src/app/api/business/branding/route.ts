import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, companies, companySettings } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { bookingError, sameOrigin } from "@/lib/booking/errors";
import { isValidHexColor } from "@/lib/branding";
import {
  COPY_OVERRIDE_KEYS,
  parseCopyOverrides,
  parseSectionsConfig,
  parsePromoBanners,
  SECTION_IDS,
} from "@/lib/booking/customization";
import { DEFAULT_FONT_PACK, FONT_PACK_IDS } from "@/lib/booking/fonts";
import { saveBrandingImage, saveBrandingMedia } from "@/lib/storage";

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
      primaryColor: company.publicColor || company.primaryColor || "#3b82f6",
      bookingThemeMode: (settingsMap.booking_theme_mode || settingsMap.bookingThemeMode || "auto") as "auto" | "light" | "dark",
      bookingFontFamily: settingsMap.booking_font_family || settingsMap.bookingFontFamily || DEFAULT_FONT_PACK,
      bookingCopyOverrides: parseCopyOverrides(
        settingsMap.booking_copy_overrides || settingsMap.bookingCopyOverrides,
      ),
      bookingSectionsConfig: parseSectionsConfig(
        settingsMap.booking_sections_config || settingsMap.bookingSectionsConfig,
      ),
      bookingPromoBanners: parsePromoBanners(
        settingsMap.booking_promo_banners || settingsMap.bookingPromoBanners,
      ),
      businessType: company.businessType,
      publicDescription: company.publicDescription,
      address: company.address || null,
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

const flexibleMediaSchema = z
  .string()
  .refine(
    (v) =>
      !v ||
      v.startsWith("data:image/") ||
      v.startsWith("data:video/") ||
      /^https?:\/\//.test(v) ||
      /^\/(?!\/)/.test(v),
    "Use uma mídia válida (imagem, vídeo ou URL).",
  );

const promoBannerItemSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["image", "video"]).default("image"),
  url: flexibleMediaSchema,
  title: z.string().max(80).optional().nullable(),
  subtitle: z.string().max(140).optional().nullable(),
  badge: z.string().max(30).optional().nullable(),
  linkUrl: z.string().max(300).optional().nullable(),
  buttonText: z.string().max(40).optional().nullable(),
});

const brandingSchema = z.object({
  logoUrl: flexibleImageSchema.optional().nullable(),
  avatarUrl: flexibleImageSchema.optional().nullable(),
  coverUrl: flexibleImageSchema.optional().nullable(),
  coverPosition: z.enum(["center", "top", "bottom"]).default("center"),
  primaryColor: z
    .string()
    .refine(isValidHexColor, "Informe uma cor hexadecimal válida (ex: #3B82F6)"),
  bookingThemeMode: z.enum(["auto", "light", "dark"]).default("auto"),
  bookingFontFamily: z
    .enum(FONT_PACK_IDS as [string, ...string[]])
    .default(DEFAULT_FONT_PACK),
  bookingCopyOverrides: z
    .object(
      Object.fromEntries(
        COPY_OVERRIDE_KEYS.map((key) => [key, z.string().max(200).optional()]),
      ) as Record<(typeof COPY_OVERRIDE_KEYS)[number], z.ZodOptional<z.ZodString>>,
    )
    .partial()
    .default({}),
  bookingSectionsConfig: z
    .array(
      z.object({
        id: z.enum(SECTION_IDS as [string, ...string[]]),
        visible: z.boolean(),
      }),
    )
    .default([]),
  bookingPromoBanners: z
    .object({
      enabled: z.boolean().default(false),
      items: z.array(promoBannerItemSchema).max(3).default([]),
    })
    .optional()
    .default({ enabled: false, items: [] }),
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

    // Never trust the client payload blindly for structured config — repair
    // it the same way it will be read back (drops unknown ids, fills in any
    // missing ones, trims/caps copy strings) so a malformed request can never
    // corrupt the live public page.
    const normalizedCopyOverrides = parseCopyOverrides(body.bookingCopyOverrides);
    const normalizedSectionsConfig = parseSectionsConfig(body.bookingSectionsConfig);
    const normalizedPromoBanners = parsePromoBanners(body.bookingPromoBanners);

    const savedPromoItems = await Promise.all(
      normalizedPromoBanners.items.map(async (item) => {
        let finalUrl = item.url;
        if (finalUrl.startsWith("data:")) {
          finalUrl = await saveBrandingMedia(finalUrl);
        }
        return {
          ...item,
          url: finalUrl,
        };
      }),
    );

    const effectivePromoBanners = {
      enabled: Boolean(normalizedPromoBanners.enabled && savedPromoItems.length > 0),
      items: savedPromoItems,
    };

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
      await upsertSetting("booking_font_family", body.bookingFontFamily || DEFAULT_FONT_PACK);
      await upsertSetting("bookingFontFamily", body.bookingFontFamily || DEFAULT_FONT_PACK);
      const copyOverridesJson = JSON.stringify(normalizedCopyOverrides);
      await upsertSetting("booking_copy_overrides", copyOverridesJson);
      await upsertSetting("bookingCopyOverrides", copyOverridesJson);
      const sectionsConfigJson = JSON.stringify(normalizedSectionsConfig);
      await upsertSetting("booking_sections_config", sectionsConfigJson);
      await upsertSetting("bookingSectionsConfig", sectionsConfigJson);
      const promoBannersJson = JSON.stringify(effectivePromoBanners);
      await upsertSetting("booking_promo_banners", promoBannersJson);
      await upsertSetting("bookingPromoBanners", promoBannersJson);

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
          bookingFontFamily: body.bookingFontFamily,
          hasLogo: Boolean(storedLogoUrl),
          hasCover: Boolean(storedCoverUrl),
          hasPromoBanners: Boolean(effectivePromoBanners.enabled),
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
        bookingFontFamily: body.bookingFontFamily,
        bookingCopyOverrides: normalizedCopyOverrides,
        bookingSectionsConfig: normalizedSectionsConfig,
        bookingPromoBanners: effectivePromoBanners,
      },
    });
  } catch (error) {
    return bookingError(error);
  }
}
