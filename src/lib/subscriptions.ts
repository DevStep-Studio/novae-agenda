import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, subscriptions, subscriptionInvoices } from "@/db/schema";
import { DEFAULT_SAAS_PLANS } from "./saas/plans-seed";

export type PlanKey =
  | "trial"
  | "essencial"
  | "profissional"
  | "equipe"
  | "negocio"
  | "empresa"
  | "enterprise"
  | "pro_monthly"
  | "pro_yearly";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired"
  | "suspended"
  | "pending"
  | "payment_failed";

export type PlanDetails = {
  key: string;
  name: string;
  price: number;
  annualPrice?: number;
  employeeLimit: number;
  interval: "mês" | "ano" | "teste";
  description: string;
  badge?: string;
  features: string[];
};

export const PLANS: Record<string, PlanDetails> = {
  trial: {
    key: "trial",
    name: "Teste Gratuito",
    price: 0,
    employeeLimit: 5,
    interval: "teste",
    description: "7 dias de acesso total sem compromisso.",
    features: [
      "Proprietário incluído",
      "Até 5 funcionários no teste",
      "Agendamentos ilimitados",
      "Clientes ilimitados",
      "Link público com QR Code",
    ],
  },
  essencial: {
    key: "essencial",
    name: "Essencial",
    price: 19.90,
    annualPrice: 199.00,
    employeeLimit: 2,
    interval: "mês",
    description: "Para profissionais autônomos e pequenos negócios que estão começando.",
    features: [
      "Proprietário incluído",
      "Até 2 funcionários",
      "Clientes ilimitados",
      "Agendamentos ilimitados",
      "Página pública de reservas",
      "Agenda e notificações",
      "Gestão de clientes",
    ],
  },
  profissional: {
    key: "profissional",
    name: "Profissional",
    price: 39.90,
    annualPrice: 399.00,
    employeeLimit: 5,
    badge: "Mais escolhido",
    interval: "mês",
    description: "Ideal para equipes em crescimento que buscam organização e controle.",
    features: [
      "Proprietário incluído",
      "Até 5 funcionários",
      "Clientes ilimitados",
      "Agendamentos ilimitados",
      "Página pública de reservas",
      "Agenda e notificações",
      "Gestão de clientes",
      "Relatórios e comissões",
    ],
  },
  equipe: {
    key: "equipe",
    name: "Equipe",
    price: 69.90,
    annualPrice: 699.00,
    employeeLimit: 10,
    interval: "mês",
    description: "Perfeito para negócios consolidados com múltiplos profissionais.",
    features: [
      "Proprietário incluído",
      "Até 10 funcionários",
      "Clientes ilimitados",
      "Agendamentos ilimitados",
      "Página pública de reservas",
      "Agenda e notificações",
      "Gestão completa de equipe",
      "Relatórios avançados",
    ],
  },
  negocio: {
    key: "negocio",
    name: "Negócio",
    price: 119.90,
    annualPrice: 1199.00,
    employeeLimit: 20,
    interval: "mês",
    description: "Estrutura robusta para clínicas, estúdios e barbearias de alto fluxo.",
    features: [
      "Proprietário incluído",
      "Até 20 funcionários",
      "Clientes ilimitados",
      "Agendamentos ilimitados",
      "Página pública de reservas",
      "Gestão avançada de serviços",
      "Suporte prioritário",
    ],
  },
  empresa: {
    key: "empresa",
    name: "Empresa",
    price: 229.90,
    annualPrice: 2299.00,
    employeeLimit: 50,
    interval: "mês",
    description: "Para grandes estabelecimentos com ampla equipe e múltiplos serviços.",
    features: [
      "Proprietário incluído",
      "Até 50 funcionários",
      "Clientes ilimitados",
      "Agendamentos ilimitados",
      "Página pública de reservas",
      "Gestão completa de equipe",
      "Suporte dedicado",
    ],
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    price: 399.90,
    annualPrice: 3999.00,
    employeeLimit: 100,
    interval: "mês",
    description: "Escala máxima e suporte personalizado para redes e grandes operações.",
    features: [
      "Proprietário incluído",
      "Até 100 funcionários",
      "Clientes ilimitados",
      "Agendamentos ilimitados",
      "Página pública de reservas",
      "Acompanhamento dedicado",
      "SLA personalizado",
    ],
  },
  pro_monthly: {
    key: "pro_monthly",
    name: "Profissional",
    price: 39.90,
    annualPrice: 399.00,
    employeeLimit: 5,
    interval: "mês",
    description: "Ideal para equipes em crescimento.",
    features: [
      "Proprietário incluído",
      "Até 5 funcionários",
      "Clientes e agendamentos ilimitados",
    ],
  },
  pro_yearly: {
    key: "pro_yearly",
    name: "Profissional Anual",
    price: 399.00,
    employeeLimit: 5,
    interval: "ano",
    badge: "Economia Anual",
    description: "Plano anual com desconto.",
    features: [
      "Proprietário incluído",
      "Até 5 funcionários",
      "Clientes e agendamentos ilimitados",
    ],
  },
};

export type SubscriptionDTO = {
  id: string;
  companyId: string;
  plan: string;
  status: SubscriptionStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  daysRemaining: number;
  isEffectiveActive: boolean;
};

