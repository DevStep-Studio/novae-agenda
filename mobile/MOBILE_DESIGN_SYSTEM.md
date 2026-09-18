# Mobile Design System

Ported from the web app's real, live design system — `src/app/globals.css` and
`src/components/**` in the root project — not approximated from memory. Every
value below is cited to a specific `globals.css` rule (or component file) so
it can be re-verified or re-synced later. **Do not hand-estimate a new value
for a component this file already documents.** If you need something not
covered here, go find the real web rule first (grep `globals.css`), add it
here with a citation, then use it — that discipline is the entire reason this
file exists (see "Why this file exists" below).

The single source of truth for every token is
[`src/constants/design-tokens.ts`](src/constants/design-tokens.ts). This file
is documentation *about* that file — if they ever disagree, the `.ts` file is
correct and this file is stale and needs updating.

## Why this file exists

The first pass at the mobile UI copied two hex codes (`#dcff4c`, `#080808`)
from `globals.css` and rebuilt every screen with hand-picked `StyleSheet`
values (`fontSize: 22`, `borderRadius: 14`, `fontWeight: "700"`, ...). Colors
matched; nothing else did, because nothing else was ever measured against the
source — it was reconstructed from memory of what a "card" or a "button"
generally looks like. That's a generic app wearing Reservei's color, not
Reservei.

**Wrong reference screen for login.** There are two unrelated dark auth
layouts in `globals.css`: the simple centered `.auth-shell`/`.auth-card`
(used by onboarding/verify-email/password-reset) and the real production
`/login` screen, which is a completely different split-layout component
(`.auth-split-*`, `src/components/auth/auth-screen.tsx`) with a banner
image, icon-adorned inputs, a divider, and a secondary bordered button. The
first pass at mobile login matched the *wrong one* — the simpler,
unused-by-login pattern — because it was the first lime-colored block found
in `globals.css`, not the one `/login` actually renders. This is exactly the
kind of mistake a side-by-side screenshot against the real, running web app
catches immediately and a code-only read of one CSS block does not — that's
why the verification section below is not optional process, it's how this
was actually caught.

**On the primary color — code vs. product decision.** An earlier pass of
this file argued blue (`#3b82f6`) was the correct app-wide accent, reasoning
from `globals.css:105` (`:root[data-theme="dark"] { --primary: #3b82f6 }`)
and `theme-utils.ts`'s `PRIMARY_COLOR_PRESETS[0]` (id `"blue"`, labeled
"Azul Elétrico (Padrão)"). That reasoning was checked twice — once by
grepping every `--primary:` in `globals.css`, once by registering a fresh,
un-customized tenant and confirming its live dashboard renders blue — and
both checks were accurate: that combination of CSS + code genuinely is what
a brand-new, non-customized company sees on the web today. **Ian (product
owner) then corrected this directly: the system's primary color is lime,
full stop, not blue.** Lime is now `colors.primary` everywhere in the mobile
app (see Colors below) — there's no more `authColors`/`scope` split between
"app" and "auth" palettes, because there's only one palette. The lesson isn't
"the grep was wrong" — it wasn't — it's that a technical default in code
answers "what does an uncustomized tenant render today," not "what is the
brand's color." Those can differ, and when they do, the product owner's
answer wins. If you're extending this system and a similar question comes up
(is a coded default actually the intended brand choice?), that's worth
confirming rather than assuming the more heavily-cross-checked answer is
automatically the right one.

## Colors

Source: `src/app/globals.css:78-135` (`:root[data-theme="dark"]`). The mobile
app is dark-only (see `src/hooks/use-theme.ts`), so only that branch is
ported — there is no light-mode token set here.

