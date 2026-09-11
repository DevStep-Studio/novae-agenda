# ⚡ Reservei — Manual de Identidade Visual & Design System

Guia oficial de padronização visual do sistema **Reservei**, consolidado a partir da interface da **Home / Dashboard principal**. Este documento serve como referência única para componentes, formulários, inputs, cores e tipografia em todas as telas da plataforma.

---

## 🎨 1. Filosofia e Paleta de Cores (Pure Dark & Pure Lime)

A identidade visual do Reservei adota um tema **Pure Dark** com contraste cirúrgico, bordas sutis e acentos em **Pure Lime** (`#dcff4c`), transmitindo tecnologia, velocidade e sofisticação.

### Tokens de Cores Primárias

| Token / Variável | Valor Hex | Descrição / Uso |
|---|---|---|
| `--background` | `#080808` / `#0c0c0c` | Fundo principal da aplicação |
| `--surface` | `#121212` | Superfície de cartões, seções e modais |
| `--surface-secondary` | `#181818` | Fundo de inputs, selects, headers e elementos secundários |
| `--surface-tertiary` | `#222222` | Hover de cards, badges e backgrounds de ícones |
| `--border` | `#262626` | Bordas padrão de cartões, tabelas e inputs |
| `--border-strong` | `#383838` | Hover de bordas e divisores ativos |
| `--primary` | `#dcff4c` | **Pure Lime** — Acentos principais, foco, badges ativos, CTAs |
| `--primary-soft` | `rgba(220, 255, 76, 0.12)` | Fundo sutil de pills ativas, tags e hover de botões |
| `--text-primary` | `#ffffff` / `#f5f5f5` | Textos principais, títulos e valores em destaque |
| `--text-secondary` | `#a3a3a3` | Rótulos de campo, legendas e textos de apoio |
| `--text-muted` | `#737373` | Dicas, placeholders e ícones inativos |

### Cores Semânticas e de Status

- **WhatsApp Oficial:** `#25d366` (Hover: `#20ba59`, Fundo com texto `#080808` escuro para contraste máximo)
- **Sucesso (Confirmado / Ativo):** `#22c55e`
- **Aviso (Pendente / Trial):** `#f59e0b`
- **Perigo / Cancelado:** `#ef4444`
- **Informação / Sistema:** `#38bdf8`

---

## 🔤 2. Tipografia

- **Família Tipográfica:** `"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif`
- **Títulos de Seção / Cards:** `font-weight: 700; letter-spacing: -0.3px;`
- **Rótulos de Formulário (`.field-label`):** `font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-secondary);`
- **Inputs & Selects:** `font-size: 13.5px; font-weight: 500;`

---

## 📝 3. Padronização Oficial de Formulários e Inputs

Todos os elementos de formulário do sistema devem seguir rigorosamente o padrão abaixo:

### A. Inputs de Texto, Data, Hora e Busca (`.input`, `input`)

```css
.input,
input[type="text"],
input[type="email"],
input[type="tel"],
input[type="password"],
input[type="number"],
input[type="date"],
input[type="time"],
input[type="search"] {
  width: 100%;
  height: 42px; /* 46px em modais amplos */
  padding: 0 14px;
  background: var(--surface-secondary, #181818);
  border: 1px solid var(--border, #262626);
  border-radius: 10px;
  color: var(--text-primary, #ffffff);
  font-size: 13.5px;
  font-family: inherit;
  outline: none;
  transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}

.input:hover {
  border-color: var(--border-strong, #383838);
  background: var(--surface-tertiary, #1f1f1f);
}

.input:focus {
  border-color: var(--primary, #dcff4c) !important;
  background: var(--surface-tertiary, #1f1f1f);
  box-shadow: 0 0 0 3px rgba(220, 255, 76, 0.16) !important;
}
```

### B. Selects Customizados (`.select`, `select`)

Nenhum `<select>` deve exibir a seta padrão do sistema operacional. O chevron vetorial customizado é aplicado automaticamente:

```css
.select,
select {
  width: 100%;
  height: 44px;
  padding: 0 42px 0 14px;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background: var(--surface-secondary, #181818);
  border: 1px solid var(--border, #262626);
  border-radius: 10px;
  color: var(--text-primary, #ffffff);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a3a3a3' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  background-size: 16px;
  outline: none;
  transition: all 0.18s ease;
}

.select:hover {
  border-color: var(--border-strong, #383838);
  background-color: var(--surface-tertiary, #1f1f1f);
}

.select:focus {
  border-color: var(--primary, #dcff4c) !important;
  box-shadow: 0 0 0 3px rgba(220, 255, 76, 0.16) !important;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23dcff4c' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
}

/* Itens internos do Dropdown */
select option {
  background: #181818 !important;
  color: #f5f5f5 !important;
  padding: 10px 14px;
}
```

### C. Estrutura Padrão de Campo (`.field`) com Ícone

```tsx
<div className="field">
  <label className="field-label">
    <User size={14} className="label-icon" />
    Selecione o Profissional
  </label>
  
  <div className="modal-input-wrap">
    <User size={16} className="modal-input-icon" />
    <select className="select-input" value={employeeId} onChange={...}>
      <option value="">Selecione um profissional da equipe</option>
      {employees.map(e => (
        <option key={e.id} value={e.id}>{e.name}</option>
      ))}
    </select>
  </div>
  
  <span className="field-hint">Defina quem atenderá este agendamento.</span>
</div>
```

---

## 🔘 4. Padrão de Botões e Ações

| Tipo de Botão | Classe / Estilo | Aplicação |
|---|---|---|
| **CTA Primário** | `.button.primary` / `bg: #dcff4c, color: #080808` | Ação principal (Salvar, Agendar, Criar) |
| **Secundário** | `.button.secondary` / `bg: #181818, border: #262626` | Cancelar, Fechar, Voltar |
| **WhatsApp Oficial** | `.whatsapp-button` / `bg: #25d366, color: #080808` | Abertura direta do WhatsApp do cliente |
| **Ação Rápida / Edição** | `.team-edit-pill` / `.modern-team-btn` | Editar profissional, alterar horário |
| **Abas de Filtro** | `active: bg rgba(220, 255, 76, 0.1), color: #dcff4c` | Navegação por abas e categorias |

---

## 📦 5. Cards, Modais e Painéis

- **Cards da Home / Métricas:** `border-radius: 12px; background: var(--surface); border: 1px solid var(--border);`
- **Modais:** `border-radius: 16px; background: #121212; border: 1px solid #222222; box-shadow: 0 24px 60px rgba(0,0,0,0.85);`
- **Backdrop:** `background: rgba(0, 0, 0, 0.82); backdrop-filter: blur(12px);`
- **Header do Modal:** `background: #181818; border-bottom: 1px solid #222222; padding: 20px 24px 16px;`

---

## 🚀 6. Checklist de Implementação de Novas Telas

Ao criar ou editar qualquer tela do Reservei, garanta:
1. [ ] **Nenhum input ou select nativo sem classe ou sem customização visual**.
2. [ ] **Labels em caixa alta reduzida (11.5px) com tracking suave (`letter-spacing: 0.6px`)**.
3. [ ] **Foco interativo com halo em Pure Lime (`#dcff4c`)**.
4. [ ] **Options de `<select>` com fundo `#181818` e texto `#ffffff`**.
5. [ ] **Botões de WhatsApp em verde oficial (`#25d366`) com ícone vetorizado**.
6. [ ] **Testes automatizados e verificação de tipos aprovados (`npm run typecheck` e `npm test`)**.
