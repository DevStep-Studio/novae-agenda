export const MANAGEMENT_VIEWS = [
  "link-agendamento",
  "dashboard",
  "agenda",
  "clientes",
  "servicos",
  "equipe",
  "financeiro",
  "relatorios",
  "assinatura",
  "configuracoes",
  "notificacoes",
  "perfil",
] as const;

export type ManagementView = (typeof MANAGEMENT_VIEWS)[number];

const MANAGEMENT_VIEW_SET = new Set<string>(MANAGEMENT_VIEWS);

export function isManagementView(value: string): value is ManagementView {
  return MANAGEMENT_VIEW_SET.has(value);
}

export function managementViewFromRoute(value: string | undefined): ManagementView {
  return value && isManagementView(value) ? value : "dashboard";
}

export function managementPath(view: ManagementView): string {
  return view === "dashboard" ? "/gestao" : `/gestao/${view}`;
}
