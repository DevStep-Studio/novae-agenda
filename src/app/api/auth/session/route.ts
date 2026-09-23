import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, companySettings, locations, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import type { LocationDTO, SessionInfo } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) {
    return Response.json({ data: null }, { status: 200 });
  }

  const [company] = user.companyId
    ? await db
        .select()
        .from(companies)
        .where(eq(companies.id, user.companyId))
        .limit(1)
    : [];

  let bannerUrl: string | null = null;
  let dashboardPreferences: Record<string, boolean> | undefined = undefined;

  if (user.companyId) {
    const [bannerRow] = await db
      .select({ value: companySettings.value })
      .from(companySettings)
      .where(and(eq(companySettings.companyId, user.companyId), eq(companySettings.key, "banner_url")))
      .limit(1);
    if (bannerRow?.value) bannerUrl = bannerRow.value;

    const [dashRow] = await db
      .select({ value: companySettings.value })
      .from(companySettings)
      .where(and(eq(companySettings.companyId, user.companyId), eq(companySettings.key, "dashboard_preferences")))
      .limit(1);
    if (dashRow?.value) {
      try {
        dashboardPreferences = JSON.parse(dashRow.value);
      } catch {}
    }
  }

  const [row] = await db
    .select({
      createdAt: users.createdAt,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      bannerUrl: users.bannerUrl,
    })
    .from(users)
    .where(eq(users.id, user.userId))
    .limit(1);

  let locationRows: Array<{
    id: string;
    companyId: string;
    name: string;
    address: string | null;
    phone: string | null;
    openTime: string;
    closeTime: string;
    active: boolean;
  }> = [];

  if (user.companyId) {
    locationRows = await db
      .select({
        id: locations.id,
        companyId: locations.companyId,
        name: locations.name,
        address: locations.address,
        phone: locations.phone,
        openTime: locations.openTime,
        closeTime: locations.closeTime,
        active: locations.active,
      })
      .from(locations)
      .where(and(eq(locations.companyId, user.companyId), eq(locations.active, true)))
      .orderBy(asc(locations.name));

    // If company has no locations yet, ensure the default location exists
    if (locationRows.length === 0 && company) {
      const locId = crypto.randomUUID();
      const locName = "Unidade Principal";
      const locAddress = company.address ?? "Sede";
      const locPhone = company.phone ?? null;
      const openTime = "08:00";
      const closeTime = "19:00";

      await db
        .insert(locations)
        .values({
          id: locId,
          companyId: user.companyId,
          name: locName,
          address: locAddress,
          phone: locPhone,
          openTime,
          closeTime,
          active: true,
        });

      locationRows = [{
        id: locId,
        companyId: user.companyId,
        name: locName,
        address: locAddress,
        phone: locPhone,
        openTime,
        closeTime,
        active: true,
      }];
    }
  }

  const locationDTOs: LocationDTO[] = locationRows.map((loc) => ({
    id: loc.id,
    companyId: loc.companyId,
    name: loc.name,
    address: loc.address,
    phone: loc.phone,
    openTime: loc.openTime.slice(0, 5),
    closeTime: loc.closeTime.slice(0, 5),
    active: loc.active,
  }));

  const session: SessionInfo = {
    userId: user.userId,
    companyId: user.companyId ?? "",
    role: user.role,
    primaryRole: user.primaryRole,
    targetPortal: user.targetPortal,
    name: user.name,
    email: user.email,
    phone: row?.phone ?? user.phone ?? null,
    avatarUrl: row?.avatarUrl ?? company?.logoUrl ?? null,
    bannerUrl: row?.bannerUrl ?? bannerUrl ?? null,
    emailVerified: user.emailVerified,
    isSuperadmin: user.isSuperadmin,
    createdAt: (row?.createdAt ?? new Date()).toISOString(),
    employeeId: user.employeeId,
    memberships: user.memberships ?? [],
    company: company
      ? {
          id: company.id,
          name: company.name,
          businessType: company.businessType,
          phone: company.phone,
          whatsapp: company.whatsapp,
          email: company.email,
          address: company.address,
          instagram: company.instagram,
          website: company.website,
          timezone: company.timezone,
          currency: company.currency,
          primaryColor: company.primaryColor,
          secondaryColor: company.secondaryColor,
          logoUrl: company.logoUrl ?? row?.avatarUrl ?? null,
          bannerUrl: bannerUrl ?? row?.bannerUrl ?? null,
          publicSlug: company.publicSlug ?? null,
          slug: company.publicSlug ?? null,
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
          onboarded: company.onboarded,
        }
      : {
          id: "",
          name: "Portal do Cliente",
          businessType: null,
          phone: null,
          whatsapp: null,
          email: null,
          address: null,
          instagram: null,
          website: null,
          timezone: "America/Sao_Paulo",
          currency: "BRL",
          primaryColor: "#3b82f6",
          secondaryColor: "#18181b",
          logoUrl: null,
          bannerUrl: null,
          dashboardPreferences: {
            showBanner: true,
            showChecklist: true,
            showKpis: true,
            showSubmetrics: true,
            showNextAppointment: true,
            showDaySummary: true,
            showQuickSlots: true,
            showTodayAppointments: true,
          },
          onboarded: true,
        },
    locations: locationDTOs,
  };

  return Response.json({ data: session }, { status: 200 });
}
