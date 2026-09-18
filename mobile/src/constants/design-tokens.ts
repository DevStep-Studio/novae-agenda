/**
 * Single source of truth for the mobile design system, ported from the web
 * app's `src/app/globals.css` (root project) so `tailwind.config.ts` and any
 * RN component that needs a raw value (icon `color=`, `ActivityIndicator`,
 * `StatusBar`) read the exact same numbers.
 *
 * Every value below is copied from a specific globals.css rule, not
 * estimated — see MOBILE_DESIGN_SYSTEM.md at the repo root for the citation
 * (file:line) behind each one. Do not "round" or "tidy up" these numbers:
 * the web CSS is a hand-tuned, non-4/8pt scale (confirmed by full-repo
 * audit), and drifting from the literal values is exactly the kind of
 * approximation that broke parity the first time.
 *
 * The mobile app is dark-only (see src/hooks/use-theme.ts), so only the
 * `:root[data-theme="dark"]` branch of globals.css is ported here.
 *
 * Primary color: confirmed directly by Ian (product owner) — lime
 * (`#dcff4c`) is the brand's primary color across the whole app, full stop.
 * Note for whoever reads globals.css next and finds this confusing: the
 * *web* codebase's own default for a freshly-onboarded, non-customized
 * tenant is technically blue (`--primary: #3b82f6` in dark mode,
 * `theme-utils.ts` `PRIMARY_COLOR_PRESETS[0]` = "Azul Elétrico (Padrão)"),
 * and every company in the dev DB at the time of this check had no
 * `primaryColor` override — so that blue really is what a plain `/gestao`
 * screenshot shows today. That's a true fact about the web's current coded
 * default, not a mistaken reading of it. It just isn't the answer to "what's
 * the system's primary color" — that's a product/brand question, and the
 * product owner's answer is lime. Don't rediscover blue via grep and revert
 * this without checking with him first.
 */

export const colors = {
  background: "#080808",
  backgroundSecondary: "#0d0d0d",
  backgroundTertiary: "#141414",

  surface: "#121212",
  surfaceSecondary: "#181818",
  surfaceTertiary: "#202020",
  surfaceHover: "#222222",
  surfaceActive: "#2a2a2a",

  border: "#222222",
  borderHover: "#333333",
  borderStrong: "#444444",

  textPrimary: "#f5f5f5",
  textSecondary: "#a3a3a3",
  textMuted: "#737373",
  textDisabled: "#444444",
  textInverse: "#080808",

  // App-wide accent (dashboard, agenda, buttons, links, active nav state,
  // focus rings) — lime, confirmed by the product owner as the system's
  // primary color. Same hex the web hardcodes for `.auth-split-primary-btn`/
  // `.auth-shell` (globals.css:9644-9679, 10307-10312), now used everywhere
  // in the mobile app rather than being auth-only.
  primary: "#dcff4c",
  primaryHover: "#c8ed32",
  primarySoft: "rgba(220, 255, 76, 0.16)",
  primaryForeground: "#0a0a0a",

  success: "#10b981",
  successSoft: "rgba(16, 185, 129, 0.15)",
  warning: "#f2c26d",
  warningSoft: "#4d3d1d",
  danger: "#ee8a8f",
  dangerSoft: "rgba(79, 45, 49, 0.5)",
  info: "#8ec1f5",
  infoSoft: "#243f5d",
  purple: "#c7abd7",
  purpleSoft: "#3a2d48",
} as const;

/**
 * Structural values specific to the real /login screen (`.auth-split-*`,
 * globals.css:9353-9679), at the ≤480px mobile breakpoint (globals.css:
 * 9983-9987) — every phone this app runs on falls under that breakpoint.
 * Kept separate from `colors` because these hex values don't match the
 * app's general dark tokens; they're a one-off dark surface used only here.
 */
export const authSplit = {
  bannerHeight: 110,
  inputBackground: "#181b23",
  inputBorder: "#282d3b",
  formBackground: "#0d0f12",
  mutedIcon: "#94a3b8",
  errorBackground: "rgba(239, 68, 68, 0.15)",
  errorBorder: "rgba(239, 68, 68, 0.35)",
  errorText: "#fca5a5",
} as const;

