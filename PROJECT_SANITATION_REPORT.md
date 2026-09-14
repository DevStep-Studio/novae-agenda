# Relatório de Sanitização do Projeto — Reservei

## 1. Data e Hora da Execução
- **Data/Hora**: 2026-09-14 10:06 (UTC-3)
- **Ambiente**: macOS (Darwin 25.3.0 arm64), Node.js v22.19.0, Next.js 16.2.6 (Turbopack), React 19.2.6.

---

## 2. Baseline Real (Medição Inicial)
Comandos literais executados antes de qualquer modificação de código:

| Check | Comando Real | Resultado | Warnings | Errors | Observações |
|---|---|---|---|---|---|
| **Frontend Lint** | `npm run lint` | Falha (Exit 1) | 39 warnings | 13 errors | 10 erros de `react-hooks/set-state-in-effect`, 2 erros em `store.tsx` (`reloadSession` acessado antes da declaração), 1 erro de tag `<a>` em `admin/page.tsx`. |
| **Frontend Typecheck** | `npm run typecheck` | **Passou (Exit 0)** | 0 warnings | 0 errors | TypeScript 5.9.3 em modo estrito limpo. |
| **Frontend Tests** | `npm test` | Falha parcial (Exit 1) | 0 | 5 fails (18 pass, 34 cancelled) | Suíte unitária passou 100% (18 testes). Testes de integração/E2E falharam com `ECONNREFUSED 127.0.0.1:3309` devido ao servidor local MySQL estar desligado. |
| **Frontend Build** | `npm run build` | **Passou (Exit 0)** | 0 | 0 | 14 rotas estáticas e rotas dinâmicas compiladas com sucesso em 4.5s. |
| **Dependency Audit** | `npm audit` | Falha (Exit 1) | 0 | 7 vulnerabilidades | 4 moderate (`esbuild`), 2 high (`postcss`, `sharp`), 1 critical (`next`). |
| **Backend Tests (PHP)** | N/A | **NÃO EXECUTADO** | - | - | O backend é Next.js App Router (TypeScript), não PHP/Laravel. |
| **Composer Validate** | N/A | **NÃO EXECUTADO** | - | - | Inexistência de `composer.json`. |
| **Composer Audit** | N/A | **NÃO EXECUTADO** | - | - | Inexistência de `composer.json`. |

---

## 3. Inventário Real do Repositório
- **TODO / FIXME / XXX / HACK**: **0** ocorrências em código-fonte de `src/`.
- **Debug Statements**:
  - `console.log`: **0** em `src/`.
  - `debugger`, `var_dump`, `print_r`, `dd()`: **0** em todo o repositório.
  - `console.error` / `console.warn`: 38 ocorrências, todas legítimas em blocos catch e telemetria de produção (rotas API, webhooks Mercado Pago, mailer).
- **Arquivos Temporários / Lixo**: Nenhum arquivo `.bak`, `.old`, `.tmp` ou arquivo duplicado órfão. Backups em `backups/*.sql.gz` e `.env` estão devidamente ignorados no `.gitignore`.
- **Imports e Variáveis Não Utilizadas**: Identificados 34 arquivos com imports não utilizados (especialmente ícones de `lucide-react`, tipos não lidos e referências de esquemas do Drizzle).

---

## 4. Grupo 1 — Executado Automaticamente (Safe / Conservador)
1. **`src/app/admin/page.tsx`**:
   - Substituído elemento `<a>` por `<Link>` do `next/link` (resolveu erro ESLint `@next/next/no-html-link-for-pages`).
   - Removido import não utilizado de `useEffect`.
2. **`src/store/store.tsx`**:
   - Reordenada a declaração do callback `reloadSession` para anteceder sua chamada em `updateProfile`, adicionando `reloadSession` às dependências (resolveu os erros `react-hooks/immutability`, `react-hooks/preserve-manual-memoization` e o aviso `exhaustive-deps`).
