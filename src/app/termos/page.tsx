// TODO: revisar com advogado antes de publicar
import Link from "next/link";
import { ReserveiLogo } from "@/components/brand/novae-logo";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/ui/site-footer";

export const metadata = {
  title: "Termos de Uso | Reservei",
  description: "Termos e condições gerais de uso da plataforma SaaS Reservei.",
};

const SECTIONS = [
  { id: "objeto", label: "1. Objeto e Aceitação" },
  { id: "contas", label: "2. Contas e Segurança" },
  { id: "assinatura", label: "3. Assinatura e Cobrança SaaS" },
  { id: "cancelamento", label: "4. Cancelamento e Reagendamento" },
  { id: "foro", label: "5. Legislação Aplicável e Foro" },
];

export default function TermosPage() {
  return (
    <div className="legal-page">
      <div className="legal-page-inner">
        <header className="legal-header">
          <ReserveiLogo size={32} />
          <Link href="/" className="legal-back-link">
            <ArrowLeft size={16} /> Voltar ao início
          </Link>
        </header>

        <article className="legal-article">
          <h1>Termos de Uso do Reservei</h1>
          <p className="legal-updated-at">Última atualização: Setembro de 2026</p>

          <nav className="legal-toc" aria-label="Sumário">
            <p className="legal-toc-title">Sumário</p>
            <ol>
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.label}</a>
                </li>
              ))}
            </ol>
          </nav>

          <p style={{ color: "#a3a3a3", fontSize: 13.5 }}>
            Esta seção se aplica tanto a estabelecimentos (proprietários e equipe) que usam o Reservei para vender
            e gerenciar seus serviços, quanto a clientes finais que apenas agendam atendimentos.
          </p>

          <h2 id="objeto">1. Objeto e Aceitação</h2>
          <p>
            O Reservei é uma plataforma de software como serviço (SaaS) destinada ao agendamento de horários, gestão
            operacional, controle de clientes, gestão de equipes e métricas financeiras para estabelecimentos comerciais. Ao
            criar uma conta ou agendar por meio da plataforma, você concorda plenamente com estes termos.
          </p>

          <h2 id="contas">2. Contas e Segurança</h2>
          <p>
            O usuário é responsável pela confidencialidade de suas credenciais e por todas as operações realizadas sob sua
            conta. O Reservei utiliza criptografia padrão de mercado (Bcrypt, JWT com assinatura criptográfica e conexões
            HTTPS seguras) para salvaguardar os dados dos usuários.
          </p>

          <h2 id="assinatura">3. Assinatura e Cobrança SaaS</h2>
          <p>
            O estabelecimento usufrui de 7 (sete) dias de teste gratuito com acesso integral às funcionalidades. Após esse
            período, a manutenção da gestão operacional exige a contratação ativa de um plano comercial (Pro Mensal ou Pro
            Anual). A inadimplência ou cancelamento resultará na suspensão da criação de novos agendamentos, mantendo-se o
            acesso de leitura aos dados históricos por até 90 dias.
          </p>

          <h2 id="cancelamento">4. Cancelamento e Reagendamento</h2>
          <p>
            Cada estabelecimento configura suas próprias políticas de antecedência mínima, máxima e prazos limite para
            cancelamento ou reagendamento de atendimentos pelos clientes finais. Veja também a{" "}
            <Link href="/cancelamento-reembolso" style={{ color: "#dcff4c" }}>
              Política de Cancelamento e Reembolso
            </Link>
            .
          </p>

          <h2 id="foro">5. Legislação Aplicável e Foro</h2>
          <p>
            Estes termos são regidos pelas leis da República Federativa do Brasil, elegendo-se o foro da comarca da sede da
            plataforma para dirimir quaisquer dúvidas.
          </p>
        </article>
        <SiteFooter />
      </div>
    </div>
  );
}
