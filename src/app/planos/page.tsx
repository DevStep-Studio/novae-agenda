import type { Metadata } from "next";
import { SubscriptionView } from "@/components/subscriptions/subscription-view";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Planos e Assinaturas — Reservei",
  description: "Conheça os planos profissionais do Reservei para gestão de estabelecimentos e equipes.",
};

export default function PlanosPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--background, #090a0f)",
        color: "var(--text-primary, #ffffff)",
        padding: "32px 20px",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link
          href="/gestao"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--text-secondary, #94a3b8)",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} />
          Voltar para o Painel
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.03em" }}>
            RESERVEI<span style={{ color: "var(--primary, #22c55e)" }}>.</span>
          </span>
        </div>
      </div>

      <SubscriptionView />
    </main>
  );
}
