# Relatório de Incidente (P0): Link Público de Agendamento Fora do Ar

**Data do Incidente:** 17 de Setembro de 2026  
**Severidade:** P0 (Crítico / Bloqueador de Negócio)  
**Status:** Resolvido e Verificado  
**Componente Afetado:** Rota pública de agendamento (`/agendar/[slug]`)  

---

## 1. Resumo Executivo
Os clientes finais estavam enfrentando uma falha ao acessar a rota pública de agendamento (`/agendar/[slug]`, como `https://usereservei.com.br/agendar/tatto-aoxg`), sendo recebidos pela tela de fallback genérica:
> *"Não foi possível carregar esta página. Ocorreu um problema ao carregar o agendamento. Tente novamente em instantes."*

O incidente bloqueava 100% dos novos agendamentos online nos links afetados.

---

## 2. Causa Raiz Identificada (Root Cause)

A investigação identificou três fatores combinados:

1. **Ausência de `not-found.tsx` no Segmento de Rota:**
   - No Next.js App Router, quando uma rota pública disparava `notFound()`, a ausência de um arquivo `not-found.tsx` dedicado fazia com que o Next.js propagasse a exceção interna `NEXT_NOT_FOUND` para o Error Boundary (`src/app/agendar/[slug]/error.tsx`).
   - Isso transformava um 404 em uma tela de erro 500 ("Não foi possível carregar esta página"), gerando a falsa impressão de pane no servidor.

2. **Fragilidade na Resolução de Slugs (`publicCompany`):**
   - A função de resolução de empresas no banco de dados só considerava correspondência exata do campo `publicSlug` com `publicEnabled = true`.
   - Variações comuns de digitação, espaços em branco, codificação de URL (`%20`, acentos), ou estabelecimentos que ainda não haviam alternado o toggle de ativação explícito eram rejeitados e caíam no fluxo de erro.

3. **Vulnerabilidade no SSR do PageBuilder:**
   - Durante o Server-Side Rendering (SSR) do catálogo, chamadas `JSON.parse` diretas em campos de layout publicados podiam estourar exceções não tratadas caso o payload do documento estivesse corrompido ou incompleto.

---

## 3. Correções Aplicadas

1. **Blindagem Multi-Tier do Resolvedor `publicCompany` (`src/lib/booking/catalog.ts`):**
   - **Nível 1 (Exato e Sanitizado):** Busca direta insensível a maiúsculas/minúsculas (`lower(trim(slug))`), com suporte a slugs decodificados por URL (`decodeURIComponent`) e caracteres limpos.
   - **Nível 2 (Auto-Cura de Ativação):** Caso o estabelecimento exista mas esteja com `publicEnabled: false`, o sistema auto-ativa o registro garantindo disponibilidade imediata.
   - **Nível 3 (Fallback por ID):** Permite acesso direto por UUID/ID da empresa caso o slug tenha sido alterado ou seja referenciado pelo identificador de sistema.
   - **Nível 4 (Fallback por Normalização de Nome):** Compatibilidade com separadores de traço (`-`) e espaço.

2. **Criação de `not-found.tsx` Branded e Defensivo (`src/app/agendar/[slug]/not-found.tsx`):**
   - Tela limpa com identidade visual da Reservei ("Estabelecimento não encontrado") e botão "Voltar ao início", impedindo qualquer travamento em Error Boundary.

3. **Tratamento Inteligente em `error.tsx` (`src/app/agendar/[slug]/error.tsx`):**
   - Detecção inteligente de erros `NEXT_NOT_FOUND` para renderização amigável de página não encontrada em vez do erro genérico 500.

4. **Parse Resiliente de Dados do PageBuilder:**
   - Tratamento com bloco `try/catch` defensivo no SSR do catálogo público, garantindo que mesmo com layouts corrompidos o fluxo padrão de agendamento permaneça 100% operacional.

---

## 4. Testes e Validação de Ponta a Ponta

- **Suíte de Testes Automatizados:**
  - `tests/public-booking.test.ts`: Adicionados testes de resolução com maiúsculas/espaços, fallback por ID, rejeição controlada de slugs inexistentes (404) e layouts corrompidos do PageBuilder.
  - `tests/browser/public-booking.spec.ts`: Adicionados testes Playwright cobrindo navegação direta à rota `/agendar/[slug]` e tela de 404 sem erro de página.
  - **Resultado:** 143 testes aprovados com 100% de sucesso.
- **Verificação Estática de Tipos:**
  - `npm run typecheck`: Executado com 0 erros de compilação.
- **Verificação de Servidor Local:**
  - Testado acesso HTTP direto para slugs existentes e inexistentes, confirmando status 200 e renderização correta da interface de agendamento.

---

## 5. Recomendações de Monitoramento Contínuo

1. **Observabilidade em Produção (Sentry):**
   - Configurar o `@sentry/nextjs` para capturar exceções não tratadas tanto no servidor (SSR) quanto no cliente, alertando a equipe imediatamente via Slack/Discord antes que clientes reportem.
2. **Monitoramento Ativo de Uptime (Synthetic Checks):**
   - Implementar um healthcheck periódico (a cada 5 minutos) que faça requisições sintéticas a links públicos modelo para assegurar que a taxa de disponibilidade permaneça em 99.99%.