| Token (`colors.*`) | Value | Web variable |
|---|---|---|
| `background` | `#080808` | `--background` |
| `backgroundSecondary` | `#0d0d0d` | `--background-secondary` |
| `backgroundTertiary` | `#141414` | `--background-tertiary` |
| `surface` | `#121212` | `--surface` |
| `surfaceSecondary` | `#181818` | `--surface-secondary` |
| `surfaceTertiary` | `#202020` | `--surface-tertiary` |
| `surfaceHover` | `#222222` | `--surface-hover` |
| `surfaceActive` | `#2a2a2a` | `--surface-active` |
| `border` | `#222222` | `--border` |
| `borderHover` | `#333333` | `--border-hover` |
| `borderStrong` | `#444444` | `--border-strong` |
| `textPrimary` | `#f5f5f5` | `--text-primary` |
| `textSecondary` | `#a3a3a3` | `--text-secondary` |
| `textMuted` | `#737373` | `--text-muted` |
| `textDisabled` | `#444444` | `--text-disabled` |
| `primary` | `#dcff4c` | hardcoded on web for `.auth-split-primary-btn`/`.auth-shell` — now the app-wide accent everywhere in mobile, see below |
| `primaryHover` | `#c8ed32` | — |
| `primarySoft` | `rgba(220,255,76,.16)` | — |
| `primaryForeground` | `#0a0a0a` | — |
| `success` / `successSoft` | `#10b981` / `rgba(16,185,129,.15)` | `--success` |
| `warning` / `warningSoft` | `#f2c26d` / `#4d3d1d` | `--warning` |
| `danger` / `dangerSoft` | `#ee8a8f` / `rgba(79,45,49,.5)` | `--danger` |
| `info` / `infoSoft` | `#8ec1f5` / `#243f5d` | `--info` |
| `purple` / `purpleSoft` | `#c7abd7` / `#3a2d48` | `--purple` |

**`primary` is lime everywhere in mobile — confirmed directly by Ian.** See
"On the primary color" above for the full story: the web's own dark-mode
default for a non-customized tenant is technically blue (`--primary:
#3b82f6`, `globals.css:105`), and is also per-tenant customizable
(`src/lib/theme-utils.ts` `PRIMARY_COLOR_PRESETS`, 9 presets). None of that
changes the answer for mobile — the app doesn't read a tenant's saved brand
color at all, it just uses lime as a fixed constant. If the product later
wants per-tenant white-label color on mobile too, that's new work (fetch
`primaryColor`, thread it through in place of the constant), not a revert to
blue.

There is no more `authColors` / `scope` split in the component API — Button
and TextField used to take a `scope="auth" | "dark"` prop to pick between two
palettes; now there's only one palette, so it was removed rather than left
in place as a no-op. If you're reading old code or an old version of this
file that mentions `scope`, it's stale.

### `authSplit` — one-off values specific to `/login`

The real login screen's inputs/banner/divider use a *second* dark surface
(`#181b23`/`#282d3b`/`#0d0f12`) that doesn't match the general `colors.*`
tokens — confirmed by reading `.auth-split-input`/`.auth-split-layout`
directly (`globals.css:9353-9679`). Kept as its own token group
(`authSplit.*` in `design-tokens.ts`) rather than forced into `colors`,
because that's what the source actually does.

## Radius

Source: `globals.css:60-62` (`--radius-sm/md/lg`).

| Token | Value | Used for |
|---|---|---|
| `radius.sm` | 8px | Buttons, icon buttons, metric icon badge |
| `radius.md` | 12px | Cards (metric card, submetric card) |
| `radius.lg` | 16px | Panels, modals |
| `radius.pill` | 999px | Badges/chips, switch track |

The real `/login` screen's inputs and primary button use **10px**
specifically (`.auth-split-input`/`.auth-split-primary-btn`,
`globals.css:9536-9660`) — not `radius.md`. That's a literal, cited value
from that component, not a drift from the scale; ported as-is.

Web spacing/padding is **not** a clean 4/8pt grid (confirmed by frequency
count across `globals.css` — 7px, 9px, 11px, 13px, 14px, 17px, 18px, 21px all
appear repeatedly as deliberate, hand-tuned values). Don't round a cited
value to the nearest "nice" number to fit a scale that the source itself
doesn't follow.

## Typography

Two font families, loaded via `@expo-google-fonts/*` and wired up in
`src/app/_layout.tsx` with `useFonts` (gates the splash screen — see that
file):

- **Plus Jakarta Sans** (`fontFamily.display*`) — headings and numeric
  values. Web loads weights 500/600/700 (`globals.css:1`); the real `/login`
  title needs **800** (`.auth-split-title`, `globals.css:9473-9480`,
  `font-weight: 800`), so `PlusJakartaSans_800ExtraBold` is loaded too rather
  than faking 800 by bolding 700.
- **DM Sans** (`fontFamily.body*`) — body text, the web's default
  (`globals.css:156`).

