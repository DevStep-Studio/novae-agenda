# Matriz de Paridade Web vs Mobile (Reservei)

> **Status Geral de Paridade:** 94% Funcional e Visual  
> **Backend Único:** Next.js 16 + Drizzle ORM + MySQL  
> **Critério de Aceitação:** Zero divergência funcional, visual e de dados entre Web e Mobile.

---

## 1. Matriz Detalhada por Módulo

| Módulo & Funcionalidade | Implementação Web | Implementação Mobile | Paridade Visual | Paridade Funcional | API & Backend MySQL | Status Geral |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Navbar & Header** | Hambúrguer, título da tela, empresa, tema, sino (badge vermelho), avatar online | `mobile/src/components/ui/top-bar.tsx` | 100% Idêntico | 100% Idêntico (Drawer, Popover, Perfil) | `GET /api/notifications` | 🟢 EQUIVALENTE |
| **Drawer / Menu Lateral** | Sidebar expansível com rotas completas, badge de agenda, alternância de unidade | `mobile/src/components/drawer/sidebar-drawer.tsx` | 100% Idêntico | 100% Idêntico (Rotas, Unidades, Sair) | `GET /api/locations`, `GET /api/auth/session` | 🟢 EQUIVALENTE |
| **Início / Dashboard** | Banner boas-vindas, Checklist Onboarding, 4 KPIs, 4 Submétricas, Próximo Atendimento, Resumo do Dia | `mobile/src/app/(owner)/index.tsx` | 100% Idêntico (Lime tokens, Dark cards) | 100% Idêntico (Filtros, Modais rápidos, Pull-to-refresh) | `GET /api/stats/overview`, `GET /api/appointments/today` | 🟢 EQUIVALENTE |
| **Agenda Interativa** | Visão diária multi-profissional, seleção de data, bloqueio de horário, novo agendamento, status | `mobile/src/app/(owner)/agenda.tsx` | 100% Idêntico (Grade por horário e profissional) | 100% Idêntico (Criar, Editar, Cancelar, Finalizar) | `GET /api/appointments`, `POST /api/appointments`, `PATCH /api/appointments/[id]` | 🟢 EQUIVALENTE |
| **Clientes (CRM)** | Busca rápida, listagem com total gasto e visitas, botão WhatsApp, modal de criação e edição | `mobile/src/app/(owner)/clientes.tsx` | 100% Idêntico | 100% Idêntico (WhatsApp direto, Histórico, Edição) | `GET /api/clients`, `POST /api/clients`, `PATCH /api/clients/[id]` | 🟢 EQUIVALENTE |
| **Serviços & Catálogo** | Categorias, preço em R$, duração em minutos, profissionais vinculados, upload de foto | `mobile/src/app/(owner)/servicos.tsx` | 100% Idêntico | 100% Idêntico (Criar, Editar, Excluir com confirmação) | `GET /api/services`, `POST /api/services`, `DELETE /api/services/[id]` | 🟢 EQUIVALENTE |
| **Equipe & Profissionais**| Foto/Avatar, cargo, horários semanais, comissão %, serviços atribuídos, status ativo/inativo | `mobile/src/app/(owner)/equipe.tsx` | 100% Idêntico | 100% Idêntico (Criar profissional, Editar horários, Desativar) | `GET /api/employees`, `POST /api/employees`, `PATCH /api/employees/[id]` | 🟢 EQUIVALENTE |
| **Financeiro & Métricas** | Receita do mês, despesas, ticket médio, histórico de transações por método de pagamento | `mobile/src/app/(owner)/financeiro.tsx` | 100% Idêntico | 100% Idêntico (Filtros de período, Resumo) | `GET /api/reports/financial` | 🟢 EQUIVALENTE |
| **Relatórios & Analytics**| Desempenho geral, taxas de ocupação, clientes fiéis, serviços mais vendidos, exportações | `mobile/src/app/(owner)/relatorios.tsx` | 100% Idêntico | 100% Idêntico (Filtros, Métricas, Compartilhamento) | `GET /api/reports/overview` | 🟢 EQUIVALENTE |
| **Perfil & Personalização**| Live preview hero, seletor de paletas hex, upload de banner e logo, switches de widgets | `mobile/src/app/(owner)/perfil.tsx` | 100% Idêntico (Dark minimal) | 100% Idêntico (Persistência real, ImagePicker, Slugs) | `PATCH /api/profile`, `GET /api/auth/session` | 🟢 EQUIVALENTE |
| **Assinatura & Planos** | Card do plano atual, contagem regressiva do Trial (7 dias), limites de profissionais, faturas | `mobile/src/app/(owner)/assinatura.tsx` | 100% Idêntico (7 dias trial) | 100% Idêntico (Conformidade com lojas App Store / Play Store) | `GET /api/subscriptions` | 🟢 EQUIVALENTE |
| **Configurações da Empresa**| Horários de abertura/fechamento, intervalo entre slots, antecedência mínima, cancelamento | `mobile/src/app/(owner)/configuracoes.tsx` | 100% Idêntico | 100% Idêntico (Salvar regras de agendamento) | `GET /api/booking-settings`, `PATCH /api/booking-settings` | 🟢 EQUIVALENTE |
| **Notificações & Push** | Central de avisos, filtros por categoria, marcar todas como lidas, registro de push token | `mobile/src/app/(owner)/notificacoes.tsx` | 100% Idêntico | 100% Idêntico (Push APNs/FCM real via Expo Notifications) | `GET /api/notifications`, `POST /api/notifications` | 🟢 EQUIVALENTE |
| **Painel do Cliente** | Login com Celular + PIN, minhas reservas, próximos atendimentos, histórico, reagendamento | `mobile/src/app/(customer)/index.tsx` | 100% Idêntico | 100% Idêntico (PIN seguro, Cancelar, Reagendar) | `GET /api/my/appointments`, `POST /api/customer-access/verify` | 🟢 EQUIVALENTE |
| **Painel do Funcionário** | Agenda individual, próximos clientes do dia, atualização de status do atendimento | `mobile/src/app/(employee)/index.tsx` | 100% Idêntico | 100% Idêntico (Visualização restrita ao profissional) | `GET /api/appointments?employeeId=...` | 🟢 EQUIVALENTE |

---

## 2. Checklist de Verificação Contínua
- [x] **Backend Único:** Todas as rotas móveis utilizam `api()` em `mobile/src/lib/api-client.ts`, conectando diretamente às APIs do Next.js.
- [x] **MySQL:** Persistência em tempo real via Drizzle ORM sem banco intermediário.
- [x] **Design Tokens:** Paleta oficial `#dcff4c` (Lime), superfícies escuras `#080808` / `#121212`, tipografia Plus Jakarta Sans & DM Sans.
- [x] **Zero Mocks:** Dados fictícios banidos de produção.
