# RESERVEI MOBILE — AUDITORIA GLOBAL DE RESPONSIVIDADE (P0)

**Data**: 25/09/2026  
**Status da Auditoria**: CONCLUÍDA — PRONTA PARA IMPLEMENTAÇÃO DO SISTEMA  
**Escopo**: Todas as rotas, componentes, modais e layouts de `mobile/src/app` e `mobile/src/components`.

---

## 1. Mapeamento e Diagnóstico por Rota

| # | Rota / Tela | Arquivo | Problemas Identificados | 320px (Compact) | 360px | 375px | 390px | 430px | Tablet (768px+) | Status Inicial |
|---|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | **Login** | `mobile/src/app/(auth)/login.tsx` | Altura do banner fixa; espaçamento vertical em telas ultra-compactas; estiramento horizontal excessivo em tablets. | ALERTA | OK | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 2 | **Acesso Cliente (PIN)** | `mobile/src/app/(auth)/customer-access.tsx` | `PinInput` com 316px de largura estoura em 320px (com padding 20px sobram 280px); botões de ação sem flexWrap; teclado sobrepondo formulário. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 3 | **Home / Dashboard (Owner)** | `mobile/src/app/(owner)/index.tsx` | Grid de métricas 2x2 fixo com cards comprimidos; gráficos com largura estática; banner promocional sem aspectRatio adaptativo; tablets sem grid multi-coluna. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 4 | **Agenda** | `mobile/src/app/(owner)/agenda.tsx` | Calendário horizontal cortando dias em telas estreitas; timeline com larguras fixas por hora; filtros de profissional com overflow; modais com altura estática. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 5 | **Clientes** | `mobile/src/app/(owner)/clientes.tsx` | Lista de clientes com colunas de métricas quebrando em 320px; barra de busca e filtros empilhados incorretamente; tabs de filtros cortadas. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 6 | **Serviços** | `mobile/src/app/(owner)/servicos.tsx` | Cards de serviço com altura fixa ou ações comprimidas; tabs de categorias cortadas sem scroll suave; modal de criação ultrapassando viewport. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 7 | **Equipe** | `mobile/src/app/(owner)/equipe.tsx` | Card de membro da equipe com botões de ação em linha estourando largura; métricas financeiras de comissão comprimidas em telas pequenas. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 8 | **Financeiro** | `mobile/src/app/(owner)/financeiro.tsx` | Gráfico de faturamento com largura não responsiva; ranking de profissionais com overflow; tabs de períodos cortadas. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 9 | **Relatórios** | `mobile/src/app/(owner)/relatorios.tsx` | Cards de estatísticas com números grandes quebrando linha; tabelas de exportação sem scroll horizontal controlado. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 10 | **Perfil** | `mobile/src/app/(owner)/perfil.tsx` | Banner de capa sem aspectRatio; avatar desalinhado ao banner em tablets; botões de ação ("Salvar", "Ver Link") sem wrap em 320px; tabs cortadas. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 11 | **Configurações** | `mobile/src/app/(owner)/configuracoes.tsx` | Linhas de configuração (switch, label, descrição) quebrando layout em 320px; seletor de cores da marca sem grid responsivo. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 12 | **Assinatura / Planos** | `mobile/src/app/(owner)/assinatura.tsx` | Cards de planos de assinatura com largura fixa; tabela comparativa de recursos sem adaptação para telas pequenas; botão de upgrade cortado. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 13 | **Link de Agendamento (Page Builder)** | `mobile/src/app/(owner)/link-agendamento.tsx` | Preview mobile e painel de edição concorrendo por espaço; toolbar com overflow; modais de customização sobrepondo teclado. | CRÍTICO | CRÍTICO | ALERTA | OK | OK | ALERTA | **EM CORREÇÃO** |
| 14 | **Clubes de Assinatura** | `mobile/src/app/(owner)/clubes.tsx` | Cards de planos mensais e benefícios com botões quebrados em telas < 360px; modal de criação sem scroll de teclado. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 15 | **Avaliações** | `mobile/src/app/(owner)/avaliacoes.tsx` | Cards de depoimentos de clientes cortando texto longo; estrelas de avaliação sem flexWrap. | CRÍTICO | ALERTA | OK | OK | OK | OK | **EM CORREÇÃO** |
| 16 | **Lista de Espera** | `mobile/src/app/(owner)/lista-espera.tsx` | Linhas de espera com tags de status e horário sobrepostas em telas pequenas. | CRÍTICO | ALERTA | OK | OK | OK | OK | **EM CORREÇÃO** |
| 17 | **Notificações (Owner)** | `mobile/src/app/(owner)/notificacoes.tsx` | Botões de filtro (Todas, Não lidas) cortados; cards de notificação sem flexShrink no texto da mensagem. | CRÍTICO | ALERTA | OK | OK | OK | OK | **EM CORREÇÃO** |
| 18 | **Menu Mais (Owner)** | `mobile/src/app/(owner)/mais.tsx` | Grid de atalhos e links de navegação com tamanho inadequado em tablets (esticado) e em 320px (comprimido). | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 19 | **Home (Employee)** | `mobile/src/app/(employee)/index.tsx` | Resumo de atendimentos do dia e comissões do profissional com cards quebrados em 320px; botões de status sem touch target adequado. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 20 | **Clientes (Employee)** | `mobile/src/app/(employee)/clientes.tsx` | Lista de clientes do profissional sem paginação virtualizada; busca sem ajuste para teclado. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 21 | **Notificações (Employee)** | `mobile/src/app/(employee)/notificacoes.tsx` | Ajuste de espaçamento e safe areas. | CRÍTICO | ALERTA | OK | OK | OK | OK | **EM CORREÇÃO** |
| 22 | **Menu Mais (Employee)** | `mobile/src/app/(employee)/mais.tsx` | Grid de atalhos adaptativo. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 23 | **Home / Minhas Reservas (Customer)** | `mobile/src/app/(customer)/index.tsx` | Cards de agendamento do cliente cortando endereço e nome do estabelecimento; botões "Reagendar" e "Cancelar" sem wrap. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 24 | **Notificações (Customer)** | `mobile/src/app/(customer)/notificacoes.tsx` | Ajuste de espaçamento e safe areas. | CRÍTICO | ALERTA | OK | OK | OK | OK | **EM CORREÇÃO** |
| 25 | **Menu Mais (Customer)** | `mobile/src/app/(customer)/mais.tsx` | Informações de perfil e atalhos com largura máxima em tablets. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |
| 26 | **Booking Público** | `mobile/src/app/agendar/[slug].tsx` | Fluxo de reserva pública em 5 etapas: seleção de serviço, profissional, data/hora, PIN/dados e confirmação. Em 320px as etapas quebram; calendário sem touch target mínimo. | CRÍTICO | ALERTA | OK | OK | OK | ALERTA | **EM CORREÇÃO** |