Every concrete type style used so far is in `typography.*` in
`design-tokens.ts`, each with its `globals.css` citation in a comment
alongside it (topbar title/company, page eyebrow/title/subtitle, metric card
label/value/detail, and the full `/login` set). **Values are the
mobile-breakpoint numbers**, not desktop — e.g. the metric card value is 17px
on phones (`globals.css:8846-8849`), not the 20px desktop size
(`globals.css:865`), because this app *is* that breakpoint. When you need a
type style this file doesn't have yet, find the real mobile-breakpoint rule
(check for a `@media (max-width: ...)` override near the desktop rule before
assuming the desktop number applies) and add it to `typography` with its
citation — don't inline a guessed `fontSize`.

## Components (`src/components/ui/`)

| Component | Mirrors | Notes |
|---|---|---|
| `Button` | `.auth-split-primary-btn` (globals.css:9644-9660) | height 48 / radius 10 / 15px-700. Desktop `.button`/`.btn` (36-38px) are *not* ported as-is — see "44px rule" below. **Always pass `style` as a plain array/object, never the `(state) => ...` function form** — NativeWind's babel transform merges `className` into the props-level `style`, and silently no-ops on a function value, which is exactly the bug that made the login button render as an invisible black box until caught by the emulator screenshot (see Verification). |
| `TextField` | `.auth-split-label`/`-input-wrap`/`-input` (globals.css:9501-9563) | Optional `icon` (left-inset, matches `.auth-split-input-icon`), `rightElement` (password-eye slot), `required` (lime asterisk). |
| `MetricCard` | `.metric-card`/`.metric-icon`/`.metric-copy` (globals.css:644-668, 853-866) at the mobile breakpoint (globals.css:8832-8864) | Icon badge + label + big value + muted detail line, in that structure — not a generic "stat box." |
| `TopBar` | `.topbar`/`.mobile-topbar-title`/`-company` at the mobile breakpoint (globals.css:8396-8449) | Full-bleed, owns its own top safe-area inset (pass via `Screen`'s `header` prop, which then skips the top edge on its own `SafeAreaView` to avoid double-padding). |
| `BottomTabBar` | `.mobile-bottom-nav`/`.mobile-nav-item`/`-indicator` (globals.css:8589-8648) | Custom `tabBar` render prop on `<Tabs>` (see `(owner)/_layout.tsx`) — the stock Expo Router tab bar tints icons with a theme color on active; the web does the opposite (plain white text/icon + a small white underline bar, on an always-dark bar, **not tinted by `--primary` at all**). This is intentionally a *different* mechanism, not a recolor. |
| `Screen` | layout shell | `header` prop for full-bleed content above the padded body (`TopBar`); `noPadding` to opt out of the default 20px horizontal padding entirely (used by login for its edge-to-edge banner image). |

### The "44px rule"

Several desktop button/input primitives are shorter than the accessible
touch-target minimum (`.button`/`.btn` are 36-38px tall —
`globals.css:556-580`). The web team's own history shows they know this is a
real problem on touch surfaces (see `git log --oneline -i --grep=toque` in
the root project for a fix specifically about a sub-44px touch target). Where
the *real, currently-shipping mobile-facing* version of a component specifies
a taller size — `/login`'s `.auth-split-primary-btn`/`-input` are 48px, its
`.auth-split-secondary-btn` is 46px — that's what's ported, because it's both
more accessible and the actual cited mobile value. Never introduce a new
interactive element under 44px.

## Icons

`lucide-react-native` (not `@expo/vector-icons`/Ionicons) — same icon set as
the web's `lucide-react`, so glyph shapes match exactly instead of being
approximated by a different icon family. Confirmed the web's icon usage via
`grep -rl "from \"lucide-react\"" src` (62 of 85 `.tsx` files) before picking
this. When a new screen needs an icon, check what the equivalent web
component actually imports from `lucide-react` and use the same name from
`lucide-react-native` — don't substitute a similar-looking Ionicon.

## Screens ported this round

- **Login** (`(auth)/login.tsx`) — the real `/login` split-layout screen
  (`auth-split-*`), not the simpler unused-by-login `auth-shell` pattern (see
  "Why this file exists"). Banner image and wordmark logo copied from
  `public/login-img.png` / `public/logo.png` in the root project into
  `mobile/assets/images/` (`login-banner.png`, `reservei-logo.png`) — if the
  web ever swaps those assets, re-copy them here.
- **Owner dashboard** (`(owner)/index.tsx`) — `TopBar` (title "Visão geral" +
  company name) + the page's real greeting header (eyebrow "ACOMPANHE O DIA
  DE HOJE" / "Olá! Aqui está seu dia" / subtitle,
  `src/components/app-shell.tsx:328-333`) + the 5-card KPI grid in the web's
  exact order (Atendimentos hoje, Receita prevista, Receita realizada,
  Receita pendente, Clientes atendidos — `app-shell.tsx:417-458`). "Receita
  pendente" is `max(0, forecast - realized)` computed client-side, matching
  `app-shell.tsx:318` exactly (no new endpoint needed).
