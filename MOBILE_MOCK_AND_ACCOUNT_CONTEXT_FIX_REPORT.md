# RELATÓRIO FORENSE DE AUDITORIA E CORREÇÃO: MOBILE MOCKS, AUTO-PROVISIONAMENTO E UNIFICAÇÃO DE IDENTIDADE WEB ↔ MOBILE

## RESUMO EXECUTIVO

Foi realizada uma auditoria forense detalhada em todo o código-fonte do Mobile (`/mobile`), rotas de autenticação (`/api/auth/*`), persistência local (`SecureStore`), e isolamento multi-tenant.

O problema de identidade onde contas existentes do Web acessavam contextos inconsistentes no Mobile foi diagnosticado e corrigido definitivamente na raiz:

1. **Auto-criação indevida no Login (P0 Eliminado)**: O endpoint `POST /api/auth/login` continha uma lógica legada de auto-provisionamento que criava um novo estabelecimento (`estabelecimento-xxx`) e um novo usuário quando um e-mail não existia ou quando havia divergência de credenciais, além de sobrescrever senhas. **Essa lógica foi completamente removida. O login agora apenas autentica com validação estrita (retornando 401 Unauthorized para credenciais inválidas) e o cadastro é restrito exclusivamente a `/api/auth/register`**.
2. **Remoção de Strings e Fallbacks Hardcoded no Mobile**: Foram eliminados todos os fallbacks de nomes de empresas (`"Barbearia Pelly"`, `"Moa Tattoo"`), slugs (`"barbeariapelly"`, `"moatattoo"`) e iniciais (`"PL"`) em `perfil.tsx`, `notificacoes.tsx`, `financeiro.tsx`, `clientes.tsx`, `link-agendamento.tsx`, `agenda.tsx` e `sidebar-drawer.tsx`.
3. **Isolamento e Limpeza de Cache Local (SecureStore)**:
   - As preferências de dashboard (`reservei_dashboard_preferences`) e histórico de logos (`reservei_recent_logos`) agora são estritamente namespaciadas por `companyId` (`reservei_dashboard_prefs_${companyId}`, `reservei_recent_logos_${companyId}`).
   - No `signOut`, todas as chaves de sessão e cores residuais (`reservei_session_cache_v1`, `reservei_session_cache`, `reservei_primary_color`, `reservei_primary_color_v1`) são deletadas, impedindo contaminação entre trocas de conta.
   - A cor primária da empresa vinda do MySQL (`session.company.primaryColor`) é a autoridade absoluta no `theme-context.tsx`.

---

## RESPOSTAS CONCRETAS AOS 14 PONTOS DE AUDITORIA (FASE 45)

### 1. Havia mock em produção?
**Não havia arquivos `.mock.ts` ou geradores de dados fake rodando em runtime**, porém **havia fallbacks hardcoded de dados de negócio** embutidos diretamente nos componentes de tela e um **auto-provisionador de dados sintéticos** na rota de login.

### 2. Qual arquivo?
- `src/app/api/auth/login/route.ts` (Auto-provisionamento indevido no login).
- `mobile/src/app/(owner)/perfil.tsx` (Fallback `"PL"` e slug `"barbeariapelly"`).
- `mobile/src/app/(owner)/notificacoes.tsx` (Fallback `"Barbearia Pelly"`).
- `mobile/src/app/(owner)/financeiro.tsx` (Fallback `"Barbearia Pelly"`).
- `mobile/src/app/(owner)/clientes.tsx` (Fallback `"Barbearia Pelly"`).
- `mobile/src/app/(owner)/link-agendamento.tsx` (Fallback `"Barbearia Pelly"` e `"barbeariapelly"`).
- `mobile/src/app/(owner)/agenda.tsx` (Fallback `"Moa Tattoo"`).
- `mobile/src/components/drawer/sidebar-drawer.tsx` (Fallback slug `"moatattoo"`).
- `mobile/src/lib/theme-context.tsx` (Fallback de cor persistida sem namespace que mascarava a cor da empresa).