---

## 2. Diagnóstico dos Componentes Globais

| Componente | Arquivo | Problema Detectado | Solução do Sistema Responsivo |
|---|---|---|---|
| **Screen** | `components/ui/screen.tsx` | Padding horizontal fixo em `20px` (muito grande para 320px, pequeno para tablets); sem suporte a `maxWidth` centralizado em tablets. | Substituir/ampliar com `ResponsiveScreen` que adapta padding (`16px` em compact, `20px` em phone, `32px` em tablet) e aplica `contentMaxWidth`. |
| **PinInput** | `components/ui/pin-input.tsx` | Células com `width: 46` e `gap: 8` fixos = `316px` de largura total. Estoura telas de `320px` e `360px` com padding. | Cálculo dinâmico de `boxWidth` e `gap` com base na largura disponível (`Math.min(46, Math.floor((width - gapTotal) / 6))`). |
| **Tabs / Filtros** | Vários arquivos | Diversas telas usam `<View style={{ flexDirection: 'row' }}>` estático para tabs, cortando a 3ª ou 4ª tab em telas estreitas. | Criação do componente `ResponsiveTabs` com auto-detecção de overflow e scroll horizontal suave. |
| **TopBar** | `components/ui/top-bar.tsx` | Título do estabelecimento com nome longo empurra botões de ação e estoura safe area superior. | Uso de `flexShrink: 1`, `numberOfLines={1}`, truncation e ajuste adaptativo de safe-area. |
| **BottomTabBar** | `components/ui/bottom-tab-bar.tsx` | Altura fixa e FAB central que pode sobrepor o conteúdo da base da tela. | Altura adaptativa com insets, padding bottom dinâmico em `ResponsiveScreen`. |
| **MetricCard** | `components/ui/metric-card.tsx` | Valores de receita com formato `R$ 12.345,00` quebram em 2 linhas desordenadas em telas compactas. | Tipografia responsiva com clamp (`scaleFont`) e flexibilidade no container. |
| **ServiceCard** | `components/ui/service-card.tsx` | Ações de switch, editar e excluir ocupam largura fixa. | Layout adaptativo que quebra em 2 linhas em `compact` e 1 linha em `phone`/`tablet`. |
| **EmployeeCard** | `components/ui/employee-card.tsx` | Ações rápidas (WhatsApp, Editar, Desativar) comprimidas em linha única. | Grid 2x2 em telas compactas e flex horizontal em tablets. |
| **Modais & TimePickers** | `components/ui/time-picker-modal.tsx` | Modais com height estática cortados quando o teclado abre. | BottomSheet adaptativo em phones e modal central com `maxHeight` e `KeyboardAvoidingView` em tablets. |

---

## 3. Matriz de Breakpoints Oficiais

```typescript
export const BREAKPOINTS = {
  compact: 360,     // < 360px  (iPhone SE 1st gen, Android pequenos)
  phone: 480,       // 360px – 479px (iPhone padrão 13/14/15, Galaxy S23)
  largePhone: 768,  // 480px – 767px (iPhone Pro Max, Foldables abertos)
  tablet: 1024,     // 768px – 1023px (iPad mini, iPad 10", Galaxy Tab)
  largeTablet: 1440 // >= 1024px (iPad Pro 12.9", Tablets Desktop)
};
```
