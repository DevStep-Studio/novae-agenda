import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, subscriptions, subscriptionInvoices } from "@/db/schema";

export type PlanKey = "trial" | "pro_monthly" | "pro_yearly";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired";

export type PlanDetails = {
  key: PlanKey;
  name: string;
  price: number;
  interval: "mês" | "ano" | "teste";
  description: string;
  badge?: string;
  features: string[];
};

export const PLANS: Record<PlanKey, PlanDetails> = {
  trial: {
    key: "trial",
    name: "Teste Gratuito",
    price: 0,
    interval: "teste",
    description: "7 dias de acesso total sem compromisso.",
    features: [
      "Acesso completo a todas as funções",
      "Agendamentos ilimitados",
      "Agenda, equipe e clientes",
      "Link público com QR Code",
    ],
  },
  pro_monthly: {
    key: "pro_monthly",
    name: "Pro Mensal",
    price: 89.90,
    interval: "mês",
    description: "Ideal para estabilidade com cobrança mensal flexível.",
    features: [
      "Todos os recursos do Reservei",
      "Agendamentos e clientes ilimitados",
      "Gestão financeira e comissões da equipe",
      "CRM com histórico e notas internas",
      "Link e página pública personalizada com QR Code",
      "Suporte rápido",
    ],
  },
  pro_yearly: {
    key: "pro_yearly",
    name: "Pro Anual",
    price: 799.00,
    interval: "ano",
    badge: "Economize 26%",
    description: "Equivalente a R$ 66,58/mês. Máxima economia e tranquilidade.",
    features: [
      "Economia de mais de 25% em relação ao mensal",
      "Todos os recursos do plano Pro",
      "Agendamentos e clientes ilimitados",
      "Relatórios avançados de ocupação e faturamento",
      "Exportação completa de dados (CSV)",
      "Suporte prioritário direto",
    ],
  },
};

export type SubscriptionDTO = {
  id: string;
  companyId: string;
  plan: PlanKey;
  status: SubscriptionStatus;
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
export async function getCompanySubscription(companyId: string, executor: import("@/lib/availability").DbExecutor = db): Promise<SubscriptionDTO> {
  const [existing] = await executor
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.companyId, companyId))
    .limit(1);

  const now = new Date();

  if (!existing) {
    const id = crypto.randomUUID();
    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await executor
      .insert(subscriptions)
      .values({
        id,
        companyId,
        plan: "trial",
        status: "trialing",
        trialEndsAt,
      });

    const diffDays = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      id,
      companyId,
      plan: "trial",
      status: "trialing",
      trialEndsAt: trialEndsAt.toISOString(),
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      daysRemaining: diffDays,
      isEffectiveActive: true,
    };
  }

  // Calculate effective status
  let effectiveStatus: SubscriptionStatus = existing.status as SubscriptionStatus;
  let isEffectiveActive = true;

  if (existing.status === "trialing") {
    if (existing.trialEndsAt < now) {
      effectiveStatus = "expired";
      isEffectiveActive = false;
    }
  } else if (existing.status === "active") {
    if (existing.currentPeriodEnd && existing.currentPeriodEnd < now) {
      effectiveStatus = "past_due";
      isEffectiveActive = false;
    }
  } else if (existing.status === "cancelled" || existing.status === "expired" || existing.status === "past_due") {
    isEffectiveActive = false;
  }

  const targetDate = existing.status === "trialing" ? existing.trialEndsAt : (existing.currentPeriodEnd ?? existing.trialEndsAt);
  const diffDays = Math.max(0, Math.ceil((new Date(targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return {
    id: existing.id,
    companyId: existing.companyId,
    plan: (existing.plan as PlanKey) ?? "pro_monthly",
    status: effectiveStatus,
    trialEndsAt: existing.trialEndsAt.toISOString(),
    currentPeriodEnd: existing.currentPeriodEnd ? existing.currentPeriodEnd.toISOString() : null,
    cancelAtPeriodEnd: existing.cancelAtPeriodEnd,
    daysRemaining: diffDays,
    isEffectiveActive,
  };
}

/**
 * Enforces active subscription check. Returns null if allowed, or error details if blocked.
 */
export async function assertSubscriptionActive(companyId: string, executor: import("@/lib/availability").DbExecutor = db): Promise<{ ok: boolean; status: SubscriptionStatus; reason?: string }> {
  const sub = await getCompanySubscription(companyId, executor);
  if (!sub.isEffectiveActive) {
    const reason = sub.status === "expired"
      ? "Seu período de teste expirou. Escolha um plano para continuar utilizando a plataforma."
      : "Sua assinatura não está ativa. Atualize seus dados de pagamento para continuar.";
    return { ok: false, status: sub.status, reason };
  }
  return { ok: true, status: sub.status };
}
