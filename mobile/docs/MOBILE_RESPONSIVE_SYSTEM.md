# RESERVEI MOBILE — SISTEMA RESPONSIVO OFICIAL (DESIGN SYSTEM)

Este documento é a especificação oficial de responsividade, layout adaptativo, acessibilidade e suporte multiplataforma (iOS, Android, Foldables e Tablets) do **Reservei Mobile**.

---

## 1. Princípios Fundamentais

1. **Zero Hardcoded Breakpoints**: Nunca utilizar `width: 390`, `height: 800`, ou valores fixos para ajustar uma tela específica.
2. **Reatividade Dinâmica**: Todas as decisões de layout devem se basear em `useWindowDimensions()` através do hook unificado `useResponsive()`.
3. **Reflow Inteligente vs. Scale Cego**: Nunca multiplicar toda a interface por um fator fixo. Elementos devem se reorganizar (reflow em grid, wrap de ações, tabs scrolláveis).
4. **Respeito às Safe Areas**: Todo conteúdo respeita top notch, Dynamic Island, status bar do Android, barras de navegação por gestos e a barra de abas inferior.
5. **Aproveitamento de Tablets**: Em tablets (>= 768px), o layout centraliza com `maxWidth`, distribui métricas em até 4 colunas e divide formulários em painéis equilibrados em vez de esticar cards infinitamente.

---

## 2. Tabela de Breakpoints Oficiais

| Breakpoint | Faixa de Largura | Dispositivos Típicos | Comportamento Padrão |
|---|---|---|---|
| **Compact** | `< 360px` | iPhone SE (1ª ger.), Galaxy A01, Androids compactos | 1 coluna de métricas, padding 14px, PIN adaptado para caber sem overflow, botões empilhados. |
| **Phone** | `360px – 479px` | iPhone 13/14/15/16 padrão, Galaxy S23, Pixel 7 | 2 colunas de métricas, padding 20px, tabs com scroll se > 3 itens, botões em linha quando couber. |
| **LargePhone** | `480px – 767px` | iPhone Pro Max, Galaxy Ultra, Foldables abertos | 2-3 colunas de métricas, padding 24px, maior respiro vertical. |
| **Tablet** | `768px – 1023px` | iPad mini, iPad 10", Galaxy Tab S8 | 3-4 colunas de métricas, padding 32px, `maxWidth: 980px` centralizado, modais centrados. |
| **LargeTablet** | `>= 1024px` | iPad Pro 12.9", Galaxy Tab Ultra | 4 colunas de métricas, padding 40px, `maxWidth: 1200px` centralizado, painéis laterais. |

---

## 3. Hook Global: `useResponsive()`

Toda tela ou componente com comportamento adaptativo deve importar `useResponsive()`:

```tsx
import { useResponsive } from "@/hooks/use-responsive";

export function MeuComponente() {
  const {
    width,
    height,
    fontScale,
    isCompact,
    isPhone,
    isTablet,
    isAnyTablet,
    horizontalPadding,
    metricColumns,
    scaleFont,
  } = useResponsive();

  return (
    <View style={{ paddingHorizontal: horizontalPadding }}>
      <Text style={{ fontSize: scaleFont(16) }}>Texto Responsivo</Text>
    </View>
  );
}
```

---

## 4. Componentes Estruturais Oficiais

### 4.1 `ResponsiveScreen` / `Screen`
Substitui views cruas. Gerencia SafeAreaView, padding horizontal adaptativo, centralização em tablet e padding inferior para não colidir com o `BottomTabBar`.

```tsx
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";

export default function MinhaScreen() {
  return (
    <Screen header={<TopBar title="Minha Tela" />}>
      {/* Conteúdo com padding horizontal automático e maxWidth em tablets */}
    </Screen>
  );
}
```

### 4.2 `ResponsiveTabs`
Resolve o problema de tabs cortadas horizontalmente.
- Se as abas couberem na largura da tela, elas se distribuem proporcionalmente.
- Se houver muitas abas (ou em telas compactas), o componente ativa scroll horizontal suave sem truncar a visualização.

```tsx
import { ResponsiveTabs } from "@/components/ui/responsive-tabs";

<ResponsiveTabs
  tabs={[
    { id: "all", label: "Todos", count: 12 },
    { id: "pending", label: "Pendentes", count: 3 },
    { id: "finished", label: "Concluídos" },
  ]}
  activeTab={currentTab}
  onChange={setCurrentTab}
/>
```

### 4.3 `PinInput`
Calcula dinamicamente a largura de cada célula de 6 dígitos com base no espaço real disponível (`calculatePinDimensions`), garantindo **zero overflow** mesmo em telas de 320px com padding lateral.

---

## 5. Regras para Novas Telas

Ao criar qualquer nova tela no Reservei Mobile:

1. **Estrutura**: Envolver o conteúdo com `<Screen>` ou `<ResponsiveScreen>`.
2. **Tipografia**: Usar `scaleFont(baseSize)` para valores grandes de métricas, evitando tamanhos gigantescos com `fontScale > 1.2`.
3. **Listas**: Usar `FlatList` ou `ScrollView` com `keyboardShouldPersistTaps="handled"` e `showsVerticalScrollIndicator={false}`.
4. **Cards**: Definir `minHeight`, `flex: 1` e `flexWrap: "wrap"` para ações em vez de larguras estáticas fixas.
5. **Modais**: Modais full screen ou bottom sheets em celulares; modais centralizados com `maxWidth: 520` em tablets.
