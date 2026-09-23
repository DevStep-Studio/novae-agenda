# MATRIZ DE FUNCIONALIDADES E PARIDADE WEB ↔ MOBILE (RESERVEI SAAS)
**Data:** 23 de Setembro de 2026  
**Status:** Auditado & Validado  
**Fonte da Verdade:** Backend Next.js + MySQL (Drizzle ORM)  

---

## 1. Matriz Completa de Endpoints, Telas e Permissões

| Módulo / Funcionalidade | Rota Web | Rota Mobile | Endpoint Backend | Permissão Exigida | Testado | Status |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **Login Proprietário** | `/login` | `/(auth)/login` | `POST /api/auth/login` | Público | ✅ | PASS |
| **Login Funcionário** | `/login` | `/(auth)/login` | `POST /api/auth/login` | Público | ✅ | PASS |
| **Autenticação Cliente (PIN)** | `/cliente` | `/(auth)/customer-access` | `POST /api/customer-access/pin/login` | Público | ✅ | PASS |
| **Criação de PIN (2x Validação)** | `/cliente` | `/(auth)/customer-access` | `POST /api/customer-access/pin/setup` | Público / Cliente | ✅ | PASS |
| **Recuperação de PIN Seguro** | `/cliente` | `/(auth)/customer-access` | `POST /api/customer-access/pin/reset/*` | Cliente | ✅ | PASS |
| **Verificação de E-mail (Owner)** | `/verify-email` | Deep Link / Web | `GET/POST /api/auth/verify-email` | Owner | ✅ | PASS |
| **Sessão Persistente & Boot** | Layout / AppGate | `SessionContext` | `GET /api/auth/me` | Autenticado | ✅ | PASS |
| **Dashboard & Métricas** | `/gestao` | `/(owner)/index` | `GET /api/dashboard/stats` | Owner / Manager | ✅ | PASS |
| **Agenda (Criar/Editar/Status)**| `/gestao/agenda` | `/(owner)/agenda` | `GET/POST/PATCH /api/appointments` | Owner / Employee | ✅ | PASS |
| **Serviços (CRUD + Ativar)** | `/gestao/servicos` | `/(owner)/servicos` | `GET/POST/PATCH/DELETE /api/services` | Owner / Manager | ✅ | PASS |
| **Equipe & Horários de Trabalho**| `/gestao/equipe` | `/(owner)/equipe` | `GET/POST/PATCH /api/employees` | Owner / Admin | ✅ | PASS |
| **Clientes CRM & Histórico** | `/gestao/clientes` | `/(owner)/clientes` | `GET/POST/PATCH /api/clients` | Owner / Employee | ✅ | PASS |
| **Financeiro & Comissões** | `/gestao/financeiro`| `/(owner)/financeiro` | `GET /api/financial/summary` | Owner / Admin | ✅ | PASS |
| **Relatórios Gerenciais** | `/gestao/relatorios`| `/(owner)/relatorios` | `GET /api/reports/revenue` | Owner / Admin | ✅ | PASS |
| **Perfil & Branding da Empresa** | `/gestao/perfil` | `/(owner)/perfil` | `GET/PATCH /api/profile` | Owner | ✅ | PASS |
| **Página Pública de Agendamento**| `/agendar/[slug]` | `/agendar/[slug]` | `GET /api/public/[slug]` | Público | ✅ | PASS |
| **Universal Links (iOS)** | `/agendar/*` | Native Deep Link | `/.well-known/apple-app-site-association` | Público | ✅ | PASS |
| **App Links Verificados (Android)**| `/agendar/*` | Native Deep Link | `/.well-known/assetlinks.json` | Público | ✅ | PASS |
| **Assinatura SaaS (Web)** | `/planos` | Web Checkout | `POST /api/saas/subscription` | Owner | ✅ | PASS |
| **Assinatura In-App (Apple)** | N/A | `/(owner)/assinatura`| `POST /api/subscriptions/native/verify` | Owner | ✅ | PASS |
| **Assinatura Play Store (Google)**| N/A | `/(owner)/assinatura`| `POST /api/subscriptions/native/verify` | Owner | ✅ | PASS |
| **App Store Server Notifications**| N/A | N/A | `POST /api/webhooks/apple` | Apple Webhook | ✅ | PASS |
| **Google Play RTDN Pub/Sub** | N/A | N/A | `POST /api/webhooks/google` | Google Webhook| ✅ | PASS |
| **Central de Notificações** | `/notificacoes` | `/(owner)/notificacoes` | `GET/PATCH /api/notifications` | Autenticado | ✅ | PASS |
| **Push & Lembretes (24h/2h)** | Cron Worker | Push Dispatch | `GET /api/cron/booking-notifications` | Cron Secret | ✅ | PASS |
| **Exclusão de Conta / Privacidade**| `/gestao/perfil` | `/(owner)/perfil` | `DELETE /api/profile/account` | Owner / User | ✅ | PASS |

---

## 2. Garantias de Integridade

1. **Zero Mocks:** Toda requisição mobile consome estritamente o endpoint HTTP/HTTPS oficial.
2. **Mesma Camada de Dados:** Nenhuma regra é duplicada de forma divergente no frontend mobile.
3. **Escopo de Acesso:** Usuários funcionário (`employee`) e cliente (`customer`) não acessam rotas administrativas restritas.
