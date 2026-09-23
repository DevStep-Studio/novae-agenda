# Relatório de Unificação e Correção P0: Web + Mobile no Mesmo Backend, Autenticação, MySQL e Regras de Negócio

## 1. Causa Raiz do PIN Diferente

1. **HMAC Pepper Secret vs Fallback Bcrypt:**
   - O `CustomerAccessService.findCredentialByPin` calculava o hash indexado (`pinLookupHash`) utilizando HMAC-SHA256 do PIN com o `AUTH_SECRET`.
   - Se uma credencial não tinha `pinLookupHash` idêntico (por exemplo, se o secret do ambiente mudou ou na migração inicial), o código realizava busca apenas em `customerCredentials` onde `pinLookupHash IS NULL`. Credenciais com hashes anteriores eram ignoradas na busca indexada e não caíam no bcrypt, resultando na mensagem `"PIN não encontrado. Verifique os 6 números digitados."`.
   - **Correção Aplicada:** O método `findCredentialByPin` agora possui fallback universal com verificação bcrypt em todas as credenciais caso o hash indexado falhe, e realiza **auto-cura** imediata gravando o `pinLookupHash` atualizado para futuras buscas $O(1)$.
2. **Divergência de UX / Fluxo de Entrada:**
   - No **Web** (`src/components/auth/auth-screen.tsx`), a tela "Minhas Reservas" abria diretamente no passo de entrada de PIN de 6 dígitos (`pin_login`), permitindo ao cliente digitar seu PIN e autenticar instantaneamente via `POST /api/customer-access/pin/login`.
   - No **Mobile** (`mobile/src/app/(auth)/customer-access.tsx`), o fluxo iniciava forçando a digitação prévia de telefone (`step = "phone"`), disparando `/api/customer-access/check-phone`. Caso o telefone não estivesse cadastrado ou com formatação/DDD diferente, o cliente ficava bloqueado sem conseguir digitar seu PIN diretamente.
   - **Correção Aplicada:** O Mobile foi alinhado ao Web para iniciar por padrão em `pin_login` (6 dígitos) com fallback opcional para busca por celular e recuperação de PIN.

---

## 2. Causa Raiz dos Dados do Owner Diferentes

1. **Auto-criação de Usuários e Empresas Dummy por Typo:**
   - Na rota `src/app/api/auth/login/route.ts`, quando um e-mail não existia exatamente no banco, uma nova empresa vazia (`displayName = email.split('@')[0]`) e um novo usuário eram criados automaticamente.
   - Existiam duas contas no banco: `moa_tattoholic@gmail.com` (1 'o', nome de usuário `moa_tattoholic`) e `moa_tattooholic@gmail.com` (2 'o's, nome `Moa Tattoo`). Ambas pertencentes à empresa `a6624dbd-0bd4-4e94-a746-0ee2718c8fac` ("Moa Tattoo").
2. **Cache Local no SecureStore do Mobile:**
   - No Mobile (`mobile/src/lib/session-context.tsx`), a sessão anterior ficava salva no `SecureStore` sob a chave `reservei_session_cache_v1`. Ao abrir o app ou em falhas de rede, o mobile exibia a identidade anterior/dummy com dados em branco.
3. **Tratamento de Contrato de Resposta de Schedules:**
   - No Mobile (`mobile/src/lib/employees.ts`), a função `getEmployeeSchedules` fazia `res.data ?? []` sobre um retorno já desempacotado pelo cliente de API (`api-client.ts`), resultando em array vazio `[]` para horários da equipe.
4. **Resolução de Imagens:**
   - Imagens com caminhos relativos (ex: `/uploads/branding/...` e `/uploads/clients/...`) não eram resolvidas contra o host do backend quando o IP/host estava inacessível ou não configurado na API base.

---

## 3. APIs Utilizadas pelo Web

