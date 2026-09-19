# Matriz de Paridade de APIs (Backend MySQL ↔ Aplicativo Mobile)

> **Regra Fundamental:** O aplicativo mobile consome exclusivamente as APIs REST do Next.js 16 autenticadas via Bearer Token e Cookies de Sessão, persistindo dados no MySQL através do Drizzle ORM.

---

## 1. Endpoints de Autenticação & Sessão

| Endpoint | Método | Descrição | Consumido no Mobile por | Status |
| :--- | :--- | :--- | :--- | :--- |
| `/api/auth/login` | POST | Login unificado (Owner, Employee, Admin) com credenciais ou PIN | `mobile/src/lib/auth.ts` (`login()`) | 🟢 Ativo |
| `/api/auth/session` | GET | Retorna sessão ativa, empresa vinculada, plano, limites e permissões | `mobile/src/lib/session-context.tsx` | 🟢 Ativo |
| `/api/auth/logout` | POST | Invalidação de sessão no servidor | `mobile/src/lib/session-context.tsx` (`signOut()`) | 🟢 Ativo |
| `/api/customer-access/verify` | POST | Validação de celular do cliente e checagem de PIN/OTP | `mobile/src/app/(auth)/customer-access.tsx` | 🟢 Ativo |
| `/api/customer-access/pin` | POST | Criação ou redefinição de PIN seguro do cliente | `mobile/src/app/(auth)/customer-access.tsx` | 🟢 Ativo |

---

## 2. Endpoints Operacionais & Gestão (Owner / Employee)

| Endpoint | Método | Descrição | Consumido no Mobile por | Status |
| :--- | :--- | :--- | :--- | :--- |
| `/api/stats/overview` | GET | Métricas do dashboard (Faturamento, Agendamentos, Ticket Médio, Novos Clientes) | `mobile/src/app/(owner)/index.tsx` | 🟢 Ativo |
| `/api/appointments` | GET / POST | Consulta e criação de agendamentos na grade da agenda | `mobile/src/app/(owner)/agenda.tsx`, `mobile/src/app/(employee)/index.tsx` | 🟢 Ativo |
| `/api/appointments/[id]` | PATCH / DELETE | Atualização de status (Confirmado, Em atendimento, Concluído, Cancelado) | `mobile/src/app/(owner)/agenda.tsx` | 🟢 Ativo |
| `/api/blocks` | POST / DELETE | Bloqueio de horários (almoço, folga, indisponibilidade) | `mobile/src/app/(owner)/agenda.tsx` | 🟢 Ativo |
| `/api/clients` | GET / POST | Listagem, busca instantânea e criação de novos clientes | `mobile/src/app/(owner)/clientes.tsx` | 🟢 Ativo |
| `/api/clients/[id]` | GET / PATCH / DELETE | Detalhes, histórico de visitas, atualização cadastral e exclusão segura | `mobile/src/app/(owner)/clientes.tsx` | 🟢 Ativo |
| `/api/services` | GET / POST | Listagem e cadastro de serviços do catálogo | `mobile/src/app/(owner)/servicos.tsx` | 🟢 Ativo |
| `/api/services/[id]` | PATCH / DELETE | Edição de preços, duração, categoria e exclusão de serviços | `mobile/src/app/(owner)/servicos.tsx` | 🟢 Ativo |
| `/api/employees` | GET / POST | Listagem e cadastro de profissionais na equipe | `mobile/src/app/(owner)/equipe.tsx` | 🟢 Ativo |
| `/api/employees/[id]` | PATCH / DELETE | Edição de horários, comissões, serviços atribuídos e desativação | `mobile/src/app/(owner)/equipe.tsx` | 🟢 Ativo |
| `/api/profile` | GET / PATCH | Customização da identidade visual da empresa (Banner, Logo, Cores, Widgets) | `mobile/src/app/(owner)/perfil.tsx` | 🟢 Ativo |
| `/api/subscriptions` | GET / POST | Consulta de plano SaaS, limites de equipe, tempo de trial (7 dias) e faturas | `mobile/src/app/(owner)/assinatura.tsx` | 🟢 Ativo |
| `/api/booking-settings` | GET / PATCH | Configurações avançadas de agendamento (intervalos, antecedência, regras) | `mobile/src/app/(owner)/configuracoes.tsx` | 🟢 Ativo |
| `/api/notifications` | GET / POST | Central de avisos, filtros e marcação em lote como lidas | `mobile/src/components/ui/top-bar.tsx`, `mobile/src/app/(owner)/notificacoes.tsx` | 🟢 Ativo |
| `/api/push-devices` | POST / DELETE | Registro e cancelamento de tokens de push nativos (APNs / FCM) | `mobile/src/lib/push-notifications.ts` | 🟢 Ativo |

---

## 3. Endpoints do Cliente & Agendamento Público

| Endpoint | Método | Descrição | Consumido no Mobile por | Status |
| :--- | :--- | :--- | :--- | :--- |
| `/api/my/appointments` | GET | Consulta de histórico e próximas reservas do cliente autenticado via PIN | `mobile/src/app/(customer)/index.tsx` | 🟢 Ativo |
| `/api/public/[slug]` | GET | Consulta de dados públicos da empresa para página de agendamento | Deep Link & Webview Nativa | 🟢 Ativo |
| `/api/availability` | GET | Cálculo de slots de horários livres em tempo real | Módulo de Agendamento | 🟢 Ativo |
| `/api/bookings` | POST | Criação de reserva pública com validação de concorrência | Módulo de Agendamento | 🟢 Ativo |