// globals.css:60-62 (--radius-sm/md/lg). Pill = the 999px value used by
// badges/chips/switch tracks throughout (e.g. .modal-eyebrow, .auth-role-chip).
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const fontFamily = {
  // globals.css:1-3 — headings and numeric values use Plus Jakarta Sans,
  // body text defaults to DM Sans (globals.css:156).
  display: "PlusJakartaSans_700Bold",
  displaySemibold: "PlusJakartaSans_600SemiBold",
  displayExtraBold: "PlusJakartaSans_800ExtraBold",
  body: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
  bodySemibold: "DMSans_600SemiBold",
  bodyBold: "DMSans_700Bold",
} as const;

/**
 * Concrete type styles, each cited to the globals.css rule it mirrors.
 * Values are the MOBILE-breakpoint numbers where the web has a
 * `@media (max-width: ...)` override (e.g. metric card value is 17px on
 * phones, not the 20px desktop size) — this app IS that breakpoint.
 */
export const typography = {
  // .mobile-topbar-title, globals.css:8431-8439
  topbarTitle: { fontFamily: fontFamily.bodyBold, fontSize: 16, letterSpacing: -0.4, lineHeight: 19 },
  // .mobile-topbar-company, globals.css:8441-8449
  topbarCompany: { fontFamily: fontFamily.bodyMedium, fontSize: 11.5, lineHeight: 13 },
  // .eyebrow at the mobile breakpoint, globals.css:8751-8762 (color is
  // applied separately — always colors.primary)
  eyebrow: { fontFamily: fontFamily.bodyBold, fontSize: 11, letterSpacing: 0.88, lineHeight: 14 },
  // .page-intro h1 at the mobile breakpoint, globals.css:8743-8750
  pageTitle: { fontFamily: fontFamily.displayExtraBold, fontSize: 24, letterSpacing: -0.84, lineHeight: 29 },
  // .intro-copy at the mobile breakpoint, globals.css:8763-8770
  pageSubtitle: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 20 },
  // .metric-copy p, globals.css:864 (label)
  metricLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 11, lineHeight: 14 },
  // .metric-copy strong at the mobile breakpoint, globals.css:8846-8849 (20px desktop -> 17px phone)
  metricValue: { fontFamily: fontFamily.display, fontSize: 17, letterSpacing: -0.4, lineHeight: 20 },
  // .metric-detail, globals.css:866
  metricDetail: { fontFamily: fontFamily.body, fontSize: 10, lineHeight: 13 },
  // .auth-split-title, globals.css:9473-9480 — the real /login screen (there
  // are two unrelated auth layouts in globals.css; `.auth-card`/`.auth-shell`
  // is onboarding/password-reset, not login. See MOBILE_DESIGN_SYSTEM.md.
  authTitle: { fontFamily: fontFamily.displayExtraBold, fontSize: 28, letterSpacing: -0.84, lineHeight: 34 },
  // .auth-split-subtitle, globals.css:9482-9487
  authSubtitle: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21 },
  // .auth-split-label, globals.css:9501-9508
  fieldLabel: { fontFamily: fontFamily.bodySemibold, fontSize: 13, lineHeight: 16 },
  // .auth-split-primary-btn, globals.css:9644-9660
  authSubmitLabel: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 18 },
  // .auth-split-error, globals.css:9796-9814
  authError: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  // .modal-title / .modal-header h2, globals.css:4881-4891 (kept for future modal work)
  modalTitle: { fontFamily: fontFamily.bodyBold, fontSize: 17, letterSpacing: -0.3, lineHeight: 21 },
  // .modal-eyebrow, globals.css:4932-4946 (kept for future modal/badge work)
  pillLabel: { fontFamily: fontFamily.bodySemibold, fontSize: 10, letterSpacing: 0.6, lineHeight: 13 },
  // .appointment-time, globals.css:1769-1773
  appointmentTime: { fontFamily: fontFamily.display, fontSize: 15, letterSpacing: -0.3, lineHeight: 18 },
  // .status-badge, globals.css:1673 (not uppercase — confirmed from the actual .status-* rules, unlike client-badge/timeline pills elsewhere)
  statusBadge: { fontFamily: fontFamily.bodySemibold, fontSize: 10, lineHeight: 13 },
  // .appointment-client strong, globals.css:1787-1793
  clientName: { fontFamily: fontFamily.displaySemibold, fontSize: 14, lineHeight: 17 },
  // .appointment-client small, globals.css:1794-1801
  clientMeta: { fontFamily: fontFamily.bodyMedium, fontSize: 12, lineHeight: 15 },
  // .appointment-meta, globals.css:1806-1823
  appointmentMetaText: { fontFamily: fontFamily.body, fontSize: 11.5, lineHeight: 14 },
  // .appointment-meta strong, globals.css:1824-1829
  appointmentPrice: { fontFamily: fontFamily.display, fontSize: 13.5, letterSpacing: -0.2, lineHeight: 16 },
  // .client-name-text, globals.css:3441-3446 — DM Sans (no explicit
  // font-family override on the web rule), unlike the appointment card's
  // client name which does set Plus Jakarta Sans. Not the same token.
  clientCardName: { fontFamily: fontFamily.bodySemibold, fontSize: 13, letterSpacing: -0.14, lineHeight: 16 },
  // .client-sub-info, globals.css:3447-3453
  clientCardSub: { fontFamily: fontFamily.body, fontSize: 11, lineHeight: 14 },
  // .client-whatsapp-btn, globals.css:3501-3522
  whatsappPill: { fontFamily: fontFamily.bodyMedium, fontSize: 12, letterSpacing: 0.1, lineHeight: 15 },
  // .client-visits-num / .client-visits-unit, globals.css:3635-3642
  clientVisitsNum: { fontFamily: fontFamily.bodySemibold, fontSize: 12, lineHeight: 15 },
  clientVisitsUnit: { fontFamily: fontFamily.body, fontSize: 11, lineHeight: 14 },
  // .client-total-spent / .client-spending-detail, globals.css:3660-3669
  clientTotalSpent: { fontFamily: fontFamily.bodySemibold, fontSize: 13, lineHeight: 16 },
  clientSpendingDetail: { fontFamily: fontFamily.body, fontSize: 10, lineHeight: 13 },
  // .client-badge, globals.css:3455-3466
  clientBadgeLabel: { fontFamily: fontFamily.bodySemibold, fontSize: 10, letterSpacing: 0.3, lineHeight: 13 },
  // .team-status-badge / .team-commission-badge, globals.css:11672-11712
  teamStatusBadge: { fontFamily: fontFamily.bodyBold, fontSize: 10, letterSpacing: 0.4, lineHeight: 13 },
  teamCommissionBadge: { fontFamily: fontFamily.bodySemibold, fontSize: 10, lineHeight: 13 },
  // .modern-team-name / .modern-team-role, globals.css:11730-11741
  teamName: { fontFamily: fontFamily.bodyBold, fontSize: 15, letterSpacing: -0.2, lineHeight: 18 },
  teamRole: { fontFamily: fontFamily.bodyMedium, fontSize: 11.5, lineHeight: 14 },
  // .team-stat-label / .team-stat-val, globals.css:11761-11773
  teamStatLabel: { fontFamily: fontFamily.bodySemibold, fontSize: 9, letterSpacing: 0.45, lineHeight: 12 },
  teamStatValue: { fontFamily: fontFamily.bodyBold, fontSize: 12, lineHeight: 15 },
  // .modern-service-chip / .modern-service-more, globals.css:11788-11809
  serviceChip: { fontFamily: fontFamily.bodyMedium, fontSize: 10.5, lineHeight: 13 },
  serviceMore: { fontFamily: fontFamily.bodyBold, fontSize: 9.5, lineHeight: 12 },
  // .service-card-body h3, globals.css:4613-4621 — the web asks for
  // font-weight 650; RN's cross-platform-reliable weights are the standard
  // 100-900 multiples of 100, so this uses 700 (bodyBold) as the nearest one
  // rather than an unreliable literal "650".
  serviceCardTitle: { fontFamily: fontFamily.bodyBold, fontSize: 18.5, letterSpacing: -0.25, lineHeight: 23 },
  // .service-card-desc, globals.css:4623-4635
  serviceCardDesc: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18 },
  // .service-category-badge, globals.css:4578-4595
  serviceCategoryBadge: { fontFamily: fontFamily.bodyMedium, fontSize: 11, lineHeight: 14 },
  // .service-price-tag, globals.css:4649-4656
  servicePrice: { fontFamily: fontFamily.bodyBold, fontSize: 20, letterSpacing: -0.4, lineHeight: 24 },
  // .service-duration-badge, globals.css:4657-4665
  serviceDuration: { fontFamily: fontFamily.bodyMedium, fontSize: 12, lineHeight: 15 },
  // .section-heading h2/p, globals.css:636-637
  sectionTitle: { fontFamily: fontFamily.displaySemibold, fontSize: 15, letterSpacing: -0.2, lineHeight: 19 },
  sectionDescription: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },
  // .rank-podium, globals.css:11299-11315
  rankPodium: { fontFamily: fontFamily.bodyBold, fontSize: 11.5, lineHeight: 14 },
  // .team-rank-info strong/small, globals.css:11347-11366
  rankName: { fontFamily: fontFamily.bodySemibold, fontSize: 13.5, lineHeight: 17 },
  rankSub: { fontFamily: fontFamily.body, fontSize: 11.5, lineHeight: 15 },
  // .team-rank-meta / .commission-text, globals.css:11400-11412
  rankMeta: { fontFamily: fontFamily.body, fontSize: 11, lineHeight: 14 },
  // .team-rank-revenue / -net, globals.css:11429-11443
  rankRevenue: { fontFamily: fontFamily.bodyBold, fontSize: 14.5, lineHeight: 18 },
  rankNet: { fontFamily: fontFamily.body, fontSize: 10.5, lineHeight: 13 },
} as const;

