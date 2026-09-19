# Inventário Completo de Rotas e Páginas Web (Reservei)

> **Data da Auditoria:** 19 de Setembro de 2026  
> **Referência Oficial de Produto:** Next.js 16 (App Router) + Drizzle ORM + MySQL  
> **Status:** Ativo e Mapeado

---

## 1. Rotas Públicas e de Autenticação

| Rota Web | Perfil Autorizado | Objetivo & Funcionalidades | Componentes & Views | APIs Utilizadas | Rota Mobile Equivalente | Status Mobile |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/login` | Anônimo / Todos | Login unificado (Proprietário, Funcionário, Super Admin). PIN para clientes. | `src/app/login/page.tsx`, `AuthSplitLayout` | `POST /api/auth/login`, `GET /api/auth/session` | `/(auth)/login` | ✅ Implementado |
| `/cliente` | Cliente | Acesso do cliente com Celular + PIN, solicitação de OTP, recuperação de PIN. | `src/app/cliente/page.tsx` | `POST /api/customer-access/verify`, `POST /api/customer-access/pin` | `/(auth)/customer-access` | ✅ Implementado |
| `/agendar/[slug]` | Público / Cliente | Fluxo completo de agendamento público: Identidade, Serviços, Categorias, Profissionais, Calendário, Horários, Dados e PIN. | `src/app/agendar/[slug]/page.tsx`, `src/components/booking/booking-flow.tsx` | `GET /api/public/[slug]`, `GET /api/availability`, `POST /api/bookings` | Deep Link / WebView / Nativo | ⚠️ Parcial |
| `/minhas-reservas` | Cliente | Histórico de agendamentos do cliente autenticado por PIN, status, cancelamento e remarcação. | `src/app/minhas-reservas/page.tsx`, `MyBookings` | `GET /api/my/appointments`, `PATCH /api/appointments/[id]` | `/(customer)/index` | ✅ Implementado |
| `/termos` | Público | Termos de uso e políticas de serviço. | `src/app/termos/page.tsx` | N/A (Estático) | `/(owner)/ajuda` / Link | ✅ Equivalente |
| `/privacidade` | Público | Política de privacidade e conformidade LGPD. | `src/app/privacidade/page.tsx` | N/A (Estático) | `/(owner)/ajuda` / Link | ✅ Equivalente |
| `/cancelamento-reembolso` | Público | Políticas de cancelamento e no-show. | `src/app/cancelamento-reembolso/page.tsx` | N/A (Estático) | `/(owner)/ajuda` / Link | ✅ Equivalente |

---

## 2. Rotas do Proprietário / Gestão (`/gestao/[view]`)

| Rota Web (`/gestao/...`) | Objetivo & Funcionalidades | Componentes Web | APIs Utilizadas | Rota Mobile Equivalente | Status Mobile |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/gestao` (dashboard) | Visão geral diária, faturamento hoje, próximos atendimentos, checklist onboarding, atalhos rápidos e KPIs. | `src/components/app-shell.tsx` (Dashboard View) | `GET /api/stats/overview`, `GET /api/appointments/today` | `/(owner)/index` | ✅ Implementado |
| `/gestao/agenda` | Agenda interativa multi-profissional, modos Dia/Semana/Mês, bloqueio de horários, novo agendamento, status. | `src/components/app-shell.tsx` (Agenda View) | `GET /api/appointments`, `POST /api/appointments`, `PATCH /api/appointments/[id]`, `POST /api/blocks` | `/(owner)/agenda` | ✅ Implementado |
| `/gestao/clientes` | CRM de clientes, busca instantânea, histórico de visitas, total gasto, WhatsApp, edição, exclusão segura. | `src/components/app-shell.tsx` (Clientes View) | `GET /api/clients`, `POST /api/clients`, `PATCH /api/clients/[id]`, `DELETE /api/clients/[id]` | `/(owner)/clientes` | ✅ Implementado |
| `/gestao/servicos` | Catálogo de serviços, criação, edição, categorias, preços, duração, profissionais vinculados e exclusão. | `src/components/app-shell.tsx` (Serviços View) | `GET /api/services`, `POST /api/services`, `PATCH /api/services/[id]`, `DELETE /api/services/[id]` | `/(owner)/servicos` | ✅ Implementado |
| `/gestao/equipe` | Gestão de colaboradores, horários de trabalho, comissões, serviços atribuídos, convites e desativação. | `src/components/app-shell.tsx` (Equipe View) | `GET /api/employees`, `POST /api/employees`, `PATCH /api/employees/[id]`, `DELETE /api/employees/[id]` | `/(owner)/equipe` | ✅ Implementado |
| `/gestao/financeiro` | Fluxo de caixa, receitas, despesas, métodos de pagamento, conciliação e métricas financeiras. | `src/components/app-shell.tsx` (Financeiro View) | `GET /api/reports/financial`, `POST /api/transactions` | `/(owner)/financeiro` | ✅ Implementado |
| `/gestao/relatorios` | Relatórios de desempenho, taxas de ocupação, clientes fiéis, serviços mais vendidos e exportações CSV/PDF. | `src/components/reports/reports-view.tsx` | `GET /api/reports/overview`, `GET /api/reports/export` | `/(owner)/relatorios` | ✅ Implementado |
| `/gestao/notificacoes` | Central de avisos, push notifications, status de lembretes WhatsApp e marcação de lidas. | `src/components/notifications/notifications-view.tsx` | `GET /api/notifications`, `POST /api/notifications` | `/(owner)/notificacoes` | ✅ Implementado |
| `/gestao/perfil` | Personalização da marca (Logo, Banner, Cores, Paletas, Slugs, Widgets do Dashboard). | `src/components/app-shell.tsx` (Perfil View) | `GET /api/profile`, `PATCH /api/profile` | `/(owner)/perfil` | ✅ Implementado |
| `/gestao/assinatura` | Gestão do plano SaaS Reservei, limites de equipe, trial de 7 dias, faturas e cancelamento. | `src/components/subscriptions/subscription-view.tsx` | `GET /api/subscriptions`, `POST /api/subscriptions` | `/(owner)/assinatura` | ✅ Implementado |
| `/gestao/configuracoes` | Parâmetros de funcionamento, intervalo de agendamento, antecedência mínima, regras de cancelamento. | `src/components/booking/booking-settings.tsx` | `GET /api/booking-settings`, `PATCH /api/booking-settings` | `/(owner)/configuracoes` | ✅ Implementado |
| `/gestao/link-agendamento`| Prévia da página de agendamento público e link direto para compartilhamento. | `src/components/app-shell.tsx` | `GET /api/company` | `/(owner)/mais` | ✅ Implementado |

