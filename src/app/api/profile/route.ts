import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies, companySettings, users } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { getRawCompanySetting, setRawCompanySetting } from "@/lib/settings";
import { saveBrandingImage } from "@/lib/storage";

export const dynamic = "force-dynamic";

const profilePatchSchema = z.object({
  name: z.string().min(2, "Nome muito curto.").max(120).optional(),
  phone: z.string().max(30).optional(),
  avatarUrl: z.string().max(8_000_000).optional().nullable(),
  bannerUrl: z.string().max(8_000_000).optional().nullable(),
  primaryColor: z.string().max(30).optional(),
  secondaryColor: z.string().max(30).optional(),
  dashboardPreferences: z.record(z.string(), z.boolean()).optional(),
});

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const [userRow] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      companyId: users.companyId,
    })
    .from(users)
    .where(eq(users.id, auth.user.userId))
    .limit(1);

  if (!userRow) return unauthorized();

  let companyRow = null;
  let bannerUrl = null;
  let dashboardPreferences = null;

  if (userRow.companyId) {
    [companyRow] = await db
      .select({
        id: companies.id,
        name: companies.name,
        logoUrl: companies.logoUrl,
        primaryColor: companies.primaryColor,
        secondaryColor: companies.secondaryColor,
      })
      .from(companies)
      .where(eq(companies.id, userRow.companyId))
      .limit(1);

    const [bannerVal, dashVal] = await Promise.all([
      getRawCompanySetting(userRow.companyId, "banner_url"),
      getRawCompanySetting(userRow.companyId, "dashboard_preferences"),
    ]);

    bannerUrl = bannerVal;
    if (dashVal) {
      try {
        dashboardPreferences = JSON.parse(dashVal);
      } catch {}
    }
  }

  return Response.json({
    data: {
      user: userRow,
      company: companyRow,
      avatarUrl: companyRow?.logoUrl ?? null,
      bannerUrl,
      primaryColor: companyRow?.primaryColor ?? "#dcff4c",
      secondaryColor: companyRow?.secondaryColor ?? "#162a22",
      dashboardPreferences: dashboardPreferences ?? {
        showBanner: true,
        showChecklist: true,
        showKpis: true,
        showSubmetrics: true,
        showNextAppointment: true,
        showDaySummary: true,
        showQuickSlots: true,
        showTodayAppointments: true,
      },
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = profilePatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const { name, phone, avatarUrl, bannerUrl, primaryColor, secondaryColor, dashboardPreferences } = parsed.data;

  // 1. Update user row if name or phone given
  const userPatch: Record<string, unknown> = {};
  if (name !== undefined) userPatch.name = name.trim();
  if (phone !== undefined) userPatch.phone = phone.trim() || null;
  if (Object.keys(userPatch).length > 0) {
    await db.update(users).set(userPatch).where(eq(users.id, auth.user.userId));
  }

  // 2. Update company row and settings if avatarUrl, bannerUrl, primaryColor or secondaryColor given
  let savedAvatarUrl: string | null | undefined = undefined;
  let savedBannerUrl: string | null | undefined = undefined;

  if (auth.user.companyId) {
    const companyPatch: Record<string, unknown> = {};

    if (avatarUrl !== undefined) {
      savedAvatarUrl = avatarUrl ? await saveBrandingImage(avatarUrl) : null;
      companyPatch.logoUrl = savedAvatarUrl;
    }
    if (primaryColor !== undefined) companyPatch.primaryColor = primaryColor;
    if (secondaryColor !== undefined) companyPatch.secondaryColor = secondaryColor;

    if (Object.keys(companyPatch).length > 0) {
      await db
        .update(companies)
        .set(companyPatch)
        .where(eq(companies.id, auth.user.companyId));
    }

    // 3. Update raw settings (banner, cover, avatar and dashboard preferences)
    if (bannerUrl !== undefined) {
      savedBannerUrl = bannerUrl ? await saveBrandingImage(bannerUrl) : "";
      await setRawCompanySetting(auth.user.companyId, "banner_url", savedBannerUrl);
      await setRawCompanySetting(auth.user.companyId, "cover_url", savedBannerUrl);
    }
    if (savedAvatarUrl !== undefined) {
      await setRawCompanySetting(auth.user.companyId, "avatar_url", savedAvatarUrl ?? "");
    }
    if (dashboardPreferences !== undefined) {
      await setRawCompanySetting(
        auth.user.companyId,
        "dashboard_preferences",
        JSON.stringify(dashboardPreferences),
      );
    }
  }

  return Response.json({
    data: {
      ok: true,
      name: name ?? auth.user.name,
      avatarUrl: savedAvatarUrl !== undefined ? savedAvatarUrl : avatarUrl,
      bannerUrl: savedBannerUrl !== undefined ? savedBannerUrl : bannerUrl,
      primaryColor,
      dashboardPreferences,
    },
  });
}