/**
 * .status-badge / .status-dot / .status-{scheduled,confirmed,waiting,
 * progress,finished,cancelled}, globals.css:1673-1681. `no_show` shares
 * `cancelled`'s color (app-shell.tsx `statusClass` map).
 */
export const statusColors = {
  scheduled: { color: colors.info, background: colors.infoSoft },
  confirmed: { color: colors.success, background: colors.successSoft },
  waiting: { color: colors.warning, background: colors.warningSoft },
  in_progress: { color: colors.purple, background: colors.purpleSoft },
  completed: { color: "#86efac", background: "rgba(34, 197, 94, 0.12)" },
  cancelled: { color: colors.danger, background: colors.dangerSoft },
  no_show: { color: colors.danger, background: colors.dangerSoft },
} as const;

/**
 * .client-badge base + .badge-{vip,frequent,new}, globals.css:3455-3492.
 * Every client falls into exactly one tier — see `clientTier()` in
 * src/lib/clients.ts.
 */
export const clientBadge = {
  vip: { color: "#f59e0b", background: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.25)", label: "VIP" },
  frequent: {
    color: "#34d399",
    background: "rgba(16, 185, 129, 0.12)",
    border: "rgba(16, 185, 129, 0.25)",
    label: "Frequente",
  },
  new: {
    color: "#c084fc",
    background: "rgba(168, 85, 247, 0.1)",
    border: "rgba(168, 85, 247, 0.22)",
    label: "Novo",
  },
} as const;

