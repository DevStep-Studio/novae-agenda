// TODO: revisar com advogado antes de publicar
import Link from "next/link";
import { ReserveiLogo } from "@/components/brand/novae-logo";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/ui/site-footer";

export const metadata = {
  title: "Política de Cancelamento e Reembolso | Reservei",
  description: "Regras de cancelamento e reembolso para assinaturas do Reservei e para agendamentos feitos pelos clientes finais.",
};

const SECTIONS = [
  { id: "assinatura", label: "1. Assinatura do estabelecimento (SaaS)" },
  { id: "agendamentos", label: "2. Agendamentos de clientes finais" },
  { id: "reembolsos", label: "3. Como funcionam os reembolsos" },
  { id: "solicitacao", label: "4. Como solicitar" },
];

export default function CancelamentoReembolsoPage() {
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
          <h1>Política de Cancelamento e Reembolso</h1>
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

          <p>
            Esta política existe porque o Reservei tem dois públicos com fluxos financeiros diferentes: os
            estabelecimentos que assinam a plataforma, e os clientes finais que agendam horários através dela.
            Cada um é tratado separadamente abaixo.
          </p>

          <h2 id="assinatura">1. Assinatura do estabelecimento (SaaS)</h2>
          <p>
            O estabelecimento contrata um plano de assinatura recorrente do Reservei (mensal ou anual), processado
            pelo Mercado Pago como meio de pagamento. O cancelamento da assinatura pode ser feito a qualquer momento
            pelo próprio painel de gestão, em Assinatura. Ao cancelar, o acesso às funcionalidades pagas permanece
            ativo até o fim do período já pago; não há renovação automática após essa data.
          </p>
          <p>
            Reembolsos de valores já cobrados pela assinatura são avaliados caso a caso, considerando o tempo de uso
            do período contratado e a natureza do pedido (por exemplo, cobrança duplicada ou erro de processamento
            do Mercado Pago).
          </p>

          <h2 id="agendamentos">2. Agendamentos de clientes finais</h2>
          <p>
            O Reservei é a plataforma de agendamento — cada estabelecimento define suas próprias regras de
            antecedência mínima para cancelamento e reagendamento de horários, configuradas individualmente por
            ele no sistema. Não existe um prazo único de cancelamento válido para todos os estabelecimentos da
            plataforma: consulte a política do estabelecimento onde o agendamento foi feito, informada no momento
            da reserva ou na confirmação enviada por WhatsApp/e-mail.
          </p>
          <p>
            Pagamentos de serviços agendados (quando cobrados antecipadamente pelo estabelecimento) seguem a
            política de reembolso definida por esse estabelecimento, não uma política única da plataforma.
          </p>

          <h2 id="reembolsos">3. Como funcionam os reembolsos</h2>
          <p>
            Quando um reembolso é aprovado, ele é processado pelo mesmo meio de pagamento usado na cobrança
            original, através do Mercado Pago. O prazo de compensação segue o prazo padrão da operadora do cartão
            ou método utilizado, geralmente entre 5 e 30 dias úteis, fora do nosso controle direto.
          </p>

          <h2 id="solicitacao">4. Como solicitar</h2>
          <p>
            Para cancelamento ou dúvidas sobre reembolso da assinatura do estabelecimento, use o canal de suporte
            dentro do painel de gestão. Para cancelamento de um agendamento como cliente final, use a tela
            &ldquo;Minhas Reservas&rdquo; ou entre em contato diretamente com o estabelecimento.
          </p>
        </article>
        <SiteFooter />
      </div>
    </div>
  );
}
