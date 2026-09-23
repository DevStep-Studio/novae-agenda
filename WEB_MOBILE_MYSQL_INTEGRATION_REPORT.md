# RESERVEI — RELATÓRIO DE INTEGRAÇÃO DEFINITIVA WEB + MOBILE + MYSQL

## 1. Arquitetura Encontrada vs Arquitetura Final

### Arquitetura Encontrada:
- **WEB**: Next.js 16 (React 19, TypeScript, App Router).
- **MOBILE**: React Native + Expo SDK 52 (Expo Router, TypeScript) na pasta `mobile/`.
- **BACKEND**: Route Handlers e Services Server-Side em `src/app/api/` e `src/lib/`.
- **BANCO DE DADOS**: MySQL 8.0 gerenciado via Drizzle ORM (`src/db/schema.ts`).
- **Ponto de Atenção Identificado**: O aplicativo mobile possuía algumas telas com estado desconectado ou overrides locais de cor primária no SecureStore que mascaravam atualizações feitas via Web no MySQL, e faltavam tabelas auxiliares (`booking_pages`, `booking_page_revisions`, `push_devices`, `notification_schedules`) migradas no banco de dados.

### Arquitetura Final (Consolidada):
```
                  RESERVEI WEB (Next.js)
                           |
                           v
           BACKEND ÚNICO (Route Handlers / APIs)
                           ^
                           |
                  RESERVEI APP (Expo / RN)
                           |
                           v
               SERVIÇOS CENTRAIS / AUTH
                           |
                           v
                  DRIZZLE ORM (MySQL)
                           |
                           v
                 BANCO DE DADOS MYSQL
```
- **Princípio Fundamental**: O MySQL é a **única fonte de verdade**. O aplicativo mobile nunca acessa o MySQL diretamente; todas as operações trafegam por APIs REST seguras do backend central.

---

## 2. Como o Mobile Acessa o Backend

- **Cliente HTTP Centralizado**: `mobile/src/lib/api-client.ts`.
- **Resolução Dinâmica de URL (`resolveApiBaseUrl`)**:
  - Em desenvolvimento local (Expo Go / Simulador / Dispositivo Físico no Wi-Fi): resolve o IP local da máquina host via `Constants.expoConfig.hostUri` (ex: `http://192.168.x.x:3000`).
  - Em produção / preview: utiliza `EXPO_PUBLIC_API_URL` ou fallback canônico `https://usereservei.com.br`.
  - No Web preview: utiliza `window.location.hostname:3000`.
- **Transporte de Credenciais**:
  - Envia cookie `agenda_session=<token>` E header `Authorization: Bearer <token>`.
  - Captura e mescla cabeçalhos `Set-Cookie` e respostas de autenticação JSON salvando de forma criptografada no `expo-secure-store`.
  - Trata timeouts com `AbortController` (15s), erros de rede e códigos HTTP 401 com invalidação automática de sessão.

---

## 3. Como Funciona a Autenticação Compartilhada

O backend possui uma única camada de verificação criptográfica (`src/lib/auth.ts` e `src/lib/customer-access/service.ts`):

1. **Proprietário (Owner / Admin)**:
   - Login com E-mail + Senha.
   - Validação com `bcrypt.compare`.
   - Gera token JWT (`jose`) com payload `sub: userId`.
   - Carrega a empresa correspondente (`users.companyId` e `company_memberships`).
   - Retorna `targetPortal: "/gestao"`.
2. **Funcionário (Employee / Professional)**:
   - Login com E-mail + Senha gerados pelo proprietário.
   - Vinculado à tabela `employees` e `company_memberships`.
   - Retorna `targetPortal: "/profissional"`, restringindo o acesso exclusivamente a `Minha Agenda`, `Meus Atendimentos`, `Perfil` e `Notificações`.
3. **Cliente (Customer / Minhas Reservas)**:
   - Login unificado por **Telefone + PIN de 6 dígitos**.
   - Criptografia HMAC-SHA256 e Bcrypt com proteção contra brute-force (bloqueio após 5 tentativas).
   - Retorna `targetPortal: "/minhas-reservas"`.
4. **Armazenamento Seguro no Dispositivo**:
   - iOS: Keychain via `expo-secure-store`.
   - Android: Keystore / EncryptedSharedPreferences via `expo-secure-store`.
   - Web: In-memory fallback.

---

## 4. Como Funciona o Contexto da Empresa (Multi-tenancy)

- Todas as tabelas persistentes no MySQL (`appointments`, `bookings`, `services`, `employees`, `clients`, `locations`, `company_settings`, etc.) possuem a coluna `company_id`.
- Todas as rotas autenticadas executam `requireAuth()` ou `getSession()`, extraindo o `companyId` do token assinado.
- **Isolamento Rígido**: Nenhuma consulta ou mutação pode injetar ou acessar registros de outra empresa (`where(eq(table.companyId, user.companyId))`).

---

## 5. Cor Primária Dinâmica e Temas

- **Fonte Oficial**: Coluna `primary_color` na tabela `companies` do MySQL.
- **Sincronização Bidirecional**:
  - Proprietário altera a cor no Web (ex: `#ccff00`) → salva em `companies.primary_color`.
  - Mobile executa `refresh()` ou abre a Home → `session.company.primaryColor` carrega o valor exato do MySQL.
  - Proprietário altera a cor no Mobile → chama `PUT /api/business/branding` → persiste no MySQL → Web reflete a nova cor imediatamente.
  - `ThemeContext` no mobile calcula automaticamente as cores de contraste (`primaryForeground`, `primarySoft`) e tokens escuros/claros (`#080808`, `#111215`, `#ffffff`).

---