/**
 * .avatar / .avatar-initials in dark mode, globals.css:1619-1669. Note the
 * dark-theme rule forces this flat color with `!important` (which beats even
 * an inline style) — the hashed pastel `PALETTE` in the web's
 * `avatarColor()` (client-utils.ts) only actually shows in light mode, so it
 * is NOT ported here; every avatar in this dark-only app is this one color.
 */
export const avatar = {
  background: "#181d28",
  text: "#f1f5f9",
  sizes: { sm: 30, md: 38, lg: 56, xl: 72 },
} as const;

/**
 * .metric-icon / .metric-{teal,lilac,amber,rose}, globals.css:853-862, at
 * the mobile breakpoint (globals.css:8838-8842 shrinks the badge 34->28).
 * `teal` (the default, used by every metric card so far) is the only
 * variant with a border — `.metric-teal` adds one explicitly, the other
 * three inherit the base `.metric-icon` rule, which has none. Not an
 * oversight to replicate: it's what the literal CSS does.
 */
export const metricIcon = {
  size: 28,
  radius: radius.sm,
  variants: {
    teal: { color: colors.primary, background: colors.primarySoft, border: colors.border as string | undefined },
    lilac: { color: colors.purple, background: colors.purpleSoft, border: undefined as string | undefined },
    amber: { color: colors.warning, background: colors.warningSoft, border: undefined as string | undefined },
    rose: { color: colors.danger, background: colors.dangerSoft, border: undefined as string | undefined },
  },
} as const;