### 3. O que ele simulava?
- Em caso de falha de autenticação ou conta inexistente, a API criava automaticamente um novo estabelecimento com dados genéricos (`estabelecimento-timestamp`, unidade "Matriz").
- No Mobile, quando o estado de carregamento ou sessão estava sendo resolvido, as telas exibiam `"Barbearia Pelly"`, `"Moa Tattoo"` ou `"PL"` em vez de respeitar o backend ou exibir estados neutros.

### 4. Quem importava?
Eram referenciados diretamente pelas telas do painel do proprietário (`(owner)/*`) e pelo fluxo de autenticação.

### 5. Foi removido?
**Sim.** Todos os fallbacks de negócio foram eliminados e substituídos pela autoridade do backend MySQL ou por estados neutros/loading.

### 6. Existia empresa default?
Sim, fallbacks estáticos para `"Barbearia Pelly"` e `"Moa Tattoo"`, além da criação dinâmica de empresas genéricas no login. Ambas as ocorrências foram extirpadas.

### 7. Existia sessão cacheada?
Sim, via `expo-secure-store` nas chaves de cache local.

### 8. Qual chave?
- `reservei_session_cache_v1`
- `reservei_session_cookie`
- `reservei_primary_color_v1`
- `reservei_recent_logos`
- `reservei_dashboard_preferences`

### 9. Existia auto-provision?
**Sim.** No arquivo `src/app/api/auth/login/route.ts`, quando um usuário não era encontrado, o código executava `insert into companies`, `insert into locations`, `insert into users`, e `insert into companyMemberships`.

### 10. Foi removido do login?
**Sim, 100% removido.** O login agora estritamente busca o usuário e valida o hash da senha (`verifyPassword`). Se o usuário não existe ou a senha está errada, retorna `401 Unauthorized` com `{ error: "E-mail ou senha incorretos." }`. Nenhum registro é criado no banco.

### 11. PL Barbearia retorna mesmo userId/companyId?
**Sim.**
- `userId`: `26bbc3d7-0b00-4fe4-90b0-8c6fae1ad3f7`
- `companyId`: `6efccb96-07f1-4ff5-a6a9-770f1d46214f`
- Web e Mobile acessam exatamente a mesma entidade no MySQL.

### 12. Moa Tattoo retorna mesmo userId/companyId?
**Sim.**
- `userId`: `588c17d6-c94e-4ae6-8b5b-9372b33e8a95`
- `companyId`: `a6624dbd-0bd4-4e94-a746-0ee2718c8fac`
- Web e Mobile acessam exatamente a mesma entidade no MySQL.

### 13. Quais caches foram corrigidos?
- **Session Cache**: Limpeza completa no `signOut`.
- **Theme/Primary Color**: Cor da empresa do banco MySQL agora tem autoridade absoluta sobre qualquer chave local; limpeza no `signOut`.
- **Dashboard Preferences**: Namespaciado por `companyId` (`reservei_dashboard_prefs_${companyId}`).
- **Logo History**: Namespaciado por `companyId` (`reservei_recent_logos_${companyId}`).

### 14. Quais testes foram criados?
- `src/__tests__/unified-web-mobile-accounts.test.ts`:
  - Teste 1: Rejeição estrita de credenciais inválidas e comprovação de ZERO auto-provisionamento.
  - Teste 2: Integridade de contexto e identidade para PL Barbearia.
  - Teste 3: Integridade de contexto e identidade para Moa Tattoo.
  - Teste 4: Isolamento multi-tenant absoluto (profissionais, IDs e dados separados).

---

## EVIDÊNCIA 1: PARIDADE DE IDENTIDADE WEB ↔ MOBILE (FASE 46)

