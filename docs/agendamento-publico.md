# Agendamento público por link

## Auditoria e decisão de arquitetura

O projeto usa Next.js 16 (App Router), React 19, TypeScript, PostgreSQL, Drizzle, autenticação própria com JWT em cookie HTTP-only, bcrypt, tokens de verificação e recuperação, rate limiting persistente e transporte de e-mail desacoplado. Não há Laravel nem MySQL. A implementação preserva essa arquitetura para não duplicar autenticação, banco ou dashboard.

Foram reutilizados `companies`, `locations`, `employees`, `employee_locations`, `services`, `service_categories`, `employee_services`, `employee_schedules`, `schedule_blocks`, `appointments`, `appointment_services`, `clients`, `payments`, `appointment_history`, `notifications` e `audit_logs`. A agenda já oferecia dia/semana/mês, cadastro manual, CRM e conclusão financeira.

Antes deste módulo, a criação manual verificava disponibilidade fora de transação; havia risco de sobreposição. Bloqueios eram gravados como horário local com sufixo UTC. As jornadas liam somente um período por dia. A migration 0002 existente não estava no journal do Drizzle. Esses pontos foram corrigidos de forma incremental.

## Configuração pelo profissional

1. Em **Serviços**, criar ou editar nome, categoria, preço, duração, buffer, descrição, imagem, profissionais, atendimento presencial/online e informações de cancelamento.
2. Em **Link de agendamento**, escolher o slug e configurar apresentação, imagem, fotos, contatos públicos, cor e política de alterações.
3. Em **Configurações de disponibilidade**, escolher o profissional e cadastrar períodos por dia. Almoço é opcional; vários períodos no mesmo dia são aceitos, sem sobreposição.
4. O horário deve caber também no expediente geral em **Configurações** e na abertura/fechamento da unidade. A reserva é sempre de uma unidade específica.
5. Em **Agenda → Bloquear horário**, registrar bloqueios, feriados, folgas ou férias com intervalo de datas. Um bloqueio sem profissional aplica-se à unidade/empresa conforme o cadastro.
6. Ativar a página, salvar e copiar o link. QR Code disponível em PNG e SVG. Alterar o slug muda o endereço compartilhado; o antigo deixa de resolver.

A página fica desativada por padrão, preservando a privacidade dos estabelecimentos existentes. Ela só mostra serviços ativos, vinculados a profissionais ativos e com pagamento no atendimento. Não há perfis ou serviços demonstrativos publicados automaticamente.

## Fluxo do cliente

`/agendar/{slug}` → serviços → profissional por serviço ou qualquer profissional → data e horário → login/cadastro e verificação de e-mail → observações, produtos/cupons opcionais → confirmação → `/meus-agendamentos`.

`/r/{slug}` redireciona para o endereço principal. A página possui metadados e Open Graph. O cliente consegue baixar ICS, abrir Google Calendar, compartilhar o estabelecimento, cancelar ou remarcar dentro do prazo. ICS é compatível com Apple Calendar/Outlook. Atendimentos concluídos permitem agendar novamente.

O mesmo cookie e os mesmos endpoints de login, verificação e recuperação são reutilizados. Usuários `customer` não recebem empresa fictícia nem acesso às APIs profissionais. O CRM de cada empresa recebe um cliente vinculado à identidade autenticada; coincidência de telefone ou e-mail não dá acesso a registros anteriores. Usuários profissionais também podem reservar e completar seu telefone sem criar outra identidade.

## Modelo e atomicidade

- `bookings`: reserva do cliente, unidade, identidade, valores, status, UTC, fuso, revisão e chave de idempotência.
- `appointments.booking_id`: um atendimento por serviço, integrado à agenda existente. Serviços de pessoas diferentes são sequenciais; buffers também são respeitados entre os itens.
- `appointment_services`: preço, duração e comissão históricos; remarcação preserva preço/duração.
- `products`, `booking_products`, `coupons`: itens opcionais e desconto validado no servidor. O valor final é distribuído nos recebíveis da agenda, preservando os preços originais dos serviços no histórico.
- `notification_logs`: outbox persistente com evento, revisão, canal, prazo, tentativas e resultado.
- `booking_events`: eventos agregáveis de conversão, sem dados de contato nos eventos.
- `booking_waitlist`: estrutura de lista de espera, sem automação de ofertas.

