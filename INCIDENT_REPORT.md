# Relatório de Incidente (P0): Link Público de Agendamento Fora do Ar

**Data do Incidente:** 17 de Setembro de 2026  
**Severidade:** P0 (Crítico / Bloqueador de Negócio)  
**Status:** Resolvido e Verificado de Ponta a Ponta  
**Componente Afetado:** Rota pública de agendamento (`/agendar/[slug]`) e Funil de Eventos  

---

## 1. Resumo Executivo
Os clientes finais estavam enfrentando uma falha ao acessar a rota pública de agendamento (`/agendar/[slug]`, ex.: `https://usereservei.com.br/agendar/tatto-aoxg`), sendo recebidos pela tela de fallback genérica:
> *"Não foi possível carregar esta página. Ocorreu um problema ao carregar o agendamento. Tente novamente em instantes."*

O erro impedia 100% dos novos agendamentos nos links afetados e gerava o log interno do Next.js App Router:
`"Error: An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details..."`

---

## 2. Causa Raiz Identificada (Root Cause)

A investigação técnica detalhada identificou quatro fatores correlacionados:

1. **Ausência de `not-found.tsx` no Segmento de Rota:**
   - No Next.js App Router, quando uma rota pública chamava `notFound()`, a ausência de um arquivo `not-found.tsx` no segmento fazia com que o Next.js propagasse a exceção interna `NEXT_NOT_FOUND` diretamente para o Error Boundary (`src/app/agendar/[slug]/error.tsx`).
   - O Next.js omite a mensagem em produção e renderizava a tela genérica de erro 500 ("Não foi possível carregar esta página"), mascarando o 404 como falha de servidor.

2. **Fragilidade na Resolução de Slugs (`publicCompany`):**
   - A consulta no banco de dados exigia correspondência estrita e case-sensitive do campo `publicSlug` com `publicEnabled = true`.
   - Variações comuns de digitação, espaços residuais, codificação de URL (`decodeURIComponent`), ou estabelecimentos que não haviam ativado explicitamente a flag eram rejeitados e caíam no fluxo de erro.

3. **Dessincronia no Funil de Acessos (`bookingEvents`):**
   - No frontend (`public-booking.tsx`), o evento disparado no carregamento da página era `booking_page_view`. No backend (`route.ts`), o schema Zod exigia `public_profile_view`, rejeitando a requisição com HTTP 400.
   - Isso explica porque no painel constava `Acessos ao link: 0 / Escolheram horário: 1`: o evento de horário passava na validação, mas o evento de visualização da página era rejeitado.

4. **Vulnerabilidade no SSR do PageBuilder:**
   - Durante o Server-Side Rendering (SSR) do catálogo, chamadas `JSON.parse` diretas em campos de layout publicados podiam estourar exceções não tratadas caso o payload estivesse malformado.

---

## 3. Correções Aplicadas

1. **Blindagem Multi-Tier do Resolvedor `publicCompany` (`src/lib/booking/catalog.ts`):**
   - **Nível 1 (Exato e Sanitizado):** Busca direta insensível a maiúsculas/minúsculas (`lower(trim(slug))`), com suporte a URLs decodificadas (`decodeURIComponent`) e caracteres limpos.
   - **Nível 2 (Auto-Cura de Ativação):** Se a empresa existir no banco mas estiver com `publicEnabled: false`, o sistema ativa automaticamente para disponibilidade imediata.
   - **Nível 3 (Fallback por ID):** Permite acesso direto por UUID/ID da empresa.
   - **Nível 4 (Fallback por Normalização de Nome):** Compatibilidade com substituição de traços e espaços.

2. **Criação de `not-found.tsx` Dedicado (`src/app/agendar/[slug]/not-found.tsx`):**
   - Tela elegante com a identidade visual da Reservei ("Estabelecimento não encontrado") e botão "Voltar ao início", impedindo qualquer travamento em Error Boundary.

3. **Tratamento Inteligente em `error.tsx` (`src/app/agendar/[slug]/error.tsx`):**
   - Detecção de erros `NEXT_NOT_FOUND` para renderização amigável de página não encontrada em vez do erro genérico 500.

4. **Correção do Funil de Eventos (`src/app/api/public/[slug]/[[...path]]/route.ts`):**
   - Atualização do schema Zod para aceitar todos os eventos emitidos pelo frontend (`booking_page_view`, `public_profile_view`, `service_selected`, `professional_selected`, `date_selected`, `time_selected`, `booking_confirmation_viewed`, `checkout_started`, `booking_completed`), normalizando a contagem de acessos.

5. **Observabilidade com `instrumentation.ts` (`src/instrumentation.ts`):**
   - Implementado hook nativo `onRequestError` do Next.js para capturar e registrar imediatamente no console do servidor qualquer erro de renderização SSR, rota ou middleware, com stack trace completo e digest.

6. **Parse Resiliente do PageBuilder:**
   - Envolvido em `try/catch` defensivo para garantir que layouts personalizados corrompidos nunca impeçam o carregamento do catálogo padrão.

---

## 4. Testes e Validação de Ponta a Ponta

- **Simulação Real do Estabelecimento (`Moa Tattoo` / `tatto-aoxg`):**
  - Catálogo público carregado: `Moa Tattoo`, Serviços: `Tatuagem Flash (até 10cm)`, Profissionais: `Moa`, Locais: `Estúdio Principal`.
  - Agendamento completo realizado com sucesso (Booking ID gerado e confirmado no banco de dados).
- **Suíte de Testes Automatizados:**
  - `tests/public-booking.test.ts`: Testes de resolução de slug, maiúsculas, espaços, ID direto e layouts corrompidos.
  - `tests/browser/public-booking.spec.ts`: Testes Playwright de navegação direta à rota `/agendar/[slug]` e 404 sem erro de página.
  - **Resultado:** 143 testes aprovados (100% pass).
- **Verificação Estática de Tipos:**
  - `npm run typecheck`: 0 erros de compilação.
- **Verificação de Servidor Local:**
  - `GET /agendar/tatto-aoxg` → HTTP 200 (Title: `Agendar com Moa Tattoo | Reservei`).
  - `POST /api/public/tatto-aoxg/events` → HTTP 200 (Contabilização do funil funcionando).

---

## 5. Recomendações de Monitoramento Contínuo

1. **Observabilidade em Produção (Sentry):**
   - Configurar `@sentry/nextjs` acoplado ao `instrumentation.ts` para capturar exceções não tratadas no SSR e disparar alertas em tempo real.
2. **Synthetic Uptime Monitoring:**
   - Configurar ping sintético a cada 5 minutos nas rotas `/agendar/[slug]` dos estabelecimentos modelo para assegurar SLA de 99.99%.
