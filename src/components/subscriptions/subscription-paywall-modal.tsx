"use client";

import { useState, useEffect } from "react";
import { Lock, Sparkles, Check, Users, ArrowRight, ShieldAlert, LogOut } from "lucide-react";
import { ReserveiLogo } from "@/components/brand/novae-logo";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/client-utils";
import { TransparentCheckoutModal, type CheckoutPlan } from "./transparent-checkout-modal";

const FALLBACK_PLANS: CheckoutPlan[] = [
  {
    id: "plan-essencial",
    slug: "essencial",
    name: "Essencial",
    description: "Para autônomos e pequenos negócios que estão começando.",
    monthlyPrice: 19.9,
    annualPrice: 199.0,
    employeeLimit: 2,
    popular: false,
    features: [
      "1 Proprietário incluído",
      "Até 2 funcionários",
      "Agendamentos ilimitados",
      "Página pública de reservas",
      "Agenda e notificações",
      "Gestão de clientes",
    ],
  },
  {
    id: "plan-profissional",
    slug: "profissional",
    name: "Profissional",
    description: "Ideal para equipes em crescimento que buscam organização.",
    monthlyPrice: 39.9,
    annualPrice: 399.0,
    employeeLimit: 5,
    popular: true,
    features: [
      "1 Proprietário incluído",
      "Até 5 funcionários",
      "Agendamentos ilimitados",
      "Página pública de reservas",
      "Agenda e notificações",
      "Gestão de clientes",
      "Relatórios e comissões",
    ],
  },
  {
    id: "plan-equipe",
    slug: "equipe",
    name: "Equipe",
    description: "Perfeito para negócios consolidados com múltiplos profissionais.",
    monthlyPrice: 69.9,
    annualPrice: 699.0,
    employeeLimit: 10,
    popular: false,
    features: [
      "1 Proprietário incluído",
      "Até 10 funcionários",
      "Agendamentos ilimitados",
      "Página pública de reservas",
      "Gestão completa de equipe",
      "Relatórios avançados",
    ],
  },
  {
    id: "plan-negocio",
    slug: "negocio",
    name: "Negócio",
    description: "Estrutura robusta para estúdios e barbearias de alto fluxo.",
    monthlyPrice: 119.9,
    annualPrice: 1199.0,
    employeeLimit: 20,
    popular: false,
    features: [
      "1 Proprietário incluído",
      "Até 20 funcionários",
      "Agendamentos ilimitados",
      "Página pública de reservas",
      "Múltiplos locais/unidades",
      "Suporte prioritário",
    ],
  },
  {
    id: "plan-empresa",
    slug: "empresa",
    name: "Empresa",
    description: "Alta capacidade para redes e clínicas estruturadas.",
    monthlyPrice: 229.9,
    annualPrice: 2299.0,
    employeeLimit: 50,
    popular: false,
    features: [
      "1 Proprietário incluído",
      "Até 50 funcionários",
      "Agendamentos ilimitados",
      "Página pública de reservas",
      "Múltiplos locais/unidades",
      "Suporte VIP dedicado",
    ],
  },
  {
    id: "plan-enterprise",
    slug: "enterprise",
    name: "Enterprise",
    description: "Escala máxima e suporte personalizado para grandes operações.",
    monthlyPrice: 399.9,
    annualPrice: 3999.0,
    employeeLimit: 100,
    popular: false,
    features: [
      "1 Proprietário incluído",
      "Até 100 funcionários",
      "Agendamentos ilimitados",
      "Página pública de reservas",
      "Acompanhamento dedicado",
      "SLA personalizado",
    ],
  },
];

interface SubscriptionPaywallModalProps {
  onPaymentSuccess: () => void;
  onLogout?: () => void;
}