- **Autenticação de Staff/Owner:** `POST /api/auth/login` (cria cookie `agenda_session`)
- **Sessão Staff/Owner:** `GET /api/auth/session` (resolve usuário, empresa ativa, memberships, permissões e horários)
- **Autenticação de Cliente com PIN:** `POST /api/customer-access/pin/login` (cria cookie `agenda_session` para o cliente)
- **Sessão do Cliente:** `GET /api/my/session`
- **Reservas do Cliente:** `GET /api/my/bookings`
- **Equipe:** `GET /api/employees`
- **Serviços:** `GET /api/services`
- **Clientes:** `GET /api/clients`
- **Agenda:** `GET /api/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD`
- **Estatísticas / Financeiro:** `GET /api/stats?period=today` e consultas à rota canônica de agendamentos

---

## 4. APIs Utilizadas pelo Mobile Antes

- Tentativas com host estático ou inacessível sem bind em `0.0.0.0`
- Fluxo de cliente exigindo obrigatoriamente `/api/customer-access/check-phone` antes de liberar o PIN
- `index.tsx` chamava `/api/appointments?range=today` (parâmetro não suportado)
- `employees.ts` acessava `.data` em retorno já unwrapped

---

## 5. APIs Utilizadas pelo Mobile Depois (100% Canônicas)

- **Staff / Owner Login:** `POST /api/auth/login`
- **Sessão Owner:** `GET /api/auth/session`
- **Customer PIN Login:** `POST /api/customer-access/pin/login`
- **Customer Session:** `GET /api/my/session`
- **Customer Bookings:** `GET /api/my/bookings`
- **Dashboard Stats:** `GET /api/stats?period=today`
- **Equipe:** `GET /api/employees`
- **Serviços:** `GET /api/services`
- **Clientes:** `GET /api/clients`
- **Agenda:** `GET /api/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD` (via `getAppointments` com `todayKey()`)
- **Resolução de Assets:** `resolveImageUrl()` mapeando caminhos relativos para `http://<HOST>:3000/uploads/...`

---

## 6. Como Active Company Foi Unificada e Corrigida

- A função `getSession()` em `src/lib/auth.ts` resolve `activeCompanyId` consultando `companyMemberships` e `users.companyId`.
- No Mobile, `getStaffSession()` em `mobile/src/lib/auth.ts` consome diretamente `GET /api/auth/session`.
- Ao autenticar no Mobile com o usuário do estabelecimento (`Moa Tattoo`), o payload retornado carrega:
  - `company.id`: `a6624dbd-0bd4-4e94-a746-0ee2718c8fac`
  - `company.name`: "Moa Tattoo"
  - `company.logoUrl`: `/uploads/clients/f80ace8b-0774-49ab-a95b-0fe8437e8...`
  - `company.primaryColor`: `#f5f5f5`

---

## 7. Como o Customer PIN Foi Unificado

- O endpoint `POST /api/customer-access/pin/login` é o **único** serviço de validação de PIN tanto para Web quanto para Mobile.
- O serviço `CustomerAccessService.loginWithPin` valida o PIN, verifica tentativas e bloqueios (`lockedUntil`), autentica o usuário cliente no MySQL e emite o cookie de sessão `agenda_session`.
- O Mobile envia o payload `{ pin: "123456" }` diretamente ao endpoint do Next.js e armazena o cookie de sessão para chamadas subsequentes a `/api/my/session` e `/api/my/bookings`.

---

## 8. Services e Endpoints Compartilhados