Confirmação, gravação no CRM, itens, auditoria e notificações acontecem na mesma transação. Um advisory lock por empresa serializa as operações de reserva e as alterações principais de agenda. É uma opção conservadora de consistência para o porte atual; futuramente pode ser particionado por profissional/dia após benchmark.

A constraint PostgreSQL `appointments_no_overlap`, usando `btree_gist` e intervalos semiabertos `[início,fim)`, impede sobreposição de um profissional em qualquer unidade, inclusive em inserções diretas. Inclui o buffer gravado no atendimento. Cancelados e não comparecimentos liberam o intervalo. Referência: [PostgreSQL — Range Types e exclusion constraints](https://www.postgresql.org/docs/17/rangetypes.html).

Disponibilidade é calculada no servidor e não recebe preço/duração do checkout. O motor consulta serviços, vínculos, jornadas, expediente geral/unidade, pausas, bloqueios, agendamentos de todas as unidades, buffers, prazo máximo e relógio no fuso do estabelecimento. Consultas mensais são agrupadas; a lista de reservas usa três consultas independentemente do número de itens. Disponibilidade nunca é cacheada. Campos de comissão não são publicados.

A confirmação revalida tudo dentro da transação. Um conflito retorna HTTP 409: “Este horário acabou de ser reservado. Escolha outro horário.” Repetir a mesma chave de idempotência retorna a reserva existente. A remarcação libera o intervalo antigo e ocupa o novo atomicamente, preservando o antigo caso a operação falhe.

Os status existentes foram preservados: `scheduled` (pendente), `confirmed`, `waiting` (chegou), `in_progress`, `completed`, `cancelled`, `no_show`. Isso evita incompatibilidade com o dashboard e o financeiro. Alterações ficam em `appointment_history` e `audit_logs`. O dashboard atualiza agenda, CRM, notificações e indicadores a cada 15 segundos quando visível e ao recuperar foco.

## Datas e migrações

`bookings.starts_at/ends_at` são instantes UTC (`timestamptz`). A agenda legada mantém data e hora locais vinculadas ao fuso da empresa. `schedule_blocks` passa a armazenar UTC verdadeiro. Conversões usam [date-fns-tz](https://github.com/marnusw/date-fns-tz), com rejeição de horários locais inexistentes em transições de horário de verão.

`0003_public_booking.sql` converte os bloqueios antigos uma única vez, usando o fuso da respectiva empresa. O journal passa a incluir `0002_complete_system_upgrade`, que já possuía SQL idempotente. Snapshots de Drizzle acompanham o estado final. Não executar 0003 manualmente mais de uma vez nem fora do migrador.

A migration adiciona campos e tabelas, torna `users.company_id` opcional apenas para clientes e mantém os registros existentes. Não remove nem reseta tabelas. A criação da exclusion constraint interrompe a migration caso existam agendamentos sobrepostos: eles precisam ser revisados antes de migrar, sem cancelamento automático. O usuário do banco precisa ter permissão para instalar `btree_gist` (ou a extensão deve ser previamente instalada).

Mudança de timezone após haver atendimentos é bloqueada nas configurações: converter uma agenda existente exige uma migração explícita, para não mover horários silenciosamente.

## Operação em produção

1. Definir `DATABASE_URL`, `SESSION_SECRET` forte e `APP_URL` com a origem HTTPS real.
2. Executar `npm ci` e `npm run db:migrate`.
3. Executar `npm run build` e `npm start`.
4. Para entregar verificação de e-mail e notificações, configurar `EMAIL_TRANSPORT=resend`, `RESEND_API_KEY` e `EMAIL_FROM` com remetente verificado. O transporte console é apenas desenvolvimento; ele não entrega e-mails.
5. Disparar o worker periodicamente — **isto não acontece sozinho**, precisa de um gatilho externo. Duas formas equivalentes (escolha uma):
   - **VPS com crontab**: `npm run bookings:notifications` a cada minuto, na mesma configuração de ambiente da aplicação. Exemplo: `* * * * * cd /caminho/novae-agenda && npm run bookings:notifications`.
   - **Serverless (Vercel ou qualquer host sem crontab)**: use a rota `GET/POST /api/cron/booking-notifications?secret=$CRON_SECRET` (ou header `Authorization: Bearer $CRON_SECRET`). Defina `CRON_SECRET` no `.env`. Com Vercel, adicione um `vercel.json` com `crons` apontando pra essa rota (a cada 5 min é suficiente pra um lembrete de 2h); sem Vercel, qualquer pinger externo (cron-job.org, GitHub Actions `schedule`, UptimeRobot) chamando essa URL funciona.
6. Monitorar registros `failed` em `notification_logs`. Após corrigir a causa, reprocessar explicitamente o registro mantendo seu ID/chave de idempotência.

O worker usa `FOR UPDATE SKIP LOCKED`, tentativas com recuo e uma chave de idempotência no provedor. Lembretes de 24h e 2h são criados apenas se ainda futuros. Revisões obsoletas e lembretes de reservas canceladas não são enviados. A confirmação visual independe do envio de e-mail; o outbox persiste em caso de indisponibilidade do provedor. Tokens de autenticação só aparecem nas respostas em desenvolvimento, nunca no build de produção.

Não foi configurado um provedor real nem disparado e-mail para clientes reais durante o desenvolvimento. A entrega externa depende das credenciais e do worker acima.

## Expansões preparadas

- `FULL_PAYMENT` e `DEPOSIT` podem ser configurados no serviço, mas ficam indisponíveis no link enquanto não houver gateway. Nenhuma cobrança é simulada. O fluxo operacional atual é `PAY_LATER`.
- O canal de notificações é uma interface substituível; WhatsApp Business API depende de um fornecedor/integração futura.
- Lista de espera persistente está preparada; automação de ofertas, avaliações e destaque de próxima disponibilidade por serviço não fazem parte do fluxo atual. Há busca real de próxima disponibilidade no calendário.
- Múltiplas unidades são suportadas com escolha explícita no link e detecção de conflito entre unidades.

## Verificação

- `npm run typecheck`
- `npm test`: cálculo, conflitos, buffers, timezone, almoço, bloqueios/férias, múltiplos serviços, concorrência real no banco, idempotência, remarcação, permissões, isolamento, preços históricos, produtos/cupons, notificações e financeiro existente.
- `npm run dev -- --port 3100` e, em outro processo, `npm run test:browser`. Definir `TEST_BASE_URL` para outra origem. Executar `npx playwright install chromium` uma vez.
- Testes de navegador usam empresas isoladas, sem fixtures publicadas como solução final, e removem os registros criados. Incluem cadastro/verificação real pelos endpoints, conclusão, cancelamento, remarcação, acesso indevido, QR e cadastro profissional.
- As etapas de serviços, calendário e confirmação são verificadas em 320, 375, 390, 430, 768, 1024, 1366, 1440 e 1920 px.

## Resultado de QA local (08/09/2026)

- Migrations aplicadas; geração do Drizzle confirma ausência de diferenças pendentes.
- Build de produção e TypeScript concluídos. ESLint sem erros; avisos de imagens HTML permanecem (inclusive na interface preexistente).
- 23 testes de backend, incluindo escape de nomes em e-mails de autenticação, e 3 testes de navegador.
- Concorrência verificada tanto entre dois clientes públicos quanto entre a API manual e a pública. Apenas uma gravação vence.
- Fluxo profissional de remarcação, chegada, início e finalização validado pelas APIs reais; status refletido em Meus agendamentos.
- Revisão 21st do módulo público sem erros bloqueantes. A revisão do AppShell também identifica questões de semântica interativa em componentes preexistentes, fora do fluxo público.
