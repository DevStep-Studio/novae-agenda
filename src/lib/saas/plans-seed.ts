import { db } from "@/db";
import { saasPlans } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface DefaultSaasPlan {
  slug: string;
  name: string;
  description: string;
  monthlyPrice: string;
  annualPrice: string;
  employeeLimit: number;
  badge?: string;
  sortOrder: number;
  isActive: boolean;
}

export const DEFAULT_SAAS_PLANS: DefaultSaasPlan[] = [
  {
    slug: "essencial",
    name: "Essencial",
    description: "Para profissionais e pequenos negócios que estão começando.",
    monthlyPrice: "19.90",
    annualPrice: "199.00",
    employeeLimit: 2,
    sortOrder: 1,
    isActive: true,
  },
  {
    slug: "profissional",
    name: "Profissional",
    description: "Ideal para equipes em crescimento que buscam organização e controle.",
    monthlyPrice: "39.90",
    annualPrice: "399.00",
    employeeLimit: 5,
    badge: "Mais escolhido",
    sortOrder: 2,
    isActive: true,
  },
  {
    slug: "equipe",
    name: "Equipe",
    description: "Perfeito para negócios consolidados com múltiplos profissionais.",
    monthlyPrice: "69.90",
    annualPrice: "699.00",
    employeeLimit: 10,
    sortOrder: 3,
    isActive: true,
  },
  {
    slug: "negocio",
    name: "Negócio",
    description: "Estrutura robusta para clínicas, estúdios e barbearias de alto fluxo.",
    monthlyPrice: "119.90",
    annualPrice: "1199.00",
    employeeLimit: 20,
    sortOrder: 4,
    isActive: true,
  },
  {
    slug: "empresa",
    name: "Empresa",
    description: "Para grandes estabelecimentos com ampla equipe e múltiplos serviços.",
    monthlyPrice: "229.90",
    annualPrice: "2299.00",
    employeeLimit: 50,
    sortOrder: 5,
    isActive: true,
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    description: "Escala máxima e suporte personalizado para redes e grandes operações.",
    monthlyPrice: "399.90",
    annualPrice: "3999.00",
    employeeLimit: 100,
    sortOrder: 6,
    isActive: true,
  },
];

/**
 * Idempotently seeds the 6 SaaS plans into the database.
 */
export async function seedSaasPlans(executor: any = db) {
  for (const plan of DEFAULT_SAAS_PLANS) {
    const [existing] = await executor
      .select()
      .from(saasPlans)
      .where(eq(saasPlans.slug, plan.slug))
      .limit(1);

    if (!existing) {
      await executor.insert(saasPlans).values({
        id: crypto.randomUUID(),
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
        employeeLimit: plan.employeeLimit,
        badge: plan.badge ?? null,
        sortOrder: plan.sortOrder,
        isActive: plan.isActive,
      });
    } else {
      await executor
        .update(saasPlans)
        .set({
          name: plan.name,
          description: plan.description,
          monthlyPrice: plan.monthlyPrice,
          annualPrice: plan.annualPrice,
          employeeLimit: plan.employeeLimit,
          badge: plan.badge ?? null,
          sortOrder: plan.sortOrder,
          isActive: plan.isActive,
        })
        .where(eq(saasPlans.id, existing.id));
    }
  }
}
