"use client";

import { Lock } from "lucide-react";
import { ReserveiLogo } from "@/components/brand/novae-logo";

type Props = {
  daysRemaining?: number;
  onSelectPlan: (planKey: "pro_monthly" | "pro_yearly") => void;
  onLogout?: () => void;
};

export function SubscriptionPaywallModal({ onSelectPlan, onLogout }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: 20,
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          maxWidth: 680,
          width: "100%",
          padding: "36px 32px",
          color: "var(--text-primary)",
          boxShadow: "var(--shadow-lg)",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <ReserveiLogo size={40} />
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 12px",
            background: "var(--danger-soft)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            fontSize: 12,
            color: "var(--danger)",
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          <Lock size={13} /> Período de Teste Gratuito Expirado
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 10px" }}>
          Continue gerenciando seu negócio com o Reservei
        </h1>

        <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 520, margin: "0 auto 28px", lineHeight: 1.6 }}>
          Seus dados, equipe e configurações estão 100% preservados e seguros. Escolha um plano para reativar o agendamento
          online e a operação diária da sua agenda.
        </p>

        {/* Options grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28, textAlign: "left" }}>
          {/* Pro Mensal */}
          <div
            style={{
              background: "var(--surface-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: "20px 18px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Pro Mensal</span>
            <div style={{ margin: "10px 0 16px" }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)" }}>R$ 89,90</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/mês</span>
            </div>
            <button
              type="button"
              onClick={() => onSelectPlan("pro_monthly")}
              style={{
                width: "100%",
                padding: "10px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                marginTop: "auto",
              }}
            >
              Assinar Mensal
            </button>
          </div>

          {/* Pro Anual */}
          <div
            style={{
              background: "var(--surface-secondary)",
              border: "2px solid var(--primary)",
              borderRadius: 14,
              padding: "20px 18px",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -10,
                right: 12,
                background: "var(--primary)",
                color: "var(--primary-foreground, #ffffff)",
                fontSize: 10,
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 8,
              }}
            >
              ECONOMIZE 26%
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Pro Anual</span>
            <div style={{ margin: "10px 0 16px" }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: "var(--primary)" }}>R$ 799,00</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/ano</span>
            </div>
            <button
              type="button"
              onClick={() => onSelectPlan("pro_yearly")}
              style={{
                width: "100%",
                padding: "10px",
                background: "var(--primary)",
                border: "none",
                borderRadius: 8,
                color: "var(--primary-foreground, #ffffff)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                marginTop: "auto",
              }}
            >
              Assinar Anual
            </button>
          </div>
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              fontSize: 13,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Sair da conta
          </button>
        )}
      </div>
    </div>
  );
}
