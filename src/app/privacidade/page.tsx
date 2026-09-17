// TODO: revisar com advogado antes de publicar
import Link from "next/link";
import { ReserveiLogo } from "@/components/brand/novae-logo";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { SiteFooter } from "@/components/ui/site-footer";

export const metadata = {
  title: "Política de Privacidade | Reservei",
  description: "Conformidade com a LGPD e tratamento de dados pessoais na plataforma Reservei.",
};

const SECTIONS = [
  { id: "dados-coletados", label: "1. Dados Coletados e Finalidade" },
  { id: "seguranca", label: "2. Segurança e Isolamento Multi-Tenant" },
  { id: "direitos", label: "3. Direitos do Titular (Art. 18 da LGPD)" },
  { id: "encarregado", label: "4. Encarregado pelo Tratamento de Dados (DPO)" },
  { id: "cookies", label: "5. Cookies" },
];

export default function PrivacidadePage() {
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
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#dcff4c", marginBottom: 12 }}>
            <ShieldCheck size={20} />
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Conformidade LGPD
            </span>
          </div>

          <h1>Política de Privacidade e Proteção de Dados</h1>
          <p className="legal-updated-at">
            Última atualização: Setembro de 2026 — Em conformidade com a Lei Federal nº 13.709/2018 (LGPD)
          </p>

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

          <h2 id="dados-coletados">1. Dados Coletados e Finalidade</h2>
          <p>
            O Reservei coleta exclusivamente os dados indispensáveis para a prestação dos serviços de agendamento e gestão:
          </p>
          <ul>
            <li><strong>Clientes Finais:</strong> Nome, telefone para contato via WhatsApp/SMS e e-mail para confirmações e lembretes de agendamentos.</li>
            <li><strong>Estabelecimentos:</strong> Dados cadastrais da empresa, horários de expediente, catálogo de serviços e profissionais vinculados.</li>
            <li><strong>Profissionais:</strong> Nome, telefone, jornada de trabalho e comissões registradas no ato dos atendimentos.</li>
          </ul>

          <h2 id="seguranca">2. Segurança e Isolamento Multi-Tenant</h2>
          <p>
            Garantimos isolamento criptográfico e lógico rigoroso: os dados de uma empresa nunca são acessíveis por outra.
            Senhas são armazenadas com algoritmo de hash Bcrypt de alto custo (12 rounds) e as sessões utilizam tokens assinados em cookies HttpOnly com proteção contra CSRF e XSS.
          </p>

          <h2 id="direitos">3. Direitos do Titular (Art. 18 da LGPD)</h2>
          <p>
            Você pode exercer seus direitos legais a qualquer momento:
          </p>
          <ul>
            <li>Acesso e confirmação da existência de tratamento;</li>
            <li>Exportação completa dos seus dados em formato estruturado (JSON/CSV);</li>
            <li>Correção de dados incompletos ou inexatos;</li>
            <li>Eliminação dos dados pessoais tratados mediante solicitação do titular.</li>
          </ul>

          <h2 id="encarregado">4. Encarregado pelo Tratamento de Dados (DPO)</h2>
          <p>
            Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados pessoais, entre em contato pelo e-mail
            <strong> privacidade@reservei.com.br</strong>.
          </p>

          <h2 id="cookies">5. Cookies</h2>
          <p>
            Usamos cookies estritamente necessários para manter sua sessão autenticada (cookie <code>agenda_session</code>,
            HttpOnly, assinado criptograficamente) e para lembrar preferências locais como tema claro/escuro. Não usamos
            cookies de rastreamento publicitário ou de terceiros para perfilamento. Você pode gerenciar ou bloquear cookies
            diretamente nas configurações do seu navegador; note que bloquear o cookie de sessão impede o login na
            plataforma.
          </p>
        </article>
        <SiteFooter />
      </div>
    </div>
  );
}
