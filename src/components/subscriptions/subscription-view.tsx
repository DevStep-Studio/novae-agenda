"use client";

import { useState, useEffect } from "react";
import { Sparkles, Check, CreditCard, ShieldCheck, AlertCircle, ExternalLink, RefreshCw } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/client-utils";
import type { SubscriptionDTO, PlanKey } from "@/lib/subscriptions";

type InvoiceItem = {
  id: string;
  amount: number;
  status: string;
  paidAt: string | null;
  invoiceUrl?: string | null;
  createdAt: string;
};

type SubscriptionApiResponse = {
  subscription: SubscriptionDTO;
  plans: Record<PlanKey, {
    key: PlanKey;
    name: string;
    price: number;
    interval: string;
    description: string;
    badge?: string;
    features: string[];
  }>;
  invoices: InvoiceItem[];
};

export function SubscriptionView() {
  const [data, setData] = useState<SubscriptionApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [upgrading, setUpgrading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadSubscription = async () => {
    try {
      setLoading(true);
      const res = await api<{ data: SubscriptionApiResponse }>("/api/subscriptions");
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscription();
  }, []);

  const handleCheckout = async (planKey: "pro_monthly" | "pro_yearly", simulate = false) => {
    setUpgrading(true);
    setMessage(null);
    try {
      const res = await api<{ data: { initPoint?: string; isSimulated?: boolean; ok?: boolean } }>(
        "/api/subscriptions",
        {
          method: "POST",
          body: JSON.stringify({ planKey, simulate }),
        }
      );

      if (res.data.ok) {
        setMessage("Plano ativado com sucesso!");
        await loadSubscription();
      } else if (res.data.initPoint) {
        window.location.href = res.data.initPoint;
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao processar assinatura.");
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(255,255,255,0.6)" }}>
        Carregando informações da sua assinatura...
      </div>
    );
  }

  const sub = data?.subscription;
  const statusLabels: Record<string, { label: string; color: string }> = {
    trialing: { label: "Período de Teste (7 dias)", color: "#dcff4c" },
    active: { label: "Assinatura Ativa", color: "#4ade80" },
    past_due: { label: "Pagamento Pendente", color: "#fb923c" },
    cancelled: { label: "Cancelada", color: "#94a3b8" },
    expired: { label: "Trial Expirado", color: "#f87171" },
  };

  const currentStatus = sub ? statusLabels[sub.status] || { label: sub.status, color: "#ffffff" } : null;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", paddingBottom: 40 }}>
      {/* Current Subscription Card */}
      {sub && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "24px 28px",
            marginBottom: 32,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span
                style={{
                  padding: "3px 10px",
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${currentStatus?.color}`,
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  color: currentStatus?.color,
                }}
              >
                {currentStatus?.label}
              </span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                Plano: {sub.plan === "pro_yearly" ? "Pro Anual" : sub.plan === "pro_monthly" ? "Pro Mensal" : "Trial Gratuito"}
              </span>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", margin: "4px 0" }}>
              {sub.status === "trialing"
                ? `${sub.daysRemaining} dias restantes de teste grátis`
                : sub.status === "active"
                  ? "Sua assinatura está ativa e regular"
                  : "Assinatura requer renovação"}
            </h2>

            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0 }}>
              {sub.currentPeriodEnd
                ? `Próxima renovação em ${new Date(sub.currentPeriodEnd).toLocaleDateString("pt-BR")}`
                : `Trial expira em ${new Date(sub.trialEndsAt).toLocaleDateString("pt-BR")}`}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {sub.status !== "active" && (
              <button
                type="button"
                onClick={() => handleCheckout(billingCycle === "yearly" ? "pro_yearly" : "pro_monthly", true)}
                disabled={upgrading}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  background: "#dcff4c",
                  border: "none",
                  borderRadius: 8,
                  color: "#080808",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Sparkles size={16} /> Ativar Plano Pro
              </button>
            )}
          </div>
        </div>
      )}

      {message && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(74, 222, 128, 0.15)",
            border: "1px solid #4ade80",
            borderRadius: 8,
            color: "#4ade80",
            marginBottom: 24,
            fontSize: 14,
          }}
        >
          {message}
        </div>
      )}

      {/* Cycle Switcher */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>
          Planos transparentes para o seu espaço crescer
        </h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 20 }}>
          Sem taxas ocultas, sem fidelidade forçada. Cancele quando desejar.
        </p>

        <div
          style={{
            display: "inline-flex",
            background: "var(--surface-secondary)",
            padding: 4,
            borderRadius: 10,
            border: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            style={{
              padding: "8px 18px",
              borderRadius: 6,
              border: "none",
              fontSize: 13,
              fontWeight: billingCycle === "monthly" ? 700 : 500,
              cursor: "pointer",
              background: billingCycle === "monthly" ? "var(--primary)" : "transparent",
              color: billingCycle === "monthly" ? "var(--primary-foreground, #ffffff)" : "var(--text-secondary)",
            }}
          >
            Cobrança Mensal
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            style={{
              padding: "8px 18px",
              borderRadius: 6,
              border: "none",
              fontSize: 13,
              fontWeight: billingCycle === "yearly" ? 700 : 500,
              cursor: "pointer",
              background: billingCycle === "yearly" ? "var(--primary)" : "transparent",
              color: billingCycle === "yearly" ? "var(--primary-foreground, #ffffff)" : "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Cobrança Anual
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                background: billingCycle === "yearly" ? "var(--surface)" : "var(--primary)",
                color: billingCycle === "yearly" ? "var(--primary)" : "var(--primary-foreground, #ffffff)",
                borderRadius: 10,
                fontWeight: 800,
              }}
            >
              ECONOMIZE 26%
            </span>
          </button>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 40 }}>
        {/* Pro Mensal */}
        <div
          style={{
            background: "var(--surface)",
            border: billingCycle === "monthly" ? "2px solid var(--primary)" : "1px solid var(--border)",
            borderRadius: 16,
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>Pro Mensal</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", minHeight: 36, margin: "0 0 16px" }}>
            Flexibilidade mês a mês para quem quer pagar mensalmente.
          </p>

          <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "16px 0 24px" }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)" }}>R$ 89,90</span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>/mês</span>
          </div>

          <button
            type="button"
            onClick={() => handleCheckout("pro_monthly")}
            disabled={upgrading || (sub?.status === "active" && sub.plan === "pro_monthly")}
            style={{
              width: "100%",
              padding: "12px",
              background: billingCycle === "monthly" ? "var(--primary)" : "var(--surface-secondary)",
              color: billingCycle === "monthly" ? "var(--primary-foreground, #ffffff)" : "var(--text-primary)",
              border: billingCycle === "monthly" ? "none" : "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              marginBottom: 24,
            }}
          >
            {sub?.status === "active" && sub.plan === "pro_monthly" ? "Seu Plano Atual" : "Assinar Mensal"}
          </button>

          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              "Agendamentos e clientes ilimitados",
              "Gestão de múltiplos profissionais",
              "Link público e página com QR Code",
              "Financeiro completo com comissões",
              "Relatórios operacionais",
            ].map((f) => (
              <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                <Check size={16} color="var(--primary)" /> {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro Anual */}
        <div
          style={{
            background: "var(--surface)",
            border: billingCycle === "yearly" ? "2px solid var(--primary)" : "1px solid var(--border)",
            borderRadius: 16,
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -12,
              right: 20,
              background: "var(--primary)",
              color: "var(--primary-foreground, #ffffff)",
              fontSize: 11,
              fontWeight: 800,
              padding: "3px 10px",
              borderRadius: 12,
              textTransform: "uppercase",
            }}
          >
            Melhor Custo-Benefício
          </div>

          <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>Pro Anual</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", minHeight: 36, margin: "0 0 16px" }}>
            Equivalente a R$ 66,58/mês. Máxima economia e tranquilidade para o ano todo.
          </p>

          <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "16px 0 24px" }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: "var(--primary)" }}>R$ 799,00</span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>/ano</span>
          </div>

          <button
            type="button"
            onClick={() => handleCheckout("pro_yearly")}
            disabled={upgrading || (sub?.status === "active" && sub.plan === "pro_yearly")}
            style={{
              width: "100%",
              padding: "12px",
              background: "var(--primary)",
              color: "var(--primary-foreground, #ffffff)",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              marginBottom: 24,
            }}
          >
            {sub?.status === "active" && sub.plan === "pro_yearly" ? "Seu Plano Atual" : "Assinar Anual com Desconto"}
          </button>

          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              "Economia de 26% em relação ao plano mensal",
              "Todos os recursos do plano Pro",
              "Agendamentos e clientes ilimitados",
              "Exportação completa de dados (CSV)",
              "Suporte prioritário",
            ].map((f) => (
              <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                <Check size={16} color="var(--primary)" /> {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Invoice History */}
      {data?.invoices && data.invoices.length > 0 && (
        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "24px 28px",
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#ffffff", marginBottom: 16 }}>
            Histórico de Pagamentos e Faturas
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                  <th style={{ padding: "8px 12px" }}>Data</th>
                  <th style={{ padding: "8px 12px" }}>Valor</th>
                  <th style={{ padding: "8px 12px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "10px 12px" }}>{new Date(inv.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{formatCurrency(inv.amount)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ color: inv.status === "paid" ? "#4ade80" : "#fb923c" }}>
                        {inv.status === "paid" ? "Pago" : "Pendente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
