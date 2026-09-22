import { api } from "./api-client";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "waiting"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

// Mirrors AppointmentDTO in src/shared/types.ts (root project).
export type AppointmentDTO = {
  id: string;
  locationId: string | null;
  locationName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientPhotoUrl?: string | null;
  clientInitials: string;
  clientColor: string;
  employeeId: string;
  employeeName: string;
  employeeInitials: string;
  serviceId: string;
  serviceName: string;
  serviceColor: string | null;
  total: number;
  status: AppointmentStatus;
  notes: string | null;
  paid: boolean;
  paymentMethod?: "pix" | "cash" | "debit" | "credit" | "other" | null;
};

/**
 * GET /api/appointments — for role "employee" the backend already force-scopes
 * results to the caller's own employeeId (src/app/api/appointments/route.ts),
 * so this works for both the owner/manager agenda and the employee's personal one.
 * `from` is optional to mirror the real route: with neither `from` nor `to` given,
 * it applies no date filter at all and returns every appointment for the company
 * (this is what the web's own store does — a bare `api("/api/appointments")` —
 * so "Todo o histórico" on Financeiro needs the same unfiltered call).
 */
export async function getAppointments(params: { from?: string; to?: string; employeeId?: string } = {}) {
  const search = new URLSearchParams();
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.employeeId) search.set("employeeId", params.employeeId);
  const qs = search.toString();
  return api<AppointmentDTO[]>(`/api/appointments${qs ? `?${qs}` : ""}`);
}

export function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Mirrors STATUS_LABELS in src/lib/client-utils.ts (root project) verbatim —
// this previously said "Agendado"/"Aguardando", which don't match the web's
// real copy ("Aguardando confirmação"/"Cliente chegou").
const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Aguardando confirmação",
  confirmed: "Confirmado",
  waiting: "Cliente chegou",
  in_progress: "Em atendimento",
  completed: "Finalizado",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

export function statusLabel(status: AppointmentStatus): string {
  return STATUS_LABELS[status] ?? status;
}
