import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { getSession } from "@/lib/auth";
import type { SessionInfo } from "@/shared/types";

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

  const session: SessionInfo = {
    userId: user.userId,
    companyId: user.companyId,
    role: user.role,
    name: user.name,
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
      : null as unknown as SessionInfo["company"],
  };

  return Response.json({ data: session });
}