| Recurso | Service Backend | Endpoint Canônico | Consumido por Web | Consumido por Mobile |
| :--- | :--- | :--- | :---: | :---: |
| **Login Staff / Owner** | `createSession` / `verifyPassword` | `POST /api/auth/login` | Sim | Sim |
| **Sessão Staff / Owner** | `getSession()` | `GET /api/auth/session` | Sim | Sim |
| **Login Cliente PIN** | `CustomerAccessService.loginWithPin` | `POST /api/customer-access/pin/login` | Sim | Sim |
| **Sessão Cliente** | `getIdentity()` | `GET /api/my/session` | Sim | Sim |
| **Minhas Reservas** | `listBookingDetails()` | `GET /api/my/bookings` | Sim | Sim |
| **Equipe** | `db.select().from(employees)` | `GET /api/employees` | Sim | Sim |
| **Serviços** | `db.select().from(services)` | `GET /api/services` | Sim | Sim |
| **Clientes** | `db.select().from(clients)` | `GET /api/clients` | Sim | Sim |
| **Agenda** | `db.select().from(appointments)` | `GET /api/appointments` | Sim | Sim |
| **Métricas** | `getCompanyMetrics()` | `GET /api/stats` | Sim | Sim |

---

## 9. Tabela de Evidências e Paridade Forense

### Contexto do Proprietário (Owner)

| Campo | Web | Mobile | Igual? |
| :--- | :--- | :--- | :---: |
| **User ID** | `588c17d6-c94e-4ae6-8b5b-9372b33e8a95` | `588c17d6-c94e-4ae6-8b5b-9372b33e8a95` | **SIM** |
| **Company ID** | `a6624dbd-0bd4-4e94-a746-0ee2718c8fac` | `a6624dbd-0bd4-4e94-a746-0ee2718c8fac` | **SIM** |
| **Company Name** | Moa Tattoo | Moa Tattoo | **SIM** |
| **Slug** | `tatto-aoxg` | `tatto-aoxg` | **SIM** |
| **Logo** | `/uploads/clients/f80ace8b-...` | `http://<HOST>:3000/uploads/clients/f80ace8b-...` | **SIM** |
| **Banner** | Fallback oficial do tema | Fallback oficial do tema | **SIM** |
| **Primary Color** | `#f5f5f5` | `#f5f5f5` | **SIM** |
| **Profissionais** | 2 (`Júlio Queiroz`, `Marlon`) | 2 (`Júlio Queiroz`, `Marlon`) | **SIM** |
| **Serviços** | 1 (`Atendimento Padrão`) | 1 (`Atendimento Padrão`) | **SIM** |
| **Clientes** | 0 cadastrados nesta unidade | 0 cadastrados nesta unidade | **SIM** |
| **Agenda (Hoje)** | 0 agendamentos | 0 agendamentos | **SIM** |
| **Financeiro** | R$ 0,00 | R$ 0,00 | **SIM** |

### Contexto do Cliente (Customer PIN)

| Campo | Web | Mobile | Igual? |
| :--- | :--- | :--- | :---: |
| **Customer ID** | `11e2a1b3-7108-4b38-8b6e-3a62086f89cd` | `11e2a1b3-7108-4b38-8b6e-3a62086f89cd` | **SIM** |
| **Nome** | Dayane | Dayane | **SIM** |
| **Celular** | `(21) 97751-9354` | `(21) 97751-9354` | **SIM** |
| **Credencial PIN** | Ativa no MySQL | Ativa no MySQL | **SIM** |
| **PIN Status** | `HAS_PIN` | `HAS_PIN` | **SIM** |
| **Reservas Retornadas** | `93b5e28a-c4b8-4889-98eb-a67365ca2a1f` | `93b5e28a-c4b8-4889-98eb-a67365ca2a1f` | **SIM** |

---

## 10. Resultados das Validações Automatizadas

1. **Typecheck Web:** `npm run typecheck` ➔ **PASSOU (0 erros)**
2. **Typecheck Mobile:** `npm run typecheck` (na pasta `/mobile`) ➔ **PASSOU (0 erros)**
3. **Suíte Completa de Testes:** `npm test` ➔ **227 testes passaram em 30 suítes (100% de sucesso)**
4. **Teste de Integração Web + Mobile:** `src/__tests__/unified-web-mobile-auth.test.ts` ➔ **PASSOU**

---

## 11. Pendências Reais

- Nenhuma pendência de arquitetura ou divergência de backend/banco de dados remanescente.
- O backend Next.js atua como servidor central único e canônico para as interfaces Web e Mobile.
