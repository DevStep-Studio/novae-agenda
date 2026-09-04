import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, locations, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import type { LocationDTO, SessionInfo } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) {
    return Response.json({ data: null }, { status: 200 });
  }

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, user.companyId))
    .limit(1);

  const [row] = await db
    .select({ createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, user.userId))
    .limit(1);

  let locationRows = await db
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
    const [defaultLoc] = await db
      .insert(locations)
      .values({
        companyId: user.companyId,
        name: "Unidade Principal",
        address: company.address ?? "Sede",
        phone: company.phone ?? null,
        openTime: "08:00",
        closeTime: "19:00",
        active: true,
      })
      .returning();

    locationRows = [{
      id: defaultLoc.id,
      companyId: defaultLoc.companyId,
      name: defaultLoc.name,
      address: defaultLoc.address,
      phone: defaultLoc.phone,
      openTime: defaultLoc.openTime,
      closeTime: defaultLoc.closeTime,
      active: defaultLoc.active,
    }];
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
    companyId: user.companyId,
    role: user.role,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    isSuperadmin: user.isSuperadmin,
    createdAt: (row?.createdAt ?? new Date()).toISOString(),
    employeeId: user.employeeId,
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
          onboarded: company.onboarded,
        }
      : (null as unknown as SessionInfo["company"]),
    locations: locationDTOs,
  };

  return Response.json({ data: session });
}
