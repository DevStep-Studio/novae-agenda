// Shared copy-override + section-visibility config for the public booking page.
// Imported by both the server (branding API route, catalog builder) and the
// client (Branding Studio UI + its preview), so defaults never drift apart.

export type CopyOverrideKey =
  | "heroSubtitle"
  | "searchPlaceholder"
  | "emptyServicesTitle"
  | "emptyServicesBody"
  | "cancellationPolicyText"
  | "trustLine"
  | "ctaContinue"
  | "ctaConfirm"
  | "footerLine1"
  | "footerLine2";

export type CopyOverrides = Partial<Record<CopyOverrideKey, string>>;

export const COPY_OVERRIDE_DEFAULTS: Record<CopyOverrideKey, string> = {
  heroSubtitle: "Selecione o que deseja agendar.",
  searchPlaceholder: "Buscar serviço...",
  emptyServicesTitle: "Os serviços estarão aqui em breve.",
  emptyServicesBody:
    "Este estabelecimento ainda não disponibilizou serviços para reserva online.",
  // Empty default = the page falls back to the auto-generated sentence based
  // on the company's configured cancellationHours (see public-booking.tsx).
  cancellationPolicyText: "",
  trustLine: "Seus dados estão protegidos",
  ctaContinue: "Continuar",
  ctaConfirm: "Confirmar agendamento",
  footerLine1: "Agendamento online seguro com Nova(e)",
  footerLine2: "Seu tempo bem cuidado",
};

export const COPY_OVERRIDE_LABELS: Record<CopyOverrideKey, string> = {
  heroSubtitle: "Subtítulo da etapa de serviços",
  searchPlaceholder: "Texto do campo de busca",
  emptyServicesTitle: "Título quando não há serviços",
  emptyServicesBody: "Texto quando não há serviços",
  cancellationPolicyText:
    'Política de cancelamento (em branco = usa o texto automático "Cancelamento gratuito até X horas antes")',
  trustLine: "Frase de confiança (ao lado do botão de confirmar)",
  ctaContinue: 'Texto do botão "Continuar"',
  ctaConfirm: 'Texto do botão "Confirmar agendamento"',
  footerLine1: "Rodapé — linha 1",
  footerLine2: "Rodapé — linha 2",
};

export const COPY_OVERRIDE_KEYS = Object.keys(
  COPY_OVERRIDE_DEFAULTS,
) as CopyOverrideKey[];

const MAX_COPY_LENGTH = 200;

/** Safe parse of the persisted (JSON-stringified) copy overrides blob. */
export function parseCopyOverrides(raw: unknown): CopyOverrides {
  if (!raw) return {};
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return {};
    const result: CopyOverrides = {};
    for (const key of COPY_OVERRIDE_KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) {
        result[key] = value.slice(0, MAX_COPY_LENGTH);
      }
    }
    return result;
  } catch {
    return {};
  }
}

/** Resolve the effective text for a key: the override if set, else the default. */
export function resolveCopy(
  overrides: CopyOverrides | undefined,
  key: CopyOverrideKey,
): string {
  const value = overrides?.[key]?.trim();
  return value || COPY_OVERRIDE_DEFAULTS[key];
}

// ---------------------------------------------------------------------------
// Section visibility / order
//
// Scoped to the three purely-informational blocks that are safe to hide or
// reorder without touching the booking flow itself. The hero/profile block,
// the services list and the stepper stay fixed — they're the core function
// of the page, not decoration.
// ---------------------------------------------------------------------------

export type SectionId = "search" | "photos" | "hours";

export type SectionConfig = { id: SectionId; visible: boolean };

export const SECTION_IDS: SectionId[] = ["search", "photos", "hours"];

export const SECTION_LABELS: Record<SectionId, string> = {
  search: "Busca e filtro por categoria",
  photos: "Galeria de fotos do estabelecimento",
  hours: "Horário de funcionamento e telefone",
};

export const DEFAULT_SECTIONS_CONFIG: SectionConfig[] = SECTION_IDS.map(
  (id) => ({ id, visible: true }),
);

/** Safe parse + repair: unknown ids are dropped, missing ids are appended as visible. */
export function parseSectionsConfig(raw: unknown): SectionConfig[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return DEFAULT_SECTIONS_CONFIG;
    }
  }
  if (!Array.isArray(parsed)) return DEFAULT_SECTIONS_CONFIG;

  const seen = new Set<SectionId>();
  const result: SectionConfig[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const id = (entry as Record<string, unknown>).id;
    const visible = (entry as Record<string, unknown>).visible;
    if (
      typeof id === "string" &&
      (SECTION_IDS as string[]).includes(id) &&
      !seen.has(id as SectionId)
    ) {
      seen.add(id as SectionId);
      result.push({ id: id as SectionId, visible: visible !== false });
    }
  }
  for (const id of SECTION_IDS) {
    if (!seen.has(id)) result.push({ id, visible: true });
  }
  return result;
}

export function isSectionVisible(
  config: SectionConfig[] | undefined,
  id: SectionId,
): boolean {
  if (!config) return true;
  return config.find((s) => s.id === id)?.visible !== false;
}