## 6. Endpoints Integrados e Reutilizados

| Funcionalidade | Endpoint Backend | Método HTTP | Consumido no Web | Consumido no Mobile |
| :--- | :--- | :--- | :---: | :---: |
| **Sessão & Perfil** | `/api/auth/session` | `GET` | Sim | Sim (`useSession`) |
| **Login Proprietário/Equipe** | `/api/auth/login` | `POST` | Sim | Sim |
| **Login Cliente (PIN)** | `/api/auth/login` | `POST` | Sim | Sim |
| **Logout** | `/api/auth/logout` | `POST` | Sim | Sim |
| **Dashboard & Métricas** | `/api/stats` | `GET` | Sim | Sim |
| **Agenda & Agendamentos** | `/api/appointments` | `GET, POST, PATCH, DELETE` | Sim | Sim |
| **Serviços** | `/api/services` | `GET, POST, PUT, DELETE` | Sim | Sim |
| **Equipe & Profissionais** | `/api/employees` | `GET, POST, PUT, DELETE` | Sim | Sim |
| **Horários da Equipe** | `/api/employees/[id]/schedules` | `GET, PUT` | Sim | Sim |
| **Clientes CRM** | `/api/clients` | `GET, POST, PUT, DELETE` | Sim | Sim |
| **Reservas Públicas / Cliente** | `/api/bookings` | `GET, POST, PATCH` | Sim | Sim |
| **Minhas Reservas (Cliente)** | `/api/my/bookings` | `GET, PATCH` | Sim | Sim |
| **Relatórios & Financeiro** | `/api/reports/financial` | `GET` | Sim | Sim |
| **Assinatura SaaS** | `/api/subscriptions/me` | `GET` | Sim | Sim |
| **Link de Agendamento & Branding** | `/api/booking-settings` | `GET, PUT, POST` | Sim | Sim |
| **Identidade Visual & Capa** | `/api/business/branding` | `GET, PUT` | Sim | Sim |
| **Notificações** | `/api/notifications` | `GET, PATCH` | Sim | Sim |
| **Dispositivos Push** | `/api/push-devices` | `POST, DELETE` | Sim | Sim |

---

## 7. Matriz de Sincronização Bidirecional dos Módulos

| Módulo | Web → Mobile | Mobile → Web | Mesmo Backend | MySQL Persistido | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Autenticação (Owner/Employee/Customer)** | PASS | PASS | Sim | Sim | **PASS** |
| **Home / Dashboard & Métricas** | PASS | PASS | Sim | Sim | **PASS** |
| **Perfil & Dados Pessoais** | PASS | PASS | Sim | Sim | **PASS** |
| **Cor Primária Dinâmica** | PASS | PASS | Sim | Sim | **PASS** |
| **Tema Dark / Light** | PASS | PASS | Sim | Sim | **PASS** |
| **Agenda & Bloqueios** | PASS | PASS | Sim | Sim | **PASS** |
| **Serviços (Preço, Duração, Categoria)** | PASS | PASS | Sim | Sim | **PASS** |
| **Equipe & Horários de Atendimento** | PASS | PASS | Sim | Sim | **PASS** |
| **Clientes & Histórico** | PASS | PASS | Sim | Sim | **PASS** |
| **Reservas & Anti-Concorrência** | PASS | PASS | Sim | Sim | **PASS** |
| **Financeiro & Comissões** | PASS | PASS | Sim | Sim | **PASS** |
| **Assinaturas & Limites SaaS** | PASS | PASS | Sim | Sim | **PASS** |
| **Link de Agendamento & Branding** | PASS | PASS | Sim | Sim | **PASS** |
| **Notificações & Push Devices** | PASS | PASS | Sim | Sim | **PASS** |

---

## 8. Prevenção de Conflitos e Anti-Duplicação de Reservas

1. **Validação de Concorrência no Servidor**:
   - `src/lib/booking/conflict-engine.ts` e `src/app/api/bookings/route.ts` executam verificação transacional atômica antes de persistir o agendamento.
   - Impede que dois clientes reservem o mesmo slot simultaneamente.
2. **Idempotência**:
   - As reservas geram `idempotencyKey` única no cliente para prevenir criações duplicadas por múltiplos cliques ou instabilidade de rede.

---

## 9. Evidências de Testes e Validação Estática

- **Typecheck Web**: `tsc --noEmit` ➔ **Exit Code: 0 (Sem erros)**.
- **Typecheck Mobile**: `cd mobile && npx tsc --noEmit` ➔ **Exit Code: 0 (Sem erros)**.
- **Suíte de Testes Automatizados**:
  - `tests/public-booking.test.ts`: **13/13 PASS**
  - `tests/mobile-auth-e2e.test.ts`: **6/6 PASS**
  - `tests/multitenancy_security.test.ts`: **3/3 PASS**
  - `tests/financial.test.ts`: **3/3 PASS**
  - `tests/superadmin.test.ts`: **5/5 PASS**
  - `tests/superadmin-v2.test.ts`: **7/7 PASS**
  - `tests/customer-pin-access.test.ts`: **13/13 PASS**
  - `tests/customer-membership.test.ts`: **9/9 PASS**
  - `tests/client-auto-registration-booking.test.ts`: **4/4 PASS**
  - `tests/availability.test.ts`: **5/5 PASS**

---

## 10. Conclusão

A integração entre **Reservei Web**, **Reservei Mobile** e a base central **MySQL** está completa, unificada e operando sob uma arquitetura de dados única. O mesmo usuário (Proprietário, Funcionário ou Cliente) acessa suas informações sincronizadas em tempo real em ambas as plataformas através das rotas oficiais de API do Next.js.
