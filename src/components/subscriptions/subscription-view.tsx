"use client";

import { useState, useEffect } from "react";
import {
  Check,
  CreditCard,
  QrCode,
  ShieldCheck,
  AlertCircle,
  Users,
  Calendar,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Clock,
  HelpCircle,
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
  paymentMethod: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
}

interface UsageDetails {
  employeeLimit: number;
  activeEmployeesCount: number;
  remainingSeats: number;
  isLimitReached: boolean;
  isExceeded: boolean;
  canAddEmployee: boolean;
  percentage: number;
}

interface InvoiceItem {
  id: string;
  planSlug: string;
  billingInterval: string;
  amount: number;
  paymentMethod: string;
  status: string;
  dueAt: string | null;
  paidAt: string | null;
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

  const loadData = async () => {
    try {
      setLoading(true);
      const [subRes, plansRes] = await Promise.all([
        api<{ data: any }>("/api/saas/subscription"),
        api<{ data: CheckoutPlan[] }>("/api/saas/plans"),
      ]);
      setSubData(subRes.data);
      setPlans(plansRes.data);
    } catch (err: any) {
      console.error("Erro ao carregar dados de assinatura:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
      const res = await api<{ data: { message: string } }>("/api/saas/subscription/cancel", {
        method: "POST",
      });
      setActionMessage({ type: "success", text: res.data.message });
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
      active: { label: "Ativa", bg: "rgba(34, 197, 94, 0.1)", text: "#4ade80", border: "#22c55e" },
      trialing: { label: "Período de Teste", bg: "rgba(56, 189, 248, 0.1)", text: "#38bdf8", border: "#0ea5e9" },
      past_due: { label: "Pagamento Pendente", bg: "rgba(249, 115, 22, 0.1)", text: "#fb923c", border: "#f97316" },
      cancelled: { label: "Cancelada", bg: "rgba(148, 163, 184, 0.1)", text: "#94a3b8", border: "#64748b" },
      expired: { label: "Expirada", bg: "rgba(239, 68, 68, 0.1)", text: "#f87171", border: "#ef4444" },
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
    <div style={{ maxWidth: 1120, margin: "0 auto", paddingBottom: 60, fontFamily: "inherit" }}>
      {/* Toast Alert */}
      {actionMessage && (
        <div
          style={{
            padding: "12px 16px",
            background: actionMessage.type === "success" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${actionMessage.type === "success" ? "#22c55e" : "#ef4444"}`,
            borderRadius: 10,
            color: actionMessage.type === "success" ? "#86efac" : "#fca5a5",
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
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* MINHA ASSINATURA — STATUS & SEAT USAGE PANEL */}
      <div
        style={{
          background: "var(--surface, #12141a)",
          border: "1px solid var(--border, #2a2e39)",
          borderRadius: 16,
          padding: "24px 28px",
          marginBottom: 40,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              {statusBadge(sub?.status)}
              <span style={{ fontSize: 13, color: "var(--text-secondary, #94a3b8)" }}>
                Plano: <strong style={{ color: "var(--text-primary, #ffffff)" }}>{sub?.planName || "Profissional"}</strong>
              </span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px", color: "var(--text-primary, #ffffff)" }}>
              Minha Assinatura Reservei
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary, #94a3b8)", margin: 0 }}>
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
                  border: "1px solid var(--border, #2a2e39)",
                  borderRadius: 8,
                  color: "var(--text-secondary, #94a3b8)",
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
              background: "var(--surface-card, #0d0f14)",
              border: "1px solid var(--border, #2a2e39)",
              borderRadius: 12,
              padding: "16px 20px",
              marginTop: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={16} color="var(--primary, #22c55e)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary, #ffffff)" }}>
                  Uso de Vagas da Equipe:
                </span>
                <span style={{ fontSize: 13, color: "var(--primary, #22c55e)", fontWeight: 700 }}>
                  {usage.activeEmployeesCount} / {usage.employeeLimit} funcionários ativos
                </span>
              </div>
              <span style={{ fontSize: 12, color: "var(--text-secondary, #94a3b8)" }}>
                {usage.remainingSeats} {usage.remainingSeats === 1 ? "vaga restante" : "vagas restantes"}
              </span>
            </div>

            {/* Visual Bar */}
            <div
              style={{
                width: "100%",
                height: 8,
                background: "var(--border, #2a2e39)",
                borderRadius: 4,
                overflow: "hidden",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, (usage.activeEmployeesCount / usage.employeeLimit) * 100)}%`,
                  height: "100%",
                  background: usage.isExceeded ? "#ef4444" : usage.isLimitReached ? "#f59e0b" : "var(--primary, #22c55e)",
                  borderRadius: 4,
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary, #94a3b8)" }}>
              <span>✓ O proprietário está incluído e não consome vagas de funcionários.</span>
              {usage.isLimitReached && (
                <span style={{ color: "#f59e0b", fontWeight: 600 }}>
                  Limite atingido. Faça upgrade para adicionar mais profissionais.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PLANOS SaaS HEADER & BILLING SWITCHER */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary, #ffffff)", margin: "0 0 8px" }}>
          Escolha o Plano Ideal para seu Estabelecimento
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary, #94a3b8)", maxWidth: 640, margin: "0 auto 20px" }}>
          Planos transparentes baseados no tamanho da sua equipe. Clientes, agendamentos e serviços são 100% ilimitados.
        </p>

        {/* Toggle Mensal / Anual */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "var(--surface, #12141a)",
            border: "1px solid var(--border, #2a2e39)",
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
              background: billingCycle === "monthly" ? "var(--primary, #22c55e)" : "transparent",
              color: billingCycle === "monthly" ? "#000000" : "var(--text-secondary, #94a3b8)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
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
              background: billingCycle === "yearly" ? "var(--primary, #22c55e)" : "transparent",
              color: billingCycle === "yearly" ? "#000000" : "var(--text-secondary, #94a3b8)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Anual
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                background: billingCycle === "yearly" ? "#000" : "rgba(34, 197, 94, 0.2)",
                color: billingCycle === "yearly" ? "var(--primary, #22c55e)" : "var(--primary, #22c55e)",
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
        {plans.map((p) => {
          const isCurrent = sub?.planSlug === p.slug && sub.status === "active";
          const isFeatured = p.badge === "Mais escolhido" || p.slug === "profissional";
          const price = billingCycle === "yearly" ? p.annualPrice : p.monthlyPrice;

          return (
            <div
              key={p.slug}
              style={{
                background: "var(--surface, #12141a)",
                border: isFeatured
                  ? "2px solid var(--primary, #22c55e)"
                  : "1px solid var(--border, #2a2e39)",
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
                    background: "var(--primary, #22c55e)",
                    color: "#000",
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
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary, #ffffff)", margin: 0 }}>
                    {p.name}
                  </h3>
                  {isCurrent && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        background: "rgba(34, 197, 94, 0.1)",
                        color: "var(--primary, #22c55e)",
                        border: "1px solid var(--primary, #22c55e)",
                        borderRadius: 12,
                      }}
                    >
                      Plano Atual
                    </span>
                  )}
                </div>

                <p style={{ fontSize: 13, color: "var(--text-secondary, #94a3b8)", margin: "0 0 16px", minHeight: 36 }}>
                  {p.description}
                </p>

                {/* Price */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: "var(--text-primary, #ffffff)" }}>
                      {formatCurrency(price)}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text-secondary, #94a3b8)" }}>
                      /{billingCycle === "yearly" ? "ano" : "mês"}
                    </span>
                  </div>
                  {billingCycle === "yearly" && (
                    <div style={{ fontSize: 11, color: "var(--primary, #22c55e)", marginTop: 2 }}>
                      Equivalente a {formatCurrency(price / 12)}/mês
                    </div>
                  )}
                </div>

                {/* Features List */}
                <div style={{ borderTop: "1px solid var(--border, #2a2e39)", paddingTop: 16, marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, fontWeight: 700, color: "var(--primary, #22c55e)" }}>
                    <Check size={16} />
                    <span>1 Proprietário incluído</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, fontWeight: 700, color: "var(--text-primary, #ffffff)" }}>
                    <Check size={16} color="var(--primary, #22c55e)" />
                    <span>Até {p.employeeLimit} funcionários</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, color: "var(--text-secondary, #94a3b8)" }}>
                    <Check size={16} color="var(--primary, #22c55e)" />
                    <span>Clientes ilimitados</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, color: "var(--text-secondary, #94a3b8)" }}>
                    <Check size={16} color="var(--primary, #22c55e)" />
                    <span>Agendamentos ilimitados</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, color: "var(--text-secondary, #94a3b8)" }}>
                    <Check size={16} color="var(--primary, #22c55e)" />
                    <span>Página pública de reservas</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, color: "var(--text-secondary, #94a3b8)" }}>
                    <Check size={16} color="var(--primary, #22c55e)" />
                    <span>Agenda & Notificações</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary, #94a3b8)" }}>
                    <Check size={16} color="var(--primary, #22c55e)" />
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
                  border: isCurrent ? "1px solid var(--border, #2a2e39)" : "none",
                  background: isCurrent
                    ? "transparent"
                    : isFeatured
                    ? "var(--primary, #22c55e)"
                    : "var(--surface-hover, #1a1d26)",
                  color: isCurrent
                    ? "var(--text-secondary, #94a3b8)"
                    : isFeatured
                    ? "#000000"
                    : "var(--text-primary, #ffffff)",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
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
          background: "var(--surface, #12141a)",
          border: "1px solid var(--border, #2a2e39)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 40,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary, #ffffff)", margin: "0 0 16px" }}>
          Comparativo de Limite de Funcionários
        </h3>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border, #2a2e39)", color: "var(--text-secondary, #94a3b8)" }}>
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
              {plans.map((p) => (
                <tr
                  key={p.slug}
                  style={{
                    borderBottom: "1px solid var(--border, #1c202a)",
                    color: "var(--text-primary, #ffffff)",
                    background: sub?.planSlug === p.slug ? "rgba(34, 197, 94, 0.05)" : "transparent",
                  }}
                >
                  <td style={{ padding: "12px", fontWeight: 700 }}>
                    {p.name} {p.badge ? `(${p.badge})` : ""}
                  </td>
                  <td style={{ padding: "12px", color: "var(--primary, #22c55e)" }}>Incluído</td>
                  <td style={{ padding: "12px", fontWeight: 700 }}>{p.employeeLimit}</td>
                  <td style={{ padding: "12px", color: "#4ade80" }}>Ilimitados</td>
                  <td style={{ padding: "12px", color: "#4ade80" }}>Ilimitados</td>
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
            background: "var(--surface, #12141a)",
            border: "1px solid var(--border, #2a2e39)",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary, #ffffff)", margin: "0 0 16px" }}>
            Histórico de Faturas & Recibos
          </h3>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border, #2a2e39)", color: "var(--text-secondary, #94a3b8)" }}>
                  <th style={{ padding: "10px 12px" }}>Data</th>
                  <th style={{ padding: "10px 12px" }}>Plano</th>
                  <th style={{ padding: "10px 12px" }}>Valor</th>
                  <th style={{ padding: "10px 12px" }}>Forma de Pagamento</th>
                  <th style={{ padding: "10px 12px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {subData.invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid var(--border, #1c202a)", color: "var(--text-primary, #ffffff)" }}>
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
                          background: inv.status === "paid" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                          color: inv.status === "paid" ? "#4ade80" : "#f87171",
                          border: `1px solid ${inv.status === "paid" ? "#22c55e" : "#ef4444"}`,
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
