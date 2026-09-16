"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Check,
  Users,
  ArrowRight,
  RefreshCw,
  X,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/client-utils";
import {
  TransparentCheckoutModal,
  type CheckoutPlan,
} from "./transparent-checkout-modal";

interface SubscriptionDetails {
  id: string | null;
  companyId: string;
  planSlug: string;
  planName: string;
  status: string;
  isEffectiveActive: boolean;
  billingInterval: "monthly" | "yearly";
  amount: number;
  paymentMethod: string | null;
  gateway?: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd?: boolean;
  trialEndsAt: string | null;
  cancelledAt: string | null;
}

interface UsageDetails {
  employeeLimit: number;
  activeEmployeesCount: number;
  remainingSeats: number;
  isLimitReached: boolean;
  isExceeded: boolean;
  canAddEmployee: boolean;
  percentage: number;
  employeesCount?: number;
  employeesLimit?: number;
  isWithinLimit?: boolean;
}

interface InvoiceItem {
  id: string;
  number: string | null;
  planSlug: string;
  billingInterval: string;
  amount: number;
  currency?: string;
  status: string;
  paymentMethod: string;
  dueAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export function SubscriptionView() {
  const [loading, setLoading] = useState(true);
  const [subData, setSubData] = useState<{
    subscription: SubscriptionDetails;
    usage: UsageDetails;
    invoices: InvoiceItem[];
  } | null>(null);
  const [plans, setPlans] = useState<CheckoutPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<CheckoutPlan | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const [subRes, plansRes] = await Promise.all([
        api<{
          subscription: SubscriptionDetails;
          usage: UsageDetails;
          invoices: InvoiceItem[];
        }>("/api/saas/subscription"),
        api<CheckoutPlan[]>("/api/saas/plans"),
      ]);
      setSubData(subRes || null);
      setPlans(Array.isArray(plansRes) ? plansRes : []);
    } catch (err: any) {
      console.error("Erro ao carregar dados de assinatura:", err);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [subRes, plansRes] = await Promise.all([
          api<{
            subscription: SubscriptionDetails;
            usage: UsageDetails;
            invoices: InvoiceItem[];
          }>("/api/saas/subscription"),
          api<CheckoutPlan[]>("/api/saas/plans"),
        ]);
        if (!cancelled) {
          setSubData(subRes || null);
          setPlans(Array.isArray(plansRes) ? plansRes : []);
        }
      } catch (err: any) {
        console.error("Erro ao carregar dados de assinatura:", err);
        if (!cancelled) setPlans([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenCheckout = (plan: CheckoutPlan) => {
    setSelectedPlanForCheckout(plan);
    setIsCheckoutOpen(true);
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Tem certeza que deseja cancelar sua assinatura? O acesso continuará ativo até o fim do ciclo vigente.")) {
      return;
    }

    try {
      const res = await api<{ message: string }>("/api/saas/subscription/cancel", {
        method: "POST",
      });
      setActionMessage({ type: "success", text: res?.message || "Assinatura cancelada com sucesso." });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Erro ao cancelar assinatura." });
    }
  };


  if (loading) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-secondary, #94a3b8)" }}>
        <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
        <p style={{ margin: 0, fontSize: 14 }}>Carregando dados da assinatura...</p>
      </div>
    );
  }

  const sub = subData?.subscription;
  const usage = subData?.usage;

