import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, companies, users } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { getRawCompanySetting, setRawCompanySetting } from "@/lib/settings";
import { saveBrandingImage, saveClientImage } from "@/lib/storage";

export const dynamic = "force-dynamic";

const profilePatchSchema = z.object({
  name: z.string().min(2, "Nome muito curto.").max(120).optional(),
  phone: z.string().max(30).optional().nullable(),
  companyName: z.string().min(2, "Nome da empresa deve ter pelo menos 2 caracteres.").max(120).optional(),
  businessType: z.string().max(100).optional().nullable(),
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
      avatarUrl: users.avatarUrl,
      bannerUrl: users.bannerUrl,
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
        businessType: companies.businessType,
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
      avatarUrl: userRow.avatarUrl ?? companyRow?.logoUrl ?? null,
      bannerUrl: userRow.bannerUrl ?? bannerUrl ?? null,
      primaryColor: companyRow?.primaryColor ?? "#3b82f6",
      secondaryColor: companyRow?.secondaryColor ?? "#18181b",
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

  const { name, phone, companyName, businessType, avatarUrl, bannerUrl, primaryColor, secondaryColor, dashboardPreferences } = parsed.data;

  const [currentUser] = await db
    .select({
      avatarUrl: users.avatarUrl,
      bannerUrl: users.bannerUrl,
      phone: users.phone,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, auth.user.userId))
    .limit(1);

  let savedAvatarUrl: string | null | undefined = undefined;
  let savedBannerUrl: string | null | undefined = undefined;

  if (avatarUrl !== undefined) {
    savedAvatarUrl = avatarUrl ? await saveClientImage(avatarUrl, currentUser?.avatarUrl) : null;
  }
  if (bannerUrl !== undefined) {
    savedBannerUrl = bannerUrl ? await saveBrandingImage(bannerUrl, currentUser?.bannerUrl) : null;
  }

  // 1. Update user row if name, phone, avatarUrl or bannerUrl given
  const userPatch: Record<string, unknown> = {};
  if (name !== undefined) userPatch.name = name.trim();
  if (phone !== undefined) userPatch.phone = phone ? phone.trim() : null;
  if (savedAvatarUrl !== undefined) userPatch.avatarUrl = savedAvatarUrl;
  if (savedBannerUrl !== undefined) userPatch.bannerUrl = savedBannerUrl;

  if (Object.keys(userPatch).length > 0) {
    userPatch.updatedAt = new Date();
    await db.update(users).set(userPatch).where(eq(users.id, auth.user.userId));
  }

  // Also update client records linked to this user (so owner screen displays updated photo, name and phone)
  if (name !== undefined || phone !== undefined || savedAvatarUrl !== undefined) {
    const clientPatch: Record<string, unknown> = {};
    if (name !== undefined) clientPatch.name = name.trim();
    if (phone !== undefined) clientPatch.phone = phone ? phone.trim() : "";
    if (savedAvatarUrl !== undefined) clientPatch.photoUrl = savedAvatarUrl;
    clientPatch.updatedAt = new Date();

    // 1. Update directly by userId
    await db.update(clients).set(clientPatch).where(eq(clients.userId, auth.user.userId));

    // 2. Also match CRM client records by phone or email to update their photo, name and phone
    const cleanDigits = (phone || currentUser?.phone || auth.user.phone || "").replace(/\D/g, "");
    const userEmail = (auth.user.email || "").toLowerCase();

    const existingClients = await db
      .select({
        id: clients.id,
        companyId: clients.companyId,
        phone: clients.phone,
        email: clients.email,
        userId: clients.userId,
      })
      .from(clients);

    for (const c of existingClients) {
      if (c.userId === auth.user.userId) continue;

      const cDigits = (c.phone || "").replace(/\D/g, "");
      const matchesPhone = cleanDigits && cDigits && (cDigits === cleanDigits || (cleanDigits.length >= 8 && cDigits.endsWith(cleanDigits.slice(-8))));
      const matchesEmail = userEmail && c.email && c.email.toLowerCase() === userEmail;

      if (matchesPhone || matchesEmail) {
        const recordPatch: Record<string, unknown> = { ...clientPatch };
        const companyHasUser = existingClients.some((other) => other.companyId === c.companyId && other.userId === auth.user.userId);
        if (!companyHasUser && !c.userId) {
          recordPatch.userId = auth.user.userId;
        }
        await db.update(clients).set(recordPatch).where(eq(clients.id, c.id));
      }
    }
  }

  // 2. Resolve or provision companyId if owner/admin
  let targetCompanyId = auth.user.companyId || null;

  if (!targetCompanyId) {
    const [userRow] = await db
      .select({ companyId: users.companyId, role: users.role, name: users.name })
      .from(users)
      .where(eq(users.id, auth.user.userId))
      .limit(1);

    if (userRow?.companyId) {
      targetCompanyId = userRow.companyId;
    } else if (auth.user.role === "owner" || auth.user.role === "admin") {
      // Auto-provision company for owner/admin if missing
      const newCompanyId = crypto.randomUUID();
      const initialCompanyName = companyName?.trim() || userRow?.name || "Meu Estabelecimento";
      await db.insert(companies).values({
        id: newCompanyId,
        name: initialCompanyName,
        businessType: businessType?.trim() || null,
        primaryColor: primaryColor || "#3b82f6",
        secondaryColor: secondaryColor || "#18181b",
        onboarded: true,
      });
      await db.update(users).set({ companyId: newCompanyId, updatedAt: new Date() }).where(eq(users.id, auth.user.userId));
      targetCompanyId = newCompanyId;
    }
  }

  // 3. Update company row and settings if targetCompanyId exists
  if (targetCompanyId) {
    const [currentCompany] = await db
      .select({ logoUrl: companies.logoUrl })
      .from(companies)
      .where(eq(companies.id, targetCompanyId))
      .limit(1);

    const currentBanner = await getRawCompanySetting(targetCompanyId, "banner_url");

    const companyPatch: Record<string, unknown> = {};

    if (companyName !== undefined && (auth.user.role === "owner" || auth.user.role === "admin")) {
      companyPatch.name = companyName.trim();
    }
    if (businessType !== undefined && (auth.user.role === "owner" || auth.user.role === "admin")) {
      companyPatch.businessType = businessType ? businessType.trim() : null;
    }
    if (avatarUrl !== undefined) {
      companyPatch.logoUrl = savedAvatarUrl;
    }
    if (primaryColor !== undefined) companyPatch.primaryColor = primaryColor;
    if (secondaryColor !== undefined) companyPatch.secondaryColor = secondaryColor;

    if (Object.keys(companyPatch).length > 0) {
      companyPatch.updatedAt = new Date();
      await db
        .update(companies)
        .set(companyPatch)
        .where(eq(companies.id, targetCompanyId));
    }

    // Update raw settings (banner, cover, avatar and dashboard preferences)
    if (savedBannerUrl !== undefined) {
      await setRawCompanySetting(targetCompanyId, "banner_url", savedBannerUrl ?? "");
      await setRawCompanySetting(targetCompanyId, "cover_url", savedBannerUrl ?? "");
    }
    if (savedAvatarUrl !== undefined) {
      await setRawCompanySetting(targetCompanyId, "avatar_url", savedAvatarUrl ?? "");
    }
    if (dashboardPreferences !== undefined) {
      await setRawCompanySetting(
        targetCompanyId,
        "dashboard_preferences",
        JSON.stringify(dashboardPreferences),
      );
    }
  }

  return Response.json({
    data: {
      ok: true,
      name: name ?? auth.user.name,
      companyName,
      businessType,
      avatarUrl: savedAvatarUrl !== undefined ? savedAvatarUrl : avatarUrl,
      bannerUrl: savedBannerUrl !== undefined ? (savedBannerUrl || null) : (bannerUrl || null),
      primaryColor,
      dashboardPreferences,
    },
  });
}
