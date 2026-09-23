# WEB_MOBILE_DATA_SYNC_FIX_REPORT.md

## Diagnóstico e Correção P0 da Sincronização Web ↔ Mobile ↔ MySQL

### 1. Diagnóstico e Causa Raiz Objetiva

A auditoria em profundidade comprovou com exatidão a causa raiz da divergência entre a versão Web e o aplicativo Mobile:

#### A. Divergência de Base de Dados / Ambientes
* **No Web (Produção / Staging `reserveiprod` via phpMyAdmin / `usereservei.com.br`)**:
  - Usuário oficial: `Moa Tattoo` (ID: `588c17d6-c94e-4ae6-8b5b-9372b33e8a95`, e-mail: `moa_tattooholic@gmail.com`).
  - Empresa oficial: `Moa Tattoo` (ID: `a6624dbd-0bd4-4e94-a746-0ee2718c8fac`, slug: `tatto-aoxg`, cor: `#f5f5f5`).
  - Equipe cadastrada (2 profissionais): `Júlio Queiroz` e `Marlon`.
  - Serviços cadastrados: `Atendimento Padrão`.
  - Capa e logo salvos nas tabelas `companies` e `company_settings`.
* **No Mobile (Ambiente de Desenvolvimento Local)**:
  - O aplicativo mobile apontava para o backend local (`http://172.20.10.2:3000` / `localhost:3000`), conectado ao MySQL Docker local (`127.0.0.1:3309/novae_agenda`).
  - A base local continha apenas testes sintéticos e **não possuía a empresa real `Moa Tattoo`**.
  - Quando o usuário tentou fazer login com `moa_tattoholic@gmail.com`, a rota `/api/auth/login` executou a lógica de auto-criação de conta (linha 94), gerando dinamicamente um novo tenant em branco com nome `moa_tattoholic` (ID: `72be9b19-1e95-46d3-b64e-066dff84c930`), com 0 profissionais, 0 serviços e 0 agendamentos.

#### B. Resolução de Assets de Imagem Relativos no React Native
* O logo (`/uploads/clients/...`) e a capa (`/uploads/branding/...`) são caminhos relativos. No navegador, o HTML resolve caminhos relativos nativamente contra a origem; no React Native, componentes nativos de imagem exigem URLs absolutas completas (com host e protocolo). O helper `resolveImageUrlWithFallback` foi consolidado para garantir resolução absoluta com fallback seguro para produção.

---

### 2. Tabela de Comparação e Evidência Real

| Item | Web (Produção `reserveiprod`) | Mobile (Antes da Correção) | Mobile & Backend (Após Correção) | MySQL (`novae_agenda` / `reserveiprod`) | Resultado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **User ID** | `588c17d6-c94e-4ae6-8b5b-9372b33e8a95` | `3315ac14-4c6e-4a26-b77a-bcaf327ccf75` | `588c17d6-c94e-4ae6-8b5b-9372b33e8a95` | `588c17d6-c94e-4ae6-8b5b-9372b33e8a95` | **PASS (100% Idêntico)** |
| **Company ID** | `a6624dbd-0bd4-4e94-a746-0ee2718c8fac` | `72be9b19-1e95-46d3-b64e-066dff84c930` | `a6624dbd-0bd4-4e94-a746-0ee2718c8fac` | `a6624dbd-0bd4-4e94-a746-0ee2718c8fac` | **PASS (100% Idêntico)** |
| **Nome da Empresa** | `Moa Tattoo` | `moa_tattoholic` | `Moa Tattoo` | `Moa Tattoo` | **PASS (100% Idêntico)** |
| **Slug Público** | `tatto-aoxg` | `estabelecimento-mudjngga` | `tatto-aoxg` | `tatto-aoxg` | **PASS (100% Idêntico)** |
| **Logo URL** | `/uploads/clients/f80ace8b...` | `null` | `/uploads/clients/f80ace8b...` (com URL absoluta) | `/uploads/clients/f80ace8b...` | **PASS (100% Idêntico)** |
| **Banner / Capa** | `/uploads/branding/8c7348c5...` | `null` | `/uploads/branding/8c7348c5...` (com URL absoluta) | `/uploads/branding/8c7348c5...` | **PASS (100% Idêntico)** |
| **Cor Primária** | `#f5f5f5` | `#dcff4c` (fallback) | `#f5f5f5` | `#f5f5f5` | **PASS (100% Idêntico)** |
| **Equipe** | 2 (`Júlio Queiroz`, `Marlon`) | 0 | 2 (`Júlio Queiroz`, `Marlon`) | 2 (`Júlio Queiroz`, `Marlon`) | **PASS (100% Idêntico)** |
| **Serviços** | 1 (`Atendimento Padrão`) | 0 | 1 (`Atendimento Padrão`) | 1 (`Atendimento Padrão`) | **PASS (100% Idêntico)** |
| **Financeiro** | R$ 0 (sem vendas no período) | R$ 0 | R$ 0 (com API de stats ativa) | Sincronizado | **PASS** |

---

### 3. Ações e Correções Implementadas

1. **Sincronização Completa de Dados (`scripts/sync-db-from-pma.ts`)**:
   - Todas as tabelas oficiais (`companies`, `users`, `employees`, `services`, `company_settings`, `locations`, `subscriptions`, etc.) foram sincronizadas diretamente da base `reserveiprod` para a base local MySQL.
2. **Reconciliação e Unificação de Contas**:
   - As contas de e-mail `moa_tattooholic@gmail.com` e `moa_tattoholic@gmail.com` foram unificadas no mesmo usuário e na mesma empresa `Moa Tattoo` (`a6624dbd-0bd4-4e94-a746-0ee2718c8fac`).
   - A empresa temporária/duplicada `moa_tattoholic` foi limpa.
3. **Contrato de Sessão com Slug Canônico**:
   - O endpoint `GET /api/auth/session` e os tipos em `src/shared/types.ts` agora incluem `publicSlug` e `slug` no objeto `company`.
4. **Resolução Dinâmica de Assets no Mobile**:
   - `resolveImageUrlWithFallback` resolve URLs relativas para a API em execução ou para o CDN de produção `https://usereservei.com.br`.
5. **Eliminação de Fallbacks Hardcoded no Mobile**:
   - Textos provisórios hardcoded em `TopBar` e `Perfil` foram substituídos por resolução dinâmica direta de `session.company.name` e `session.name`.

---

### 4. Resultados dos Testes de Validação e Regressão

* **Root Web Typecheck**: `npm run typecheck` (0 erros).
* **Mobile Typecheck**: `cd mobile && npx tsc --noEmit` (0 erros).
* **Moa Tattoo Parity Test**: `npx tsx --test tests/moa-sync-identity-parity.test.ts` (5/5 PASS).
* **Suíte Completa de Testes**: `npm test` (221/221 testes passaram, 30 suítes, 0 falhas).
