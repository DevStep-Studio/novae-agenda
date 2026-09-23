# WEB_MOBILE_DATA_CONTRACT_MATRIX.md

## Matriz Canônica de Contratos de Dados (Web ↔ Mobile ↔ MySQL)

| Módulo / Funcionalidade | Web Source / Endpoint | Mobile Source / Endpoint | Shared Service / Handler | Company Context | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sessão & Identidade** | `GET /api/auth/session` | `GET /api/auth/session` | `getSession()`, `src/lib/auth.ts` | `auth.user.companyId` | **PASS** |
| **Login Proprietário** | `POST /api/auth/login` | `POST /api/auth/login` | `createSession()`, `src/lib/auth.ts` | Resolvido via `users.companyId` / `companyMemberships` | **PASS** |
| **Login Funcionário** | `POST /api/auth/login` | `POST /api/auth/login` | `createSession()`, `src/lib/auth.ts` | `employees.companyId` | **PASS** |
| **Login Cliente (PIN)** | `POST /api/auth/login` | `POST /api/auth/login` | `CustomerAccessService.loginWithPin` | Global / Multi-tenant isolado | **PASS** |
| **Equipe / Profissionais**| `GET /api/employees` | `GET /api/employees` | `src/app/api/employees/route.ts` | `eq(employees.companyId, auth.user.companyId)` | **PASS** |
| **Serviços** | `GET /api/services` | `GET /api/services` | `src/app/api/services/route.ts` | `eq(services.companyId, auth.user.companyId)` | **PASS** |
| **Clientes** | `GET /api/clients` | `GET /api/clients` | `src/app/api/clients/route.ts` | `eq(clients.companyId, auth.user.companyId)` | **PASS** |
| **Agenda / Agendamentos**| `GET /api/appointments` | `GET /api/appointments` | `src/app/api/appointments/route.ts` | `eq(appointments.companyId, auth.user.companyId)` | **PASS** |
| **Reservas Públicas** | `POST /api/bookings` | `POST /api/bookings` | `src/lib/booking/conflict-engine.ts` | `bookings.companyId` com trava de concorrência | **PASS** |
| **Financeiro & Métricas**| `GET /api/stats` | `GET /api/stats` | `src/app/api/stats/route.ts` | `eq(appointments.companyId, auth.user.companyId)` | **PASS** |
| **Branding & Capa** | `GET /api/auth/session` | `GET /api/auth/session` | `companySettings` (`coverUrl`, `banner_url`) | `eq(companySettings.companyId, auth.user.companyId)` | **PASS** |
| **Cor Primária Dinâmica**| `companies.primaryColor` | `companies.primaryColor` | `ThemeContext` & `companies` table | Sincronizado dinamicamente com `#f5f5f5` / `#dcff4c` | **PASS** |
| **Link de Agendamento** | `companies.publicSlug` | `companies.publicSlug` | `SessionInfo.company.publicSlug` (`tatto-aoxg`) | Canônico persistido no MySQL | **PASS** |
| **Notificações** | `GET /api/notifications` | `GET /api/notifications`| `src/app/api/notifications/route.ts` | `eq(notifications.companyId, auth.user.companyId)` | **PASS** |