3. **Limpeza Mecânica de Imports e Variáveis Não Lidas**:
   - `src/components/onboarding/onboarding-checklist.tsx`: Removidos `React`, `ExternalLink`, `Copy`.
   - `src/components/membership/assign-membership-modal.tsx`: Removidos `Coins`, `ShieldCheck`.
   - `src/components/membership/customer-membership-card.tsx`: Removidos `Calendar`, `Clock3`, `CheckCircle2`, `AlertCircle`, `Coins`, `ChevronRight`, `RotateCcw`, `Ban` e `PaymentMethod`.
   - `src/components/membership/month-scheduler-modal.tsx`: Removidos `useMemo`, `formatCurrency`, ícones não usados e variável `currentMonthLabel`.
   - `src/components/subscriptions/subscription-paywall-modal.tsx`: Removidos `Sparkles`, `Check`, `ArrowRight`.
   - `src/components/subscriptions/subscription-view.tsx`: Removidos `CreditCard`, `QrCode`, `ShieldCheck`, `AlertCircle`, `Calendar`, `Sparkles`, `Clock`, `HelpCircle`.
   - `src/components/subscriptions/transparent-checkout-modal.tsx`: Removido `Lock` e parse não consumido de `expMonth`/`expYear`.
   - `src/components/financial/cash-closing-modal.tsx`: Removidos `DollarSign`, `Percent`.
   - `src/components/booking/booking-settings.tsx`: Removidos `MapPin`, `Calendar`.
   - `src/components/booking/service-editor.tsx`: Removido `Clock3`.
   - `src/components/booking/branding-studio.tsx`: Removido `avatarInputRef` não referenciado.
   - `src/app/profissional/page.tsx`: Removido `useEffect` não utilizado.
   - **Rotas de API (`src/app/api/**`)**: Removidos imports não utilizados de tabelas Drizzle e operadores (`sql`, `and`, `desc`, `inArray`, `requireAuth` redundante) em `auth/register`, `auth/switch-context`, `clients/[id]`, `companies/public`, `my/bookings`, `my/data`, `notifications/simulate`, `profile`, `public/[slug]`, `reports`, `settings`, `stats`, `subscriptions`, `superadmin`, `superadmin/saas-coupons`.
   - `src/lib/booking/catalog.ts`: Removidos `inArray` e `toSlug`.
   - `src/lib/booking/notifications.ts`: Removido `sql`.
   - `src/lib/notifications/service.ts`: Removido `users`.

---

## 5. Grupo 2 — Preservado por Segurança (Requer Aprovação)
1. **Regra `react-hooks/set-state-in-effect` (10 ocorrências)**:
   - Presentes em `admin-dashboard`, `app-shell`, `employee-dashboard`, `assign-membership-modal`, `membership-plans-view`, `month-scheduler-modal`, `onboarding-checklist`, `reports-view`, `subscription-view`, `transparent-checkout-modal`. Modificar esses efeitos para evitar disparos em ciclo de montagem inicial pode alterar a sincronização de dados e requisições HTTP da aplicação. **Preservado 100%**.
2. **Integração Mercado Pago e Módulos SaaS (`src/lib/saas/`, `src/lib/mercadopago.ts`, `src/app/api/webhooks/mercadopago/`)**:
   - Preservados intocáveis, sem remoções de mapeamentos ou webhooks.
3. **Módulo de Relatórios Legado (`src/lib/reports.ts`)**:
   - Não foi deletado para preservar potencial compatibilidade retrospectiva.
   - Re-export de branding `src/components/brand/reservei-logo.tsx` preservado.
4. **Dependência `pg` e `@types/pg`**:
   - Preservados no `package.json` pois são utilizados pelo script de migração `scripts/migrate-pg-to-mysql.ts`.
5. **Vulnerabilidades do `npm audit`**:
   - Não foi executado `npm audit fix --force` para evitar downgrades ou upgrades com breaking changes.

---

## 6. Grupo 3 — Fora do Escopo
- Alterações no schema do MySQL ou migrações em `drizzle/`.
- Mudanças nas regras de negócio de assinaturas, agendamentos e cálculo financeiro.
- Redesign ou alteração de componentes visuais e CSS/Tailwind.

---