/**
 * Retrieves the current subscription for a company.
 * If no subscription exists, automatically provisions a 7-day trial.
 */
export async function getCompanySubscription(
  companyId: string,
  executor: import("@/lib/availability").DbExecutor = db,
  serverNow = new Date(),
): Promise<SubscriptionDTO> {
  const [existing] = await executor
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.companyId, companyId))
    .limit(1);

  const now = serverNow;

  if (!existing) {
    const id = crypto.randomUUID();
    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await executor.insert(subscriptions).values({
      id,
      companyId,
      plan: "trial",
      status: "trialing",
      trialStartedAt: now,
      trialEndsAt,
    });

    const diffDays = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      id,
      companyId,
      plan: "trial",
      status: "trialing",
      trialStartedAt: now.toISOString(),
      trialEndsAt: trialEndsAt.toISOString(),
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      daysRemaining: diffDays,
      isEffectiveActive: true,
    };
  }

  // Check if there are any paid invoices for this company
  const [paidInvoice] = await executor
    .select()
    .from(subscriptionInvoices)
    .where(
      and(
        eq(subscriptionInvoices.companyId, companyId),
        eq(subscriptionInvoices.status, "paid")
      )
    )
    .orderBy(desc(subscriptionInvoices.paidAt), desc(subscriptionInvoices.createdAt))
    .limit(1);

  // Normalize status
  const rawStatus = (existing.status || "trialing").toLowerCase().trim();
  const isPaidOrActiveRaw = ["active", "paid", "approved", "pago"].includes(rawStatus) || Boolean(paidInvoice);
  const isPaidPlan = Boolean(existing.plan && existing.plan !== "trial" && existing.plan !== "teste");

  let effectiveStatus: SubscriptionStatus = existing.status as SubscriptionStatus;
  let isEffectiveActive = false;
  const trialStartedAt = existing.trialStartedAt
    ?? new Date(existing.trialEndsAt.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (isPaidOrActiveRaw) {
    if (existing.currentPeriodEnd && existing.currentPeriodEnd.getTime() <= now.getTime()) {
      effectiveStatus = "past_due";
      isEffectiveActive = false;
    } else {
      effectiveStatus = "active";
      isEffectiveActive = true;
    }
  } else if (rawStatus === "trialing") {
    if (existing.trialEndsAt.getTime() <= now.getTime()) {
      effectiveStatus = "expired";
      isEffectiveActive = false;
      await executor
        .update(subscriptions)
        .set({ status: "expired", updatedAt: now })
        .where(eq(subscriptions.id, existing.id));
    } else {
      effectiveStatus = "trialing";
      isEffectiveActive = true;
    }
  } else if (["pending", "payment_failed"].includes(rawStatus) && existing.trialEndsAt.getTime() > now.getTime() && !isPaidPlan) {
    // A cobrança pode estar pendente sem encerrar antecipadamente um trial ainda válido.
    effectiveStatus = "trialing";
    isEffectiveActive = true;
  } else {
    effectiveStatus = (["past_due", "cancelled", "expired", "suspended"].includes(rawStatus) ? rawStatus : "expired") as SubscriptionStatus;
    isEffectiveActive = false;
  }

  const targetDate =
    effectiveStatus === "trialing"
      ? existing.trialEndsAt
      : (existing.currentPeriodEnd ?? existing.trialEndsAt);
  const diffDays = isEffectiveActive
    ? Math.max(0, Math.ceil((new Date(targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const resolvedPlan = isPaidOrActiveRaw && (existing.plan === "trial" || !existing.plan)
    ? (paidInvoice?.planSlug ?? "profissional")
    : (existing.plan ?? "profissional");

  return {
    id: existing.id,
    companyId: existing.companyId,
    plan: resolvedPlan,
    status: effectiveStatus,
    trialStartedAt: trialStartedAt.toISOString(),
    trialEndsAt: existing.trialEndsAt.toISOString(),
    currentPeriodEnd: existing.currentPeriodEnd ? existing.currentPeriodEnd.toISOString() : null,
    cancelAtPeriodEnd: existing.cancelAtPeriodEnd,
    daysRemaining: diffDays,
    isEffectiveActive,
  };
}

export async function provisionCompanyTrial(
  companyId: string,
  executor: import("@/lib/availability").DbExecutor = db,
  serverNow = new Date(),
): Promise<SubscriptionDTO> {
  return getCompanySubscription(companyId, executor, serverNow);
}

/**
 * Enforces active subscription check. Returns null if allowed, or error details if blocked.
 */
export async function assertSubscriptionActive(
  companyId: string,
  executor: import("@/lib/availability").DbExecutor = db
): Promise<{ ok: boolean; status: SubscriptionStatus; reason?: string }> {
  const sub = await getCompanySubscription(companyId, executor);
  if (!sub.isEffectiveActive) {
    const reason =
      sub.status === "expired"
        ? "Seu período de teste expirou. Escolha um plano para continuar utilizando a plataforma."
        : "Sua assinatura não está ativa. Atualize seus dados de pagamento para continuar.";
    return { ok: false, status: sub.status, reason };
  }
  return { ok: true, status: sub.status };
}
