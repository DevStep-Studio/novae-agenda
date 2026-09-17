import Link from "next/link";
import { ReserveiLogo } from "@/components/brand/novae-logo";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Termos de Uso | Reservei",
  description: "Termos e condições gerais de uso da plataforma SaaS Reservei.",
};

export default function TermosPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        maxWidth: "100vw",
        overflowX: "hidden",
        boxSizing: "border-box",
        background: "#080808",
        color: "#f5f5f5",
        padding: "clamp(24px, 5vw, 40px) clamp(16px, 4vw, 20px)",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
          <ReserveiLogo size={32} />
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minHeight: 44,
              padding: "0 8px",
              fontSize: 14,
              color: "#3b82f6",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} /> Voltar ao início
          </Link>
        </header>

        <article
          style={{
            background: "#121212",
            border: "1px solid #222222",
            borderRadius: 16,
            padding: "clamp(20px, 4vw, 36px) clamp(16px, 4vw, 32px)",
            lineHeight: 1.7,
            fontSize: 15,
            boxSizing: "border-box",
            width: "100%",
          }}
        >
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8, color: "#ffffff" }}>
            Termos de Uso do Reservei
          </h1>
          <p style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: 13, marginBottom: 28 }}>
            Última atualização: Setembro de 2026
          </p>

          <h2 style={{ fontSize: 18, color: "#3b82f6", marginTop: 24, marginBottom: 12 }}>
            1. Objeto e Aceitação
          </h2>
          <p>
            O Reservei é uma plataforma de software como serviço (SaaS) destinada ao agendamento de horários, gestão
            operacional, controle de clientes, gestão de equipes e métricas financeiras para estabelecimentos comerciais. Ao
            criar uma conta ou agendar por meio da plataforma, você concorda plenamente com estes termos.
          </p>

          <h2 style={{ fontSize: 18, color: "#3b82f6", marginTop: 24, marginBottom: 12 }}>
            2. Contas e Segurança
          </h2>
          <p>
            O usuário é responsável pela confidencialidade de suas credenciais e por todas as operações realizadas sob sua
            conta. O Reservei utiliza criptografia padrão de mercado (Bcrypt, JWT com assinatura criptográfica e conexões
            HTTPS seguras) para salvaguardar os dados dos usuários.
          </p>

          <h2 style={{ fontSize: 18, color: "#3b82f6", marginTop: 24, marginBottom: 12 }}>
            3. Assinatura e Cobrança SaaS
          </h2>
          <p>
            O estabelecimento usufrui de 7 (sete) dias de teste gratuito com acesso integral às funcionalidades. Após esse
            período, a manutenção da gestão operacional exige a contratação ativa de um plano comercial (Pro Mensal ou Pro
            Anual). A inadimplência ou cancelamento resultará na suspensão da criação de novos agendamentos, mantendo-se o
            acesso de leitura aos dados históricos por até 90 dias.
          </p>

          <h2 style={{ fontSize: 18, color: "#3b82f6", marginTop: 24, marginBottom: 12 }}>
            4. Cancelamento e Reagendamento
          </h2>
          <p>
            Cada estabelecimento configura suas próprias políticas de antecedência mínima, máxima e prazos limite para
            cancelamento ou reagendamento de atendimentos pelos clientes finais.
          </p>

          <h2 style={{ fontSize: 18, color: "#3b82f6", marginTop: 24, marginBottom: 12 }}>
            5. Legislação Aplicável e Foro
          </h2>
          <p>
            Estes termos são regidos pelas leis da República Federativa do Brasil, elegendo-se o foro da comarca da sede da
            plataforma para dirimir quaisquer dúvidas.
          </p>
        </article>
      </div>
    </div>
  );
}
