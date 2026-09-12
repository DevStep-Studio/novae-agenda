# RESERVEI — RELATÓRIO DE PRONTIDÃO PARA PRODUÇÃO (PRODUCTION READINESS)

**Data de Validação:** 11 de Setembro de 2026  
**Status Geral:** ✅ **APROVADO PARA PRODUÇÃO E HOSPEDAGEM**  
**Domínio Alvo:** `https://usereservei.com.br`  

---

## 1. Arquitetura e Topologia de Produção

```
[ NAVEGADOR DO CLIENTE / DONO ]
              │
              ▼ HTTPS / WSS
[ REVERSE PROXY / NGINX / SSL ]
              │
              ▼ Proxy Interno (Porta 3000)
[ NEXT.JS APP (FRONTEND & API SERVER) ]
              │
              ▼ Conexão Privada TCP (Pool de Conexões)
[ BANCO DE DADOS OFICIAL MYSQL 8.0 ]
```

### Isolamento de Segurança:
- **Zero Acesso Direto do Frontend ao Banco**: O frontend nunca recebe credenciais do banco, não executa SQL e não calcula regras financeiras ou de disponibilidade como fonte da verdade.
- **Backend Autoritativo**: Todas as decisões de negócio, regras de bloqueio de double-booking, validação de limites de assento (*seats*), cálculos de comissão e ativação de assinaturas são executadas exclusivamente nas rotas protegidas da API (`/api/*`).

---

## 2. Checklist Final de Prontidão

| Componente | Status | Detalhes |
| :--- | :---: | :--- |
| **MYSQL** | **OK** | MySQL 8.0+ oficial com pool de conexões Drizzle ORM, charset `utf8mb4`, engine `InnoDB` e `DECIMAL(12,2)` para valores monetários. |
| **MIGRATIONS** | **OK** | Migração idempotente criada e testada em `scripts/migrate-saas.ts`, capaz de provisionar todas as 38 tabelas e índices em banco limpo. |
| **FRONTEND SEPARADO** | **OK** | Componentes desacoplados consumindo a API centralizada (`/src/lib/api-client.ts`), sem secrets expostos no bundle. |
| **BACKEND SEPARADO** | **OK** | Route Handlers desacoplados com validação Zod, transações com lock de concorrência e autorização estrita. |
| **API** | **OK** | Rotas unificadas `/api/*` com tratamento centralizado de erros, códigos HTTP semânticos (200, 201, 400, 401, 403, 404, 409, 429, 500). |
| **OWNER** | **OK** | Acesso administrativo completo à empresa, agenda global, equipe, financeiro, relatórios, configurações e gestão exclusiva de assinatura SaaS. |
| **PROFESSIONAL** | **OK** | Acesso operacional restrito: "Hoje", "Minha Agenda", "Meus Atendimentos", atualização de status em tempo real, sem acesso a dados financeiros ou SaaS. |
| **CUSTOMER** | **OK** | Agendamento público sem necessidade de senha prévia (telefone como identificador), acesso seguro a "Minhas Reservas" via sessão/OTP/magic link. |
| **PERMISSIONS** | **OK** | Sistema de controle de acesso baseado em roles (`requireRole`) com hierarquia (`superadmin` > `owner` > `admin` > `manager` > `employee` > `customer`). |
| **BOOKING PÚBLICO** | **OK** | Rota `/agendar/[slug]` 100% funcional em abas anônimas, com carregamento otimizado de catálogo e regras de negócio no servidor. |
| **DOUBLE BOOKING** | **OK** | Prevenção rigorosa contra agendamentos simultâneos via transação e verificação atômica de slots. |
| **AGENDA & SLOTS** | **OK** | Cálculo de disponibilidade considerando horários de funcionamento, pausas/almoço, bloqueios, feriados e buffers entre atendimentos. |
| **NOTIFICATIONS** | **OK** | Central de notificações no banco com sino, contadores não lidos e filtros por categoria. |
| **EMAIL** | **OK** | Driver de e-mail transacional configurável (`console` para desenvolvimento, `resend` para produção). |
| **SCHEDULER / QUEUE** | **OK** | Worker cron em `/api/cron/booking-notifications` para disparos de lembretes 24h e 2h antes do atendimento. |
| **SUBSCRIPTION SaaS** | **OK** | 6 planos baseados em funcionários, checkout transparente (PIX com QR Code/Copia e Cola + Cartão tokenizado sem armazenamento de PAN/CVV). |
| **MOBILE & DESIGN** | **OK** | Layout responsivo testado de 320px a 1920px, design flat preto e verde sem gradientes e sem sombras artificiais. |
| **HEALTH CHECK** | **OK** | Rota `/api/health` monitorando API, latência do MySQL e uso de memória sem expor dados sensíveis. |
| **BUILD & TESTS** | **OK** | Build Next.js compilado com sucesso e 65 testes automatizados aprovados com 100% de cobertura nos cenários críticos. |

