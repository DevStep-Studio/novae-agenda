import { db } from "@/db";
import { saasPlans } from "@/db/schema";
import { seedSaasPlans } from "@/lib/saas/plans-seed";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let plans = await db
      .select()
      .from(saasPlans)
      .where(eq(saasPlans.isActive, true))
      .orderBy(asc(saasPlans.sortOrder));

    if (plans.length === 0) {
      await seedSaasPlans(db);
      plans = await db
        .select()
        .from(saasPlans)
        .where(eq(saasPlans.isActive, true))
        .orderBy(asc(saasPlans.sortOrder));
    }

    const data = plans.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      monthlyPrice: Number(p.monthlyPrice),
      annualPrice: Number(p.annualPrice),
      employeeLimit: p.employeeLimit,
      badge: p.badge,
      sortOrder: p.sortOrder,
    }));

    return Response.json({ data });
  } catch (error) {
    console.error("[SaaS Plans API] Error fetching plans:", error);
    return Response.json({ error: "Erro ao buscar planos." }, { status: 500 });
  }
}
