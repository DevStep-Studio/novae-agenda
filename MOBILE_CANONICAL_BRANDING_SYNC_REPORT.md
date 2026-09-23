# RELATÓRIO TÉCNICO DE UNIFICAÇÃO DEFINITIVA DE BRANDING, MÍDIA E PERSONALIZAÇÃO WEB → MOBILE
**Data:** 23 de Setembro de 2026  
**Status:** Resolvido & Validado (Zero Mocks / 100% Sincronizado com MySQL)  
**Severidade:** P0 Crítico  

---

## 1. Diagnóstico e Causa Raiz dos Problemas Encontrados

### 1.1 Por que o Perfil estava Rosa e a Home / Serviços / Equipe ficavam Roxos?
- **Causa Raiz:** O `ThemeContext` (`mobile/src/lib/theme-context.tsx`) utilizava `AsyncStorage` com a chave `@reservei_primary_color` como fonte primária que sobrepunha a cor vinda da API/sessão em algumas telas e persistia preferências de sessões ou contas anteriores.
- Além disso, componentes e tokens locais mantinham como fallback a cor `#8b5cf6` (roxo) em vez de priorizar reativamente `session.company.primaryColor` e `branding.primaryColor`.
- No Perfil, a tela consultava diretamente a API de perfil (`/api/profile`) ou os campos da empresa da sessão mais recente, exibindo o rosa `#ec4899`, enquanto a Home e outras abas consumiam o tema estático inicial onde a chave persistida ou o fallback roxo estava ativo.

### 1.2 De onde vinha o Banner Roxo?
- **Causa Raiz:** O arquivo de utilitários `mobile/src/lib/employees.ts` continha a constante:
  ```ts
  const DEFAULT_COVER_URL = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80';
  ```
  Essa URL apontava para uma imagem abstrata roxa do Unsplash. Quando o funcionário não possuía um banner individual nem a empresa tinha `bannerUrl` no card, o `EmployeeCard` renderizava essa imagem roxa como capa padrão.

### 1.3 Por que o TopBar tinha a Foto da Ingrid e a Equipe mostrava "IA"?
- **Causa Raiz:**
  1. O **TopBar** consome o objeto `session.user.avatarUrl` (que na tabela `users` do MySQL continha a foto real da Ingrid: `/uploads/branding/e0f96383-705b-4375-9799-731aaae8f18d.webp`).
  2. O card da **Equipe** consome a tabela `employees`. No banco de dados MySQL, o registro de profissional correspondente à Ingrid tinha a coluna `photoUrl = NULL`.
  3. No Web, a listagem e o perfil de funcionário fazem o lookup do usuário vinculado ou usam a foto do proprietário quando `userId` coincide com o dono da empresa.
  4. No endpoint `GET /api/employees`, não havia o join/fallback com `users.avatarUrl` para funcionários vinculados ao proprietário, fazendo com que a resposta retornasse `photoUrl: null`. O componente mobile, sem a imagem resolvida, caía no fallback de iniciais "IA".

### 1.4 De onde vinha a imagem divergente de Serviços?
- **Causa Raiz:** O fallback de serviços no mobile utilizava placeholders locais não categorizados ou imagens estáticas mockadas quando `service.imageUrl` era nulo. A regra canônica do Web foi unificada para resolver URLs relativas via `resolveMediaUrl(service.imageUrl)` e renderizar cartões com o design token corporativo (`primaryColor` e ícones semânticos da categoria) quando não houver imagem anexada.

---

## 2. Fontes Antigas Removidas vs. Fonte Canônica Unificada

### 2.1 Fontes Antigas Removidas
1. ❌ **`DEFAULT_COVER_URL` (Unsplash Roxo):** Removido completamente de `employees.ts` e `employee-card.tsx`.
2. ❌ **Persistência Local de Cor sem Sincronia:** Removida a sobreposição estática de `@reservei_primary_color` no `ThemeContext`.
3. ❌ **Fallbacks Hardcoded de Empresa:** Eliminados fallbacks específicos em telas de Home, Serviços e Equipe.

### 2.2 Nova Arquitetura Canônica de Branding
```
   BACKEND / MySQL (companies, users, company_settings, employees)
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
       GET /api/auth/me                GET /api/profile
               │                               │
               └───────────────┬───────────────┘
                               ▼
                    Mobile Auth & Session
                               │
                               ▼
        CompanyBrandingContext / useCompanyBranding()
        ├── companyId
        ├── companyName
        ├── slug
        ├── primaryColor / primaryForeground / primarySoft
        ├── logoUrl (resolveMediaUrl)
        ├── coverUrl (resolveMediaUrl)
        ├── ownerAvatarUrl (resolveMediaUrl)
        └── dashboardPreferences
                               │
      ┌────────────────────────┼────────────────────────┐
      ▼                        ▼                        ▼
  Home Screen           Serviços Screen           Equipe Screen
 (TopBar, Stats,       (ServiceCards, Preços,    (EmployeeCards,
  Badges, Ações)        Categorias, Accents)      Avatares, Covers)
```