---

## 3. Rotas do Colaborador / Funcionário (`/profissional`)

| Rota Web | Objetivo & Funcionalidades | Componentes Web | APIs Utilizadas | Rota Mobile Equivalente | Status Mobile |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/profissional` | Painel do colaborador com agenda própria, próximos clientes, status de atendimento e notificações. | `src/app/profissional/page.tsx` | `GET /api/appointments?employeeId=...`, `PATCH /api/appointments/[id]/status` | `/(employee)/index` | ✅ Implementado |
| `/profissional` (clientes) | Consulta de histórico dos clientes atendidos pelo profissional. | `src/app/profissional/page.tsx` | `GET /api/clients?employeeId=...` | `/(employee)/clientes` | ✅ Implementado |
| `/profissional` (avisos) | Central de notificações de novos agendamentos atribuídos ao profissional. | `src/app/profissional/page.tsx` | `GET /api/notifications` | `/(employee)/notificacoes` | ✅ Implementado |

---

## 4. Rotas de Administração Global (`/admin` - Super Admin)

| Rota Web | Objetivo & Funcionalidades | Componentes Web | APIs Utilizadas | Rota Mobile Equivalente | Status Mobile |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/admin` | Backoffice master: estatísticas globais, empresas cadastradas, assinaturas, PINs, suspensão e cupons. | `src/app/admin/page.tsx`, `SuperAdminDashboard` | `GET /api/superadmin/stats`, `GET /api/superadmin/companies`, `POST /api/superadmin/companies` | Web-First / Módulo Restrito | ⚠️ Planejado |
