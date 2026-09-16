# RESERVEI — MATRIZ DE ACESSO POR PERFIL (ROLE ACCESS MATRIX)

Esta matriz detalha as permissões, rotas e níveis de autorização para os três perfis principais (**Cliente**, **Proprietário**, **Funcionário**) e o **Superadmin**.

---

## 1. MATRIZ DE FUNCIONALIDADES E RECURSOS

| Funcionalidade / Recurso | Público | Cliente (Customer) | Proprietário (Owner) | Funcionário (Professional) | Superadmin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Catálogo Público de Serviços** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Agendamento Online com PIN** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Portal de Minhas Reservas** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Remarcar / Cancelar Própria Reserva** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Exportar para Calendário (.ics)** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Dashboard de Gestão da Empresa** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Agenda / Calendário Geral da Empresa** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Minha Agenda (Atendimentos Próprios)** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Ações Operacionais (Chegou / Iniciar / Finalizar)** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Gestão de Clientes (CRM Geral)** | ❌ | ❌ | ✅ | ❌ *(Apenas próprios)* | ✅ |
| **Gestão de Serviços e Preços** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Gestão de Equipe / Criar Funcionários** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Módulo Financeiro (Faturamento / Caixa)** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Relatórios e Métricas Avançadas** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Assinatura SaaS e Faturas** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Configurações e Branding da Empresa** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Notificações** | ❌ | ✅ *(Suas reservas)* | ✅ *(Gerais da empresa)* | ✅ *(Seus atendimentos)* | ✅ |
| **Perfil e Foto** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Administração Global do SaaS** | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 2. MATRIZ DE ROTAS (FRONTEND APP ROUTER)

| Rota | Público | Cliente | Proprietário | Funcionário | Guard / Destino |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `/agendar/[slug]` | ✅ | ✅ | ✅ | ✅ | Rota pública de agendamento |
| `/minhas-reservas` | ❌ | ✅ | ❌ | ❌ | `requireCustomer()` / `CustomerAuth` |
| `/cliente` *(Legado)* | ❌ | ➡️ | ➡️ | ➡️ | Redireciona 301 para `/minhas-reservas` |
| `/meus-agendamentos` *(Legado)* | ❌ | ➡️ | ➡️ | ➡️ | Redireciona 301 para `/minhas-reservas` |
| `/onboarding` | ❌ | ❌ | ✅ *(Incompleto)* | ❌ | Redireciona se `company.onboarded === false` |
| `/gestao` | ❌ | ❌ | ✅ | ❌ | `requireOwner()` / `requireRole("manager")` |
| `/gestao/agenda` | ❌ | ❌ | ✅ | ❌ | Painel central de reservas da empresa |
| `/gestao/clientes` | ❌ | ❌ | ✅ | ❌ | CRM de clientes da empresa |
| `/gestao/servicos` | ❌ | ❌ | ✅ | ❌ | Catálogo de serviços |
| `/gestao/equipe` | ❌ | ❌ | ✅ | ❌ | Gerenciamento de profissionais |
| `/gestao/financeiro` | ❌ | ❌ | ✅ | ❌ | Módulo financeiro e fechamento de caixa |
| `/gestao/relatorios` | ❌ | ❌ | ✅ | ❌ | Relatórios gerenciais |
| `/gestao/assinatura` | ❌ | ❌ | ✅ | ❌ | Planos SaaS e pagamento de assinatura |
| `/gestao/configuracoes` | ❌ | ❌ | ✅ | ❌ | Configurações gerais da empresa |
| `/profissional` | ❌ | ❌ | ✅ | ✅ | `requireEmployee()` / Portal Operacional |
| `/admin` | ❌ | ❌ | ❌ | ❌ | `requireSuperAdmin()` / Superadmin |

---

## 3. MATRIZ DE APIS (ROUTE HANDLERS)

| Endpoint | Método | Papel Mínimo | Escopo e Validação |
| :--- | :---: | :--- | :--- |
| `/api/public/[slug]/...` | `GET/POST` | Público | Consulta de catálogo, disponibilidade e orçamentos. |
| `/api/customer-access/pin/login` | `POST` | Público | Autenticação por Celular + PIN (Rate limit + Lockout). |
| `/api/customer-access/pin/setup` | `POST` | Público | Cadastro obrigatório de PIN de 6 dígitos. |
| `/api/customer-access/check-phone` | `POST` | Público | Identifica estado do cliente (`HAS_PIN` / `NEEDS_PIN_SETUP`). |
| `/api/bookings` | `POST` | Cliente | Criação de reserva (exige PIN ativo no usuário). |
| `/api/my/bookings` | `GET` | Cliente | Lista exclusivamente as reservas do `user.id`. |
| `/api/my/bookings/[id]` | `GET/POST` | Cliente | Detalhes, cancelamento ou reagendamento do `user.id`. |
| `/api/appointments` | `GET/POST` | Funcionário / Owner | Funcionário: `employeeId = user.employeeId`; Owner: `companyId = user.companyId`. |
| `/api/appointments/[id]` | `PATCH` | Funcionário / Owner | Atualização de status operacional do atendimento. |
| `/api/employees` | `GET/POST` | Owner / Manager | Criação de funcionários (proibido para funcionário e público). |
| `/api/services` | `GET/POST/PUT` | Owner / Manager | Catálogo da empresa do Owner. |
| `/api/financial/...` | `GET/POST` | Owner / Manager | Métricas financeiras e fluxo de caixa da empresa. |
| `/api/saas/subscription/...` | `GET/POST` | Owner | Assinatura SaaS da empresa. |
| `/api/superadmin/...` | `GET/POST` | Superadmin | Administração global de empresas e assinaturas. |
