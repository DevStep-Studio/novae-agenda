import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { listMembershipPlans } from "@/lib/membership/membership-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  props: { params: Promise<{ slug: string }> },
) {
  const { slug } = await props.params;

  const [company] = await db
    .select({ id: companies.id, publicEnabled: companies.publicEnabled })
    .from(companies)
    .where(eq(companies.publicSlug, slug));

  if (!company || !company.publicEnabled) {
    return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  const plans = await listMembershipPlans(company.id, false);
  return Response.json({ data: plans });
}