- **Função `resolveMediaUrl(url, apiBaseUrl)`:**
  - `null` / `undefined` ➔ `null`
  - `http://...` / `https://...` ➔ preserva URL absoluta
  - `/uploads/...` ➔ concatena dinamicamente com o origin oficial da API (`API_ORIGIN`)

---

## 3. Cache, Invalidação e Troca de Contas (Multi-Tenant)

1. **Troca de Conta / Logout:**
   - Ao executar `logout()`, o `AuthContext` limpa imediatamente a sessão e chama `clearCache()`.
   - O `ThemeContext` / `CompanyBrandingContext` reage instantaneamente ao novo estado da sessão, descartando qualquer cor ou mídia da empresa anterior e carregando as cores e mídias da nova empresa autenticada.
2. **Atualização em Tempo Real (Mutação no Web/Mobile):**
   - No salvamento do perfil (`PATCH /api/profile`), tanto a coluna `companies.bannerUrl`, `companies.primaryColor` quanto a tabela `company_settings` são persistidas.
   - O endpoint `GET /api/employees` foi atualizado para resolver automaticamente a foto e capa do usuário/dono associado via left join com `users`.

---

## 4. Tabela Obrigatória de Auditoria e Paridade (Ingrid Amaral nail)

| Item | Web (MySQL / Backend) | Mobile (Canonical Branding Context) | Igual? |
| :--- | :--- | :--- | :---: |
| **companyId** | `68` | `68` | ✅ **SIM** |
| **companyName** | `Ingrid Amaral nail` | `Ingrid Amaral nail` | ✅ **SIM** |
| **slug** | `ingrid-amaral-nail` | `ingrid-amaral-nail` | ✅ **SIM** |
| **primaryColor** | `#ec4899` (Rosa) | `#ec4899` (Rosa em todas as telas) | ✅ **SIM** |
| **primaryForeground** | `#FFFFFF` | `#FFFFFF` | ✅ **SIM** |
| **coverUrl / banner**| `/uploads/branding/b4618e47...webp` (Unhas) | `${API_ORIGIN}/uploads/branding/b4618e47...webp` (Unhas) | ✅ **SIM** |
| **ownerAvatarUrl** | `/uploads/branding/e0f96383...webp` (Foto Ingrid) | `${API_ORIGIN}/uploads/branding/e0f96383...webp` (Foto Ingrid) | ✅ **SIM** |
| **professionalAvatarUrl** | `/uploads/branding/e0f96383...webp` (Foto Ingrid) | `${API_ORIGIN}/uploads/branding/e0f96383...webp` (Foto Ingrid no card) | ✅ **SIM** |
| **professionalCoverUrl** | `/uploads/branding/b4618e47...webp` (Unhas) | `${API_ORIGIN}/uploads/branding/b4618e47...webp` (Unhas no card) | ✅ **SIM** |

---

## 5. Validação Multi-Tenant: Moa Tattoo e PL Barbearia

A solução foi implementada de forma estritamente genérica através do `CompanyBrandingContext` e mappers de backend:

| Empresa | Email de Acesso | Primary Color | Logo / Avatar | Capa / Banner |
| :--- | :--- | :--- | :--- | :--- |
| **Ingrid Amaral nail** | `ingrid_amaral@gmail.com` | `#ec4899` (Rosa) | Foto Real Ingrid | Banner Unhas |
| **Moa Tattoo** | `moatattoo@gmail.com` | `#10B981` (Verde Esmeralda) | Logo Moa Tattoo | Banner Moa Tattoo |
| **PL Barbearia** | `plbarbearia@gmail.com` | `#eab308` (Dourado Barbearia) | Logo PL Barbearia | Banner Barbearia |

- Nenhuma tela contém condicionais hardcoded (`if company.name === ...`).
- A troca de contas reseta completamente a identidade visual sem persistência de cores anteriores.

---

## 6. Testes Automatizados Executados

```bash
npx tsx --env-file=.env --test src/__tests__/unified-web-mobile-branding.test.ts
```
**Resultado:**
- ✔ 1. Media URL Resolution — Relative, Absolute, and Fallback Paths (0.45ms)
- ✔ 2. Ingrid Amaral — Canonical Pink Branding, Banner, and Photo Parity (45.18ms)
- ✔ 3. Employee Photo & Banner Resolution — Linked User / Owner Fallback (139.13ms)
- ✔ 4. Multi-Tenant Independence — Moa Tattoo & PL Barbearia Distinct Palettes (12.14ms)

**Suíte Geral:** 100% Aprovado.  
**Typecheck Web (`npm run typecheck`):** 0 erros.  
**Typecheck Mobile (`npx tsc --noEmit` em `/mobile`):** 0 erros.
