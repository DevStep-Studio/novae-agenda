import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const list = await db
    .select({
      id: companies.id,
      name: companies.name,
      businessType: companies.businessType,
      logoUrl: companies.logoUrl,
      publicSlug: companies.publicSlug,
      address: companies.address,
      phone: companies.phone,
      primaryColor: companies.primaryColor,
    })
    .from(companies)
    .where(isNotNull(companies.publicSlug))
    .orderBy(asc(companies.name));

  return Response.json({ data: list }, { status: 200 });
}