export function SubscriptionPaywallModal({
  onPaymentSuccess,
  onLogout,
}: SubscriptionPaywallModalProps) {
  const [plans, setPlans] = useState<CheckoutPlan[]>(FALLBACK_PLANS);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlan | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  useEffect(() => {
    let active = true;
    api<CheckoutPlan[]>("/api/saas/plans")
      .then((data) => {
        if (active && Array.isArray(data) && data.length > 0) {
          setPlans(data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleOpenCheckout = (plan: CheckoutPlan) => {
    setSelectedPlan(plan);
    setIsCheckoutOpen(true);
  };

  const handleCheckoutSuccess = () => {
    setIsCheckoutOpen(false);
    onPaymentSuccess();
  };

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.88)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 99990,
          padding: "20px 16px",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            background: "#111114",
            border: "1px solid #27272a",
            borderRadius: "24px",
            maxWidth: "1080px",
            width: "100%",
            padding: "36px 28px",
            color: "#fafafa",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75)",
            margin: "auto",
          }}
        >
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
              <ReserveiLogo size={42} priority />
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 14px",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "20px",
                fontSize: "12.5px",
                color: "#f87171",
                fontWeight: 700,
                marginBottom: "14px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              <Lock size={14} /> Assinatura Vencida · Acesso Bloqueado
            </div>

            <h1
              style={{
                fontSize: "26px",
                fontWeight: 800,
                color: "#ffffff",
                margin: "0 0 10px",
                letterSpacing: "-0.5px",
              }}
            >
              Escolha um plano para reativar seu acesso ao Reservei
            </h1>

            <p
              style={{
                fontSize: "14.5px",
                color: "#a1a1aa",
                maxWidth: "640px",
                margin: "0 auto",
                lineHeight: "1.6",
              }}
            >
              Seus dados, equipe e configurações estão 100% preservados e seguros.
              Efetue o pagamento via <strong>PIX</strong> ou <strong>Cartão</strong> para liberar o painel imediatamente.
            </p>

            {/* Billing Interval Switcher */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "12px",
                padding: "4px",
                marginTop: "22px",
                gap: "4px",
              }}
            >
              <button
                type="button"
                onClick={() => setBillingInterval("monthly")}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: billingInterval === "monthly" ? "#10b981" : "transparent",
                  color: billingInterval === "monthly" ? "#0a0a0a" : "#a1a1aa",
                  transition: "all 0.15s ease",
                }}
              >
                Mensal
              </button>

              <button
                type="button"
                onClick={() => setBillingInterval("yearly")}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: billingInterval === "yearly" ? "#10b981" : "transparent",
                  color: billingInterval === "yearly" ? "#0a0a0a" : "#a1a1aa",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                Anual
                <span
                  style={{
                    fontSize: "10px",
                    background: billingInterval === "yearly" ? "#047857" : "#065f46",
                    color: "#ffffff",
                    padding: "2px 6px",
                    borderRadius: "6px",
                    fontWeight: 800,
                  }}
                >
                  2 meses grátis
                </span>
              </button>
            </div>
          </div>

          {/* Plans Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: "16px",
              marginBottom: "28px",
            }}
          >
            {plans.map((plan) => {
              const price = billingInterval === "yearly" ? plan.annualPrice : plan.monthlyPrice;
              const isPopular = plan.popular || plan.slug === "profissional";

              return (
                <div
                  key={plan.id || plan.slug}
                  style={{
                    background: isPopular ? "rgba(16, 185, 129, 0.05)" : "#18181b",
                    border: isPopular ? "2px solid #10b981" : "1px solid #27272a",
                    borderRadius: "16px",
                    padding: "22px 20px",
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                  }}
                >
                  {isPopular && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-11px",
                        right: "16px",
                        background: "#10b981",
                        color: "#0a0a0a",
                        fontSize: "10.5px",
                        fontWeight: 800,
                        padding: "3px 10px",
                        borderRadius: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Mais Escolhido
                    </div>
                  )}

                  <div style={{ marginBottom: "12px" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#ffffff", margin: "0 0 4px" }}>
                      {plan.name}
                    </h3>
                    <p style={{ fontSize: "12.5px", color: "#a1a1aa", margin: 0, minHeight: "36px" }}>
                      {plan.description}
                    </p>
                  </div>

                  <div style={{ margin: "8px 0 16px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                      <span style={{ fontSize: "28px", fontWeight: 800, color: isPopular ? "#10b981" : "#ffffff" }}>
                        {formatCurrency(price)}
                      </span>
                      <span style={{ fontSize: "12.5px", color: "#71717a" }}>
                        /{billingInterval === "yearly" ? "ano" : "mês"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        fontSize: "12px",
                        color: "#10b981",
                        fontWeight: 600,
                        marginTop: "4px",
                      }}
                    >
                      <Users size={13} />
                      <span>Proprietário + até {plan.employeeLimit} funcionários</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenCheckout(plan)}
                    style={{
                      width: "100%",
                      padding: "11px",
                      background: isPopular ? "#10b981" : "#27272a",
                      color: isPopular ? "#0a0a0a" : "#ffffff",
                      border: "none",
                      borderRadius: "10px",
                      fontSize: "13.5px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      marginTop: "auto",
                      transition: "opacity 0.15s ease",
                    }}
                  >
                    <span>Assinar {plan.name}</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer with logout option */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "1px solid #27272a",
              paddingTop: "18px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "12.5px", color: "#71717a" }}>
              Ambiente de pagamento seguro oficial Mercado Pago. Sem multas ou fidelidade.
            </span>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#a1a1aa",
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: 600,
                }}
              >
                <LogOut size={14} /> Sair da conta
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Transparent Checkout Modal */}
      {selectedPlan && (
        <TransparentCheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          plan={selectedPlan}
          billingInterval={billingInterval}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </>
  );
}