/**
 * .switch-control / .switch-slider, globals.css:1465-1503.
 */
export const toggle = {
  trackWidth: 40,
  trackHeight: 22,
  thumbSize: 14,
  thumbInset: 3,
} as const;

/**
 * Mobile bottom nav, globals.css:8589-8704 (`.mobile-bottom-nav`,
 * `.mobile-nav-item`, `.mobile-nav-indicator`). Note this is NOT tinted with
 * `--primary` at all on the web — active state is plain white text plus a
 * small white underline bar, on an always-dark bar regardless of app theme.
 */
export const bottomNav = {
  background: "#101216",
  height: 66,
  borderTopColor: "rgba(255, 255, 255, 0.08)",
  itemInactiveColor: "#94a3b8",
  itemActiveColor: "#ffffff",
  indicatorWidth: 22,
  indicatorHeight: 2.5,
  iconSize: 20,
  addButtonSize: 48,
} as const;

/**
 * .modern-team-card and its children, globals.css:11581-11876 — a real card
 * grid on web already (unlike Clientes' table), so this ports directly
 * rather than needing an adaptation.
 */
export const teamCard = {
  coverHeight: 84,
  coverOverlay: "rgba(0, 0, 0, 0.45)",
  avatarRingColor: colors.surface,
  activeDot: { online: "#22c55e", offline: colors.textMuted },
  statusBadge: {
    active: { background: "rgba(22, 101, 52, 0.85)", color: "#86efac", border: "rgba(74, 222, 128, 0.35)" },
    inactive: { background: "rgba(24, 24, 27, 0.85)", color: "#a1a1aa", border: "rgba(255, 255, 255, 0.15)" },
  },
  commissionBadge: { background: "rgba(120, 53, 15, 0.85)", color: "#fde68a", border: "rgba(251, 191, 36, 0.35)" },
  statsStrip: { background: colors.surfaceSecondary, border: colors.border },
  serviceChip: { background: colors.surfaceSecondary, border: colors.border, color: colors.textSecondary },
  serviceMore: { background: colors.primarySoft, color: colors.primary },
} as const;

/**
 * .service-card and its children, globals.css:4452-4700 — another real card
 * grid on web (like Equipe, unlike Clientes' table).
 */
export const serviceCard = {
  minHeight: 260,
  // .service-card-overlay's 4-stop gradient, globals.css:4483-4494.
  gradient: {
    colors: ["rgba(8, 8, 10, 0.45)", "rgba(10, 10, 14, 0.68)", "rgba(12, 12, 16, 0.88)", "rgba(10, 10, 14, 0.98)"] as [
      string,
      string,
      string,
      string,
    ],
    locations: [0, 0.35, 0.65, 1] as [number, number, number, number],
  },
  categoryBadge: { background: "rgba(0, 0, 0, 0.5)", border: "rgba(255, 255, 255, 0.16)", color: "rgba(255, 255, 255, 0.85)" },
  editPill: { background: "rgba(18, 18, 18, 0.75)", border: "rgba(255, 255, 255, 0.2)", color: "#ffffff" },
  deletePill: { background: "rgba(239, 68, 68, 0.2)", border: "rgba(239, 68, 68, 0.4)", color: "#ff6b6b" },
  descriptionColor: "rgba(255, 255, 255, 0.88)",
  footerBorder: "rgba(255, 255, 255, 0.14)",
  // .service-toggle-btn/-thumb, globals.css:4666-4697 (distinct from the
  // generic `toggle` tokens above — this one is specific to this card).
  toggle: { trackWidth: 44, trackHeight: 24, thumbSize: 18, thumbInset: 3, offColor: "rgba(255, 255, 255, 0.22)" },
} as const;

/**
 * .team-rank-item and children, globals.css:11239-11443 — the ranking row
 * used by Financeiro's "Profissionais que mais trabalharam".
 */
export const rankRow = {
  background: colors.surfaceSecondary,
  border: colors.border,
  podium: { background: "rgba(255, 255, 255, 0.04)", border: colors.border, color: colors.textMuted },
  podiumFirst: { background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.25)" },
  barTrack: "rgba(255, 255, 255, 0.08)",
  barFill: colors.primary,
  commissionText: "#f59e0b",
} as const;