  const statusBadge = (status: string = "trialing") => {
    const config: Record<string, { label: string; bg: string; text: string; border: string }> = {
      active: { label: "Ativa", bg: "var(--success-soft)", text: "var(--success)", border: "var(--success)" },
      trialing: { label: "Período de Teste", bg: "var(--primary-soft)", text: "var(--primary)", border: "var(--brand-border-subtle)" },
      past_due: { label: "Pagamento Pendente", bg: "var(--warning-soft)", text: "var(--warning)", border: "var(--warning)" },
      cancelled: { label: "Cancelada", bg: "var(--surface-secondary)", text: "var(--text-muted)", border: "var(--border)" },
      expired: { label: "Expirada", bg: "var(--danger-soft)", text: "var(--danger)", border: "var(--danger)" },
    };
    const c = config[status] || config.trialing;
    return (
      <span
        style={{
          padding: "3px 10px",
          background: c.bg,
          color: c.text,
          border: `1px solid ${c.border}`,
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {c.label}
      </span>
    );
  };

  return (
    <div
      className="page-content subscription-page-content"
      style={{
        maxWidth: 1160,
        margin: "0 auto",
        paddingTop: 32,
        paddingBottom: 80,
        paddingLeft: 24,
        paddingRight: 24,
        fontFamily: "inherit",
      }}
    >
      {/* Toast Alert */}
      {actionMessage && (
        <div
          style={{
            padding: "12px 16px",
            background: actionMessage.type === "success" ? "var(--success-soft)" : "var(--danger-soft)",
            border: `1px solid ${actionMessage.type === "success" ? "var(--success)" : "var(--danger)"}`,
            borderRadius: 10,
            color: actionMessage.type === "success" ? "var(--success)" : "var(--danger)",
            fontSize: 13,
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", display: "flex", alignItems: "center" }}
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* MINHA ASSINATURA — STATUS & SEAT USAGE PANEL */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "24px 28px",
          marginBottom: 40,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              {statusBadge(sub?.status)}
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Plano: <strong style={{ color: "var(--text-primary)" }}>{sub?.planName || "Profissional"}</strong>
              </span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px", color: "var(--text-primary)" }}>
              Minha Assinatura Reservei
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
              {sub?.currentPeriodEnd
                ? `Próxima renovação em ${new Date(sub.currentPeriodEnd).toLocaleDateString("pt-BR")} (${sub.billingInterval === "yearly" ? "Anual" : "Mensal"})`
                : sub?.trialEndsAt
                ? `Período de teste válido até ${new Date(sub.trialEndsAt).toLocaleDateString("pt-BR")}`
                : "Plano sob demanda"}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {sub?.status === "active" && !sub.cancelAtPeriodEnd && (
              <button
                onClick={handleCancelSubscription}
                style={{
                  padding: "8px 14px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar Assinatura
              </button>
            )}
          </div>
        </div>

        {/* Seat Usage Bar */}
        {usage && (
          <div
            style={{
              background: "var(--surface-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "16px 20px",
              marginTop: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={16} color="var(--primary)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                  Uso de Vagas da Equipe:
                </span>
                <span style={{ fontSize: 13, color: "var(--primary)", fontWeight: 700 }}>
                  {usage.activeEmployeesCount} / {usage.employeeLimit} funcionários ativos
                </span>
              </div>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {usage.remainingSeats} {usage.remainingSeats === 1 ? "vaga restante" : "vagas restantes"}
              </span>
            </div>

            {/* Visual Bar */}
            <div
              style={{
                width: "100%",
                height: 8,
                background: "var(--border)",
                borderRadius: 4,
                overflow: "hidden",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, (usage.activeEmployeesCount / usage.employeeLimit) * 100)}%`,
                  height: "100%",
                  background: usage.isExceeded ? "var(--danger)" : usage.isLimitReached ? "var(--warning)" : "var(--primary)",
                  borderRadius: 4,
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Check size={12} />
                <span>O proprietário está incluído e não consome vagas de funcionários.</span>
              </span>
              {usage.isLimitReached && (
                <span style={{ color: "var(--warning)", fontWeight: 600 }}>
                  Limite atingido. Faça upgrade para adicionar mais profissionais.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PLANOS SaaS HEADER & BILLING SWITCHER */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 8px" }}>
          Escolha o Plano Ideal para seu Estabelecimento
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 640, margin: "0 auto 20px" }}>
          Planos transparentes baseados no tamanho da sua equipe. Clientes, agendamentos e serviços são 100% ilimitados.
        </p>

        {/* Toggle Mensal / Anual */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 30,
            padding: 4,
          }}
        >
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            style={{
              padding: "8px 20px",
              borderRadius: 24,
              border: "none",
              background: billingCycle === "monthly" ? "var(--primary)" : "transparent",
              color: billingCycle === "monthly" ? "var(--primary-foreground, #ffffff)" : "var(--text-secondary)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            style={{
              padding: "8px 20px",
              borderRadius: 24,
              border: "none",
              background: billingCycle === "yearly" ? "var(--primary)" : "transparent",
              color: billingCycle === "yearly" ? "var(--primary-foreground, #ffffff)" : "var(--text-secondary)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s ease",
            }}
          >
            Anual
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                background: billingCycle === "yearly" ? "rgba(255, 255, 255, 0.2)" : "var(--primary-soft)",
                color: billingCycle === "yearly" ? "var(--primary-foreground, #ffffff)" : "var(--primary)",
                borderRadius: 10,
                fontWeight: 800,
              }}
            >
              2 MESES OFF
            </span>
          </button>
        </div>
      </div>

      {/* 6 PLAN CARDS GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
          gap: 20,
          marginBottom: 48,
        }}
      >
        {(plans || []).map((p) => {
          const isCurrent = sub?.planSlug === p.slug && sub.status === "active";
          const isFeatured = p.badge === "Mais escolhido" || p.slug === "profissional";
          const price = billingCycle === "yearly" ? p.annualPrice : p.monthlyPrice;

          return (
            <div
              key={p.slug}
              style={{
                background: "var(--surface)",
                border: isFeatured
                  ? "2px solid var(--primary)"
                  : "1px solid var(--border)",
                borderRadius: 16,
                padding: 24,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
              }}
            >
              {/* Badge if featured */}
              {isFeatured && (
                <div
                  style={{
                    position: "absolute",
                    top: -12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--primary)",
                    color: "var(--primary-foreground, #ffffff)",
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "3px 12px",
                    borderRadius: 20,
                  }}
                >
                  Mais Escolhido
                </div>
              )}

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                    {p.name}
                  </h3>
                  {isCurrent && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        background: "var(--primary-soft)",
                        color: "var(--primary)",
                        border: "1px solid var(--primary)",
                        borderRadius: 12,
                      }}
                    >
                      Plano Atual
                    </span>
                  )}
                </div>

                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px", minHeight: 36 }}>
                  {p.description}
                </p>

                {/* Price */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: "var(--text-primary)" }}>
                      {formatCurrency(price)}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      /{billingCycle === "yearly" ? "ano" : "mês"}
                    </span>
                  </div>
                  {billingCycle === "yearly" && (
                    <div style={{ fontSize: 11, color: "var(--primary)", marginTop: 2 }}>
                      Equivalente a {formatCurrency(price / 12)}/mês
                    </div>
                  )}
                </div>

                {/* Features List */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>
                    <Check size={16} />
                    <span>1 Proprietário incluído</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                    <Check size={16} color="var(--primary)" />
                    <span>Até {p.employeeLimit} funcionários</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                    <Check size={16} color="var(--primary)" />
                    <span>Clientes ilimitados</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                    <Check size={16} color="var(--primary)" />
                    <span>Agendamentos ilimitados</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                    <Check size={16} color="var(--primary)" />
                    <span>Página pública de reservas</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                    <Check size={16} color="var(--primary)" />
                    <span>Agenda & Notificações</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                    <Check size={16} color="var(--primary)" />
                    <span>Gestão completa de clientes</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => handleOpenCheckout(p)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 10,
                  border: isCurrent ? "1px solid var(--border)" : "none",
                  background: isCurrent
                    ? "transparent"
                    : isFeatured
                    ? "var(--primary)"
                    : "var(--surface-hover)",
                  color: isCurrent
                    ? "var(--text-secondary)"
                    : isFeatured
                    ? "var(--primary-foreground, #ffffff)"
                    : "var(--text-primary)",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.15s ease",
                }}
              >
                {isCurrent ? "Plano Atual" : "Começar Agora"}
                {!isCurrent && <ArrowRight size={16} />}
              </button>
            </div>
          );
        })}
      </div>

      {/* COMPARISON TABLE */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 40,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px" }}>
          Comparativo de Limite de Funcionários
        </h3>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                <th style={{ padding: "10px 12px" }}>Plano</th>
                <th style={{ padding: "10px 12px" }}>Proprietário</th>
                <th style={{ padding: "10px 12px" }}>Funcionários Máx.</th>
                <th style={{ padding: "10px 12px" }}>Clientes</th>
                <th style={{ padding: "10px 12px" }}>Agendamentos</th>
                <th style={{ padding: "10px 12px" }}>Preço Mensal</th>
                <th style={{ padding: "10px 12px" }}>Preço Anual</th>
              </tr>
            </thead>
            <tbody>
              {(plans || []).map((p) => (
                <tr
                  key={p.slug}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    color: "var(--text-primary)",
                    background: sub?.planSlug === p.slug ? "var(--primary-soft)" : "transparent",
                  }}
                >
                  <td style={{ padding: "12px", fontWeight: 700 }}>
                    {p.name} {p.badge ? `(${p.badge})` : ""}
                  </td>
                  <td style={{ padding: "12px", color: "var(--primary)" }}>Incluído</td>
                  <td style={{ padding: "12px", fontWeight: 700 }}>{p.employeeLimit}</td>
                  <td style={{ padding: "12px", color: "var(--success)" }}>Ilimitados</td>
                  <td style={{ padding: "12px", color: "var(--success)" }}>Ilimitados</td>
                  <td style={{ padding: "12px" }}>{formatCurrency(p.monthlyPrice)}</td>
                  <td style={{ padding: "12px" }}>{formatCurrency(p.annualPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* INVOICES HISTORY TABLE */}
      {subData?.invoices && subData.invoices.length > 0 && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px" }}>
            Histórico de Faturas & Recibos
          </h3>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  <th style={{ padding: "10px 12px" }}>Data</th>
                  <th style={{ padding: "10px 12px" }}>Plano</th>
                  <th style={{ padding: "10px 12px" }}>Valor</th>
                  <th style={{ padding: "10px 12px" }}>Forma de Pagamento</th>
                  <th style={{ padding: "10px 12px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {subData.invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid var(--border)", color: "var(--text-primary)" }}>
                    <td style={{ padding: "12px" }}>
                      {new Date(inv.paidAt || inv.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td style={{ padding: "12px", textTransform: "capitalize" }}>
                      {inv.planSlug || "Profissional"}
                    </td>
                    <td style={{ padding: "12px", fontWeight: 700 }}>
                      {formatCurrency(inv.amount)}
                    </td>
                    <td style={{ padding: "12px", textTransform: "uppercase" }}>
                      {inv.paymentMethod}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 700,
                          background: inv.status === "paid" ? "var(--success-soft)" : "var(--danger-soft)",
                          color: inv.status === "paid" ? "var(--success)" : "var(--danger)",
                          border: `1px solid ${inv.status === "paid" ? "var(--success)" : "var(--danger)"}`,
                        }}
                      >
                        {inv.status === "paid" ? "Pago" : inv.status === "pending" ? "Pendente" : "Falhou"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* Transparent Checkout Modal */}
      {selectedPlanForCheckout && (
        <TransparentCheckoutModal
          plan={selectedPlanForCheckout}
          billingInterval={billingCycle}
          isOpen={isCheckoutOpen}
          availablePlans={plans}
          onSelectPlan={(plan) => setSelectedPlanForCheckout(plan)}
          onClose={() => setIsCheckoutOpen(false)}
          onSuccess={() => {
            setActionMessage({ type: "success", text: "Assinatura ativada com sucesso!" });
            loadData();
          }}
        />
      )}
    </div>
  );
}
