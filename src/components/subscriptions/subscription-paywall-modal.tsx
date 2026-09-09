"use client";

import { Sparkles, Check, Lock, ArrowRight } from "lucide-react";
import { NovaeLogo } from "@/components/brand/novae-logo";

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
        backgroundColor: "rgba(15, 31, 24, 0.92)",
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
          background: "#162a22",
          border: "1px solid rgba(220, 255, 76, 0.3)",
          borderRadius: 20,
          maxWidth: 680,
          width: "100%",
          padding: "36px 32px",
          color: "#f2f7f4",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.7)",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <NovaeLogo size={40} />
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 12px",
            background: "rgba(248, 113, 113, 0.15)",
            border: "1px solid rgba(248, 113, 113, 0.3)",
            borderRadius: 20,
            fontSize: 12,
            color: "#f87171",
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          <Lock size={13} /> Período de Teste Gratuito Expirado
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", margin: "0 0 10px" }}>
          Continue gerenciando seu negócio com o Nova(e)
        </h1>

        <p style={{ fontSize: 14, color: "rgba(255, 255, 255, 0.7)", maxWidth: 520, margin: "0 auto 28px", lineHeight: 1.6 }}>
          Seus dados, equipe e configurações estão 100% preservados e seguros. Escolha um plano para reativar o agendamento
          online e a operação diária da sua agenda.
        </p>

        {/* Options grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28, textAlign: "left" }}>
          {/* Pro Mensal */}
          <div
            style={{
              background: "#0f1f18",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 14,
              padding: "20px 18px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>Pro Mensal</span>
            <div style={{ margin: "10px 0 16px" }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: "#ffffff" }}>R$ 89,90</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>/mês</span>
            </div>
            <button
              type="button"
              onClick={() => onSelectPlan("pro_monthly")}
              style={{
                width: "100%",
                padding: "10px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                color: "#ffffff",
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
              background: "#0f1f18",
              border: "2px solid #dcff4c",
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
                background: "#dcff4c",
                color: "#12231b",
                fontSize: 10,
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 8,
              }}
            >
              ECONOMIZE 26%
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>Pro Anual</span>
            <div style={{ margin: "10px 0 16px" }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: "#dcff4c" }}>R$ 799,00</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>/ano</span>
            </div>
            <button
              type="button"
              onClick={() => onSelectPlan("pro_yearly")}
              style={{
                width: "100%",
                padding: "10px",
                background: "#dcff4c",
                border: "none",
                borderRadius: 8,
                color: "#12231b",
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
              color: "rgba(255,255,255,0.45)",
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