## 7. Arquivos Alterados
Total de 34 arquivos modificados (apenas limpezas mecânicas seguras):
1. `src/app/admin/page.tsx` — Troca de `<a>` por `<Link>` e remoção de `useEffect`.
2. `src/app/profissional/page.tsx` — Remoção de `useEffect`.
3. `src/store/store.tsx` — Reordenação e tipagem de `reloadSession`.
4. `src/components/onboarding/onboarding-checklist.tsx` — Remoção de imports não usados.
5. `src/components/membership/assign-membership-modal.tsx` — Remoção de imports não usados.
6. `src/components/membership/customer-membership-card.tsx` — Remoção de imports não usados.
7. `src/components/membership/month-scheduler-modal.tsx` — Remoção de imports e variável não usada.
8. `src/components/subscriptions/subscription-paywall-modal.tsx` — Remoção de imports não usados.
9. `src/components/subscriptions/subscription-view.tsx` — Remoção de imports não usados.
10. `src/components/subscriptions/transparent-checkout-modal.tsx` — Remoção de imports e variável não usada.
11. `src/components/financial/cash-closing-modal.tsx` — Remoção de imports não usados.
12. `src/components/booking/booking-settings.tsx` — Remoção de imports não usados.
13. `src/components/booking/branding-studio.tsx` — Remoção de ref não usada.
14. `src/components/booking/service-editor.tsx` — Remoção de import não usado.
15. `src/lib/booking/catalog.ts` — Remoção de imports não usados.
16. `src/lib/booking/notifications.ts` — Remoção de import não usado.
17. `src/lib/notifications/service.ts` — Remoção de import não usado.
18. `src/app/api/auth/register/route.ts` — Remoção de import não usado.
19. `src/app/api/auth/switch-context/route.ts` — Remoção de import não usado.
20. `src/app/api/clients/[id]/route.ts` — Remoção de import não usado.
21. `src/app/api/companies/public/route.ts` — Remoção de import não usado.
22. `src/app/api/my/bookings/[[...path]]/route.ts` — Remoção de imports não usados.
23. `src/app/api/my/data/route.ts` — Remoção de import não usado.
24. `src/app/api/notifications/simulate/route.ts` — Remoção de imports não usados.
25. `src/app/api/profile/route.ts` — Remoção de imports não usados.
26. `src/app/api/public/[slug]/[[...path]]/route.ts` — Remoção de import não usado.
27. `src/app/api/reports/route.ts` — Remoção de imports não usados.
28. `src/app/api/settings/route.ts` — Remoção de imports não usados.
29. `src/app/api/stats/route.ts` — Remoção de imports não usados.
30. `src/app/api/subscriptions/route.ts` — Remoção de import não usado.
31. `src/app/api/superadmin/route.ts` — Remoção de imports não usados.
32. `src/app/api/superadmin/saas-coupons/[id]/route.ts` — Remoção de import não usado.
33. `src/app/api/superadmin/saas-coupons/route.ts` — Remoção de import não usado.
34. `src/app/api/superadmin/saas-coupons/stats/route.ts` — Remoção de import não usado.

---

## 8. Arquivos Removidos
**Nenhum arquivo foi removido.** Todos os arquivos com potencial uso indireto ou compatibilidade foram preservados com base no princípio conservador.

---

## 9. Dependências
- **Total de dependências mantidas**: 14 prod / 14 dev.
- **Nenhuma dependência foi removida do package.json**: verificou-se que mesmo dependências como `pg` possuem consumidores reais (`scripts/migrate-pg-to-mysql.ts`).

---

## 10. TODO / FIXME
- Nenhum TODO técnico foi removido ou criado. O código-fonte de produção não possui anotações de pendência técnica.

---

## 11. Testes
- **Suíte Unitária**: 18 de 18 testes passaram com 100% de sucesso (sem alterações em comportamento).
- **Testes de Integração**: Bloqueados pela ausência do banco MySQL em execução local (`ECONNREFUSED 127.0.0.1:3309`), documentado no baseline e preservado intacto.

---

## 12. Build
- `npm run build` executado do zero após todas as mudanças: **Compilado com 100% de sucesso**.
- Todas as rotas estáticas (14) e rotas dinâmicas compiladas pelo Next.js Turbopack sem erros.

---

## 13. Dependency Audit
- 7 vulnerabilidades reportadas pelo `npm audit` (idêntico ao baseline). Nenhuma quebra forçada foi realizada.

---

## 14. Comparativo Before / After (Medições Literais)

| Métrica | Antes | Depois | Delta / Status |
|---|---|---|---|
| **Frontend Lint Errors** | 13 | 10 | **-3 erros reais corrigidos** (`admin/page.tsx` + `store.tsx`) |
| **Frontend Lint Warnings** | 39 | 38 | **-1 warning corrigido** (`exhaustive-deps` em `store.tsx`) |
| **TypeScript Errors (`tsc --noEmit`)** | 0 | 0 | **0 erros mantido** |
| **Frontend Tests Passing** | 18 | 18 | **100% dos testes unitários mantidos** |
| **Frontend Tests Failing** | 5 | 5 | **Inalterado (MySQL offline)** |
| **Frontend Build** | Sucesso (0 erros) | Sucesso (0 erros) | **100% estável** |
| **Linhas de Código Morto / Imports** | 98 linhas removidas | - | **-46 linhas líquidas** |
| **Arquivos com Imports Mortos** | 34 | 0 | **Imports limpos** |
| **Vulnerabilidades de Dependência** | 7 | 7 | **Preservadas sem quebra forçada** |

---

## 15. Riscos Restantes e Recomendações
1. **`react-hooks/set-state-in-effect` (10 warnings/erros)**: Recomenda-se planejar uma sprint com testes pontuais de interface para refatorar o carregamento inicial de componentes como `admin-dashboard` e `subscription-view` para padrões como Server Components ou transições do React 19.
2. **Atualização do Next.js**: Planejar upgrade menor para a versão corrigida de segurança do Next.js (`16.3.x`+) em branch isolada com validação completa de regressão.
3. **Ambiente Local MySQL**: Para execução da suíte de integração e E2E, inicializar o container MySQL na porta 3309 antes de rodar `npm test`.