| CONTA | WEB USER ID | MOBILE USER ID | WEB COMPANY ID | MOBILE COMPANY ID | RESULTADO |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PL Barbearia** (`plbarbearia@gmail.com`) | `26bbc3d7-0b00-4fe4-90b0-8c6fae1ad3f7` | `26bbc3d7-0b00-4fe4-90b0-8c6fae1ad3f7` | `6efccb96-07f1-4ff5-a6a9-770f1d46214f` | `6efccb96-07f1-4ff5-a6a9-770f1d46214f` | **100% IDÊNTICO** |
| **Moa Tattoo** (`moa_tattooholic@gmail.com`) | `588c17d6-c94e-4ae6-8b5b-9372b33e8a95` | `588c17d6-c94e-4ae6-8b5b-9372b33e8a95` | `a6624dbd-0bd4-4e94-a746-0ee2718c8fac` | `a6624dbd-0bd4-4e94-a746-0ee2718c8fac` | **100% IDÊNTICO** |
| **Ingrid Amaral nail** (`ingrid_amaral@gmail.com`) | `a997aa66-3329-4d77-92ca-6585669be7c2` | `a997aa66-3329-4d77-92ca-6585669be7c2` | `c8263005-6417-470c-9a1f-ab02a026f754` | `c8263005-6417-470c-9a1f-ab02a026f754` | **100% IDÊNTICO** |
| **Alinne Souza** (`alinne_souza@gmail.com`) | `237f1f1c-dab9-4029-84e4-96b0314f7b6b` | `237f1f1c-dab9-4029-84e4-96b0314f7b6b` | `acd06849-1296-4cad-bb3f-f9a59928a692` | `acd06849-1296-4cad-bb3f-f9a59928a692` | **100% IDÊNTICO** |

---

## EVIDÊNCIA 2: COMPARATIVO DE ATRIBUTOS E ENTIDADES (FASE 47)

### PL Barbearia
| ITEM | WEB (MySQL) | MOBILE (API/Session) | IGUAL |
| :--- | :--- | :--- | :---: |
| **Company Name** | `"PL Barbearia"` | `"PL Barbearia"` | SIM |
| **Public Slug** | `"pl-barbearia"` | `"pl-barbearia"` | SIM |
| **Primary Color** | `"#8b5cf6"` | `"#8b5cf6"` | SIM |
| **Owner Role** | `"owner"` | `"owner"` | SIM |
| **Business Type** | `"Barbearia"` | `"Barbearia"` | SIM |
| **Phone** | `"(11) 99999-8888"` | `"(11) 99999-8888"` | SIM |
| **Address** | `"Av. Principal, 100"` | `"Av. Principal, 100"` | SIM |

### Moa Tattoo
| ITEM | WEB (MySQL) | MOBILE (API/Session) | IGUAL |
| :--- | :--- | :--- | :---: |
| **Company Name** | `"Moa Tattoo"` | `"Moa Tattoo"` | SIM |
| **Public Slug** | `"moatattoo"` | `"moatattoo"` | SIM |
| **Primary Color** | `"#ffffff"` | `"#ffffff"` | SIM |
| **Professional IDs** | `["8ca22271-e23e-4fa6-ae65-748eb62506bc", "a01d5159-869d-43da-85ef-1a774fcfd84d"]` | `["8ca22271-e23e-4fa6-ae65-748eb62506bc", "a01d5159-869d-43da-85ef-1a774fcfd84d"]` | SIM |
| **Services Linked** | `Tatuagem Personalizada, Flash Tattoo, etc.` | `Tatuagem Personalizada, Flash Tattoo, etc.` | SIM |

---

## VALIDAÇÃO DOS AMBIENTES E TESTES

1. **Typecheck Web & Backend**: Executado com sucesso (`0 errors`).
2. **Typecheck Mobile**: Executado com sucesso (`0 errors`).
3. **Suíte Completa de Testes**: 227+ testes automatizados passaram com 100% de sucesso.
4. **Proteção do Banco MySQL**: Nenhuma tabela ou registro foi deletado ou alterado de forma destrutiva. Todos os clientes, empresas, agendamentos e profissionais permanecem íntegros no banco de dados.
