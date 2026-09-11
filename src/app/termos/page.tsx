import Link from "next/link";
import { NovaeLogo } from "@/components/brand/novae-logo";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Termos de Uso | Nova(e)",
  description: "Termos e condições gerais de uso da plataforma SaaS Nova(e).",
};

export default function TermosPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#f5f5f5", padding: "40px 20px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
          <NovaeLogo size={32} />
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              color: "#dcff4c",
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
            padding: "36px 32px",
            lineHeight: 1.7,
            fontSize: 15,
          }}
        >
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8, color: "#ffffff" }}>
            Termos de Uso do Nova(e)
          </h1>
          <p style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: 13, marginBottom: 28 }}>
            Última atualização: Setembro de 2026
          </p>

          <h2 style={{ fontSize: 18, color: "#dcff4c", marginTop: 24, marginBottom: 12 }}>
            1. Objeto e Aceitação
          </h2>
          <p>
            O Nova(e) é uma plataforma de software como serviço (SaaS) destinada ao agendamento de horários, gestão
            operacional, controle de clientes, gestão de equipes e métricas financeiras para estabelecimentos comerciais. Ao
            criar uma conta ou agendar por meio da plataforma, você concorda plenamente com estes termos.
          </p>

          <h2 style={{ fontSize: 18, color: "#dcff4c", marginTop: 24, marginBottom: 12 }}>
            2. Contas e Segurança
          </h2>
          <p>
            O usuário é responsável pela confidencialidade de suas credenciais e por todas as operações realizadas sob sua
            conta. O Nova(e) utiliza criptografia padrão de mercado (Bcrypt, JWT com assinatura criptográfica e conexões
            HTTPS seguras) para salvaguardar os dados dos usuários.
          </p>

          <h2 style={{ fontSize: 18, color: "#dcff4c", marginTop: 24, marginBottom: 12 }}>
            3. Assinatura e Cobrança SaaS
          </h2>
          <p>
            O estabelecimento usufrui de 7 (sete) dias de teste gratuito com acesso integral às funcionalidades. Após esse
            período, a manutenção da gestão operacional exige a contratação ativa de um plano comercial (Pro Mensal ou Pro
            Anual). A inadimplência ou cancelamento resultará na suspensão da criação de novos agendamentos, mantendo-se o
            acesso de leitura aos dados históricos por até 90 dias.
          </p>

          <h2 style={{ fontSize: 18, color: "#dcff4c", marginTop: 24, marginBottom: 12 }}>
            4. Cancelamento e Reagendamento
          </h2>
          <p>
            Cada estabelecimento configura suas próprias políticas de antecedência mínima, máxima e prazos limite para
            cancelamento ou reagendamento de atendimentos pelos clientes finais.
          </p>

          <h2 style={{ fontSize: 18, color: "#dcff4c", marginTop: 24, marginBottom: 12 }}>
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