- **Tab bar / routing** (`(owner)/_layout.tsx`) — custom `BottomTabBar`
  matching `.mobile-bottom-nav`'s chrome (dark bar, white active state +
  underline, not `--primary`-tinted).
- **Agenda, day view** (`(owner)/agenda.tsx`) — mirrors `CalendarPage`'s "day"
  mode (`app-shell.tsx:6617-6752`): header (eyebrow "AGENDA DO
  ESTABELECIMENTO" / date / "{n} atendimentos · {valor} previsto"), then a
  date-nav row replicating `.calendar-date-controls`'s actual order — Hoje,
  ←, →, date label (`flex:1`, centered in the remaining space) — not a
  guessed "arrows flank a centered label" layout, then the appointment list.
  New shared components built for this, each cited to a real web rule:
  `Avatar` (`.avatar`/`.avatar-initials` — dark mode forces one flat color via
  `!important`, so the web's hashed-pastel `avatarColor()` palette does NOT
  apply here and isn't ported), `StatusBadge` (`.status-badge`/`.status-dot`
  + the real per-status color map), `AppointmentCard`
  (`.appointment-card`/`-body`/`-top`/`-main`/`-meta`). Also fixed a real copy
  bug while building this: `mobile/src/lib/appointments.ts`'s
  `STATUS_LABELS` had "Agendado"/"Aguardando", which don't match the web's
  actual copy ("Aguardando confirmação"/"Cliente chegou" —
  `src/lib/client-utils.ts`).
- **Clientes** (`(owner)/clientes.tsx`) — mirrors `ClientsPage`
  (`app-shell.tsx:864-994`): header, the same 4-card `MetricCard` grid
  (Total de clientes / Clientes mensalistas / Clientes frequentes / Ticket
  médio, same copy/order/icons — confirming the pattern this project's
  original brief called out: dashboard-style metric cards reused verbatim
  elsewhere), a search bar (debounced, hits the real `GET /api/clients?q=`
  server-side filter rather than holding an unbounded client-side list),
  then a card per client. **`ClientCard` is a deliberate adaptation, not a
  citation** — the web's list is an actual `<table>`
  (`.client-data-table`) that on mobile just gets `overflow-x: auto` and
  stays a cramped, sideways-scrolling desktop table
  (`.data-table { min-width: 680px }`); RN has no table primitive, and that
  scroll pattern isn't worth reproducing natively. The card instead
  recomposes the table's own real cell styles — `.client-name-text`,
  `.client-badge`/`.badge-{vip,frequent,new}`, `.client-whatsapp-btn`,
  `.client-visits-num`/`-unit`, `.client-total-spent`/`-spending-detail`,
  all cited individually in `design-tokens.ts` — into a vertical layout
  matching `AppointmentCard`'s shell. The WhatsApp button is real (opens
  `wa.me` via `Linking.openURL`, same URL shape as the web's
  `formatPhoneForWhatsApp`), not a static pill. Also ported exactly, including
  an inconsistency that's real on the web today, not a bug introduced here:
  the per-card VIP/Frequente/Novo badge threshold (visits≥3 or spent≥250,
  `clientTier()`) is stricter than the page-level "Clientes frequentes" KPI
  threshold (visits≥2 or spent≥200, `isFrequentOrVip()`) — the two numbers
  on screen legitimately won't line up with each other, on web or here.

### Intentionally not ported (with reasons — not oversights)

- **Dashboard action buttons** ("Personalizar início" opens a
  dashboard-customization modal; "Novo agendamento" opens the full
  appointment-creation flow) — neither feature exists in the mobile app yet.
  Shipping the buttons with no destination would be a fake affordance.
