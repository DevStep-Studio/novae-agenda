import Link from "next/link";
import { ReserveiLogo } from "@/components/brand/novae-logo";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Política de Privacidade | Reservei",
  description: "Conformidade com a LGPD e tratamento de dados pessoais na plataforma Reservei.",
};

export default function PrivacidadePage() {
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
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#3b82f6", marginBottom: 12 }}>
            <ShieldCheck size={20} />
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Conformidade LGPD
            </span>
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8, color: "#ffffff" }}>
            Política de Privacidade e Proteção de Dados
          </h1>
          <p style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: 13, marginBottom: 28 }}>
            Em conformidade com a Lei Federal nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais)
          </p>

          <h2 style={{ fontSize: 18, color: "#3b82f6", marginTop: 24, marginBottom: 12 }}>
            1. Dados Coletados e Finalidade
          </h2>
          <p>
            O Reservei coleta exclusivamente os dados indispensáveis para a prestação dos serviços de agendamento e gestão:
          </p>
          <ul style={{ paddingLeft: 20, margin: "12px 0" }}>
            <li><strong>Clientes Finais:</strong> Nome, telefone para contato via WhatsApp/SMS e e-mail para confirmações e lembretes de agendamentos.</li>
            <li><strong>Estabelecimentos:</strong> Dados cadastrais da empresa, horários de expediente, catálogo de serviços e profissionais vinculados.</li>
            <li><strong>Profissionais:</strong> Nome, telefone, jornada de trabalho e comissões registradas no ato dos atendimentos.</li>
          </ul>

          <h2 style={{ fontSize: 18, color: "#3b82f6", marginTop: 24, marginBottom: 12 }}>
            2. Segurança e Isolamento Multi-Tenant
          </h2>
          <p>
            Garantimos isolamento criptográfico e lógico rigoroso: os dados de uma empresa nunca são acessíveis por outra.
            Senhas são armazenadas com algoritmo de hash Bcrypt de alto custo (12 rounds) e as sessões utilizam tokens assinados em cookies HttpOnly com proteção contra CSRF e XSS.
          </p>

          <h2 style={{ fontSize: 18, color: "#3b82f6", marginTop: 24, marginBottom: 12 }}>
            3. Direitos do Titular (Art. 18 da LGPD)
          </h2>
          <p>
            Você pode exercer seus direitos legais a qualquer momento:
          </p>
          <ul style={{ paddingLeft: 20, margin: "12px 0" }}>
            <li>Acesso e confirmação da existência de tratamento;</li>
            <li>Exportação completa dos seus dados em formato estruturado (JSON/CSV);</li>
            <li>Correção de dados incompletos ou inexatos;</li>
            <li>Eliminação dos dados pessoais tratados mediante solicitação do titular.</li>
          </ul>

          <h2 style={{ fontSize: 18, color: "#3b82f6", marginTop: 24, marginBottom: 12 }}>
            4. Encarregado pelo Tratamento de Dados (DPO)
          </h2>
          <p>
            Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados pessoais, entre em contato pelo e-mail
            <strong> privacidade@reservei.com.br</strong>.
          </p>
        </article>
      </div>
    </div>
  );
}