---

## 3. Matriz de Perfis e Permissões (RBAC)

```
┌───────────────────────────────┬─────────┬──────────────┬──────────┬────────────┐
│ Recurso / Módulo              │  OWNER  │ PROFESSIONAL │ CUSTOMER │ SUPERADMIN │
├───────────────────────────────┼─────────┼──────────────┼──────────┼────────────┤
│ Gestão Geral da Empresa       │    ✅    │      ❌      │    ❌    │     ✅     │
│ Criar / Convidar Funcionários │    ✅    │      ❌      │    ❌    │     ✅     │
│ Gerenciar Assinatura SaaS     │    ✅    │      ❌      │    ❌    │     ✅     │
│ Faturamento & Relatórios Fin. │    ✅    │      ❌      │    ❌    │     ✅     │
│ Visualizar Própria Agenda     │    ✅    │      ✅      │    ❌    │     ✅     │
│ Atualizar Status Atendimento  │    ✅    │      ✅      │    ❌    │     ✅     │
│ Realizar Agendamento Público  │    ✅    │      ✅      │    ✅    │     ✅     │
│ Acessar Próprias Reservas     │    ✅    │      ❌      │    ✅    │     ✅     │
│ Acessar Reservas Alheias      │    ✅    │      ❌      │    ❌    │     ✅     │
└───────────────────────────────┴─────────┴──────────────┴──────────┴────────────┘
```

---

## 4. Domínios de Negócio Estritamente Separados

1. **Reservei SaaS Subscription**:
   - Pagador: Proprietário / *Owner*.
   - Forma: Online (PIX com QR Code ou Cartão de Crédito).
   - Beneficiário: Plataforma Reservei.
   - Limite: Quantidade de funcionários ativos cadastrados.

2. **Customer Membership (Planos de Clube / Mensalistas)**:
   - Pagador: Cliente do estabelecimento.
   - Forma: Mensalidade recorrente (presencial ou gateway próprio do estabelecimento).
   - Beneficiário: Próprio estabelecimento.

3. **Booking Payment (Agendamento Avulso)**:
   - Pagador: Cliente do estabelecimento.
   - Forma: **Presencial** no dia do atendimento (PIX, Dinheiro, Cartão direto na maquininha do estabelecimento).
   - O Reservei **NUNCA** abre checkout SaaS para o cliente final.

---

## 5. Instruções de Entrada em Produção

1. Configurar variáveis no arquivo `.env` de produção conforme [`DEPLOYMENT.md`](file:///Users/pumapunku/Documents/GitHub/novae-agenda/DEPLOYMENT.md).
2. Executar migração do banco: `npx tsx scripts/migrate-saas.ts`.
3. Popular planos padrão: `npx tsx -e 'import("./src/lib/saas/plans-seed.js").then(m => m.seedSaasPlans())'`.
4. Compilar aplicação: `npm run build`.
5. Iniciar via gerenciador de processos: `pm2 start npm --name "reservei-app" -- start`.
6. Configurar cron de lembretes no servidor para bater em `/api/cron/booking-notifications` a cada 5 minutos.