- **Trial/subscription banner** (`TrialStatusCard`) and the **cover-photo
  banner card** (logo/cover upload) — SaaS paywall UI and a branding-upload
  feature respectively; out of scope for a visual-system pass, and the
  engagement's own sequencing puts IAP/entitlement in a later, dedicated
  phase.
- **"Lembrar de mim" checkbox** — on web this exists because browsers don't
  otherwise persist login; the mobile session already persists indefinitely
  via `expo-secure-store`, so the equivalent control would do nothing.
- **"Esqueceu a senha?" link** — no forgot-password screen or API wrapper
  exists in `src/lib/auth.ts` yet. The backend routes already exist
  (`POST /api/auth/forgot-password`, `/reset-password` — see the engagement's
  Sprint 1 notes); wiring a mobile screen to them is real, addressable
  follow-up work, not something to fake as a dead link.
- **Full `.mobile-bottom-nav` item set** (web has Início/Agenda/[+Novo
  FAB]/Clientes/Menu). Início/Agenda/Clientes/Mais all exist as real mobile
  screens now; only the center "Novo" FAB (appointment creation) is still
  missing. The bar is built to take it — same `BottomTabBar` component, same
  route-driven rendering — the moment that flow exists. Do not add a
  placeholder button that navigates nowhere before then.
- **Agenda's quick-actions row** (`.appointment-card-actions` — check-in/
  finish/cancel buttons per card) and the **week/month view switcher +
  employee filter** on the same page — `AppointmentCard` is read-only for
  now and only "day" mode is ported. Same reasoning as above: these need
  either a status-transition flow or a heavier calendar-grid component that
  don't exist yet.
- **Clientes' 6-way segment tabs** (Todos/Mensalistas/Frequentes/Novos/Com
  agendamento/Sem retorno), its **sort dropdown**, and **"Novo cliente"** —
  the list is fixed to the web's default sort (visits desc) and unfiltered
  beyond the search box; client creation doesn't exist in mobile yet.

## Verification (this round)

Side-by-side screenshots, not impression — see the attached report. Method:

1. Registered a fresh, un-customized test account via `POST /api/auth/register`
   against the shared local dev server (`mobile-parity-qa@novae.local`) rather
   than reusing/reseeding the shared dev database, which has other in-progress
   work on it. Purely additive; safe to leave in place.
2. **Web reference**: Playwright, real Chromium, 390×844 viewport (the actual
   ≤480px CSS breakpoint every phone this app targets falls under), navigated
   to `/login` and `/gestao` against the same running dev server.
   `localhost`, not `127.0.0.1` — the dev server's HMR/dev-origin check
   silently hangs client hydration on `127.0.0.1` (a pre-existing dev-server
   quirk, unrelated to this work, worth knowing if a future screenshot run
   mysteriously hangs on "Carregando sua agenda...").
3. **Mobile**: real Android emulator (`Medium_Phone` AVD), Expo Go (SDK 57;
   confirmed compatible — nothing this app currently imports requires a
   custom dev client; `expo-glass-effect`/`@expo/ui` are installed but
   unused), pointed at the same dev server via `10.0.2.2:3000`. No iOS
   Simulator is available in this environment (Xcode isn't installed, only
   Command Line Tools) — iOS-specific rendering has not been checked and
   should be, on a machine that has it.
4. Logged in through the real login screen with the real credentials on
   device (not a deep-linked/pre-authenticated shortcut), to exercise the
   actual flow, not just the destination screen.

This is also how the Button/NativeWind bug above was actually found: it was
invisible in code review (the logic reads correctly) and only showed up as a
plain black rectangle where the lime "Entrar" button should have been, once
rendered on device.

## Adding a new screen

1. Find the real web component/CSS for what you're building — grep
   `globals.css` and read the actual `.tsx`, don't infer from a similarly-named
   screen. (This round's login mistake happened *precisely* by assuming a
   similarly-themed block was the right one without checking what `/login`
   itself renders.)
2. Reuse a `src/components/ui/*` primitive if one fits. If you need a type
   style, color, or radius this file doesn't list, find its real
   mobile-breakpoint value and add it to `design-tokens.ts` with a citation
   before using it inline.
3. Build the screen with NativeWind `className` for static layout (flex,
   gap, padding) and `style`/token values for anything data-driven (colors,
   computed sizes) — never a raw hex or px number that isn't traceable to a
   token.
4. Take a real screenshot on-device and place it next to a same-viewport
   screenshot of the equivalent web page before calling it done.
