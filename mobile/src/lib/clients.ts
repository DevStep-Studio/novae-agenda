import { api } from "./api-client";

// Mirrors ClientDTO in src/shared/types.ts (root project).
export type ClientDTO = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  photoUrl?: string | null;
  notes: string | null;
  internalNotes?: string | null;
  active: boolean;
  initials?: string;
  color?: string;
  visits: number;
  spent: number;
  firstVisit?: string | null;
  lastVisit: string | null;
  nextVisit: string | null;
  createdAt: string;
  hasActiveMembership?: boolean;
  isMembershipActive?: boolean;
  membershipPlanName?: string | null;
};

/** GET /api/clients — `q` is matched server-side against name/phone/email. */
export async function getClients(q?: string) {
  const search = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return api<ClientDTO[]>(`/api/clients${search}`);
}

// Thresholds from app-shell.tsx:1139-1141 — every client falls into exactly
// one tier (the web's "new" label is a fallback for "neither vip nor
// frequent," not literally "recently created," despite the name — that's
// the actual logic on the web today, ported as-is rather than corrected).
export type ClientTier = "vip" | "frequent" | "new";

export function clientTier(client: Pick<ClientDTO, "visits" | "spent">): ClientTier {
  if (client.visits >= 3 || (client.spent ?? 0) >= 250) return "vip";
  if (client.visits >= 2) return "frequent";
  return "new";
}

// The page-level "Clientes frequentes" KPI (app-shell.tsx:885,1016-1023) uses
// a DIFFERENT, looser threshold than the per-row VIP/Frequente badge above
// (visits>=2 or spent>=200, vs. the row's visits>=3 or spent>=250) — that's
// a real inconsistency in the web's own logic, not a mistake here; both
// numbers are ported to independently match their web counterparts.
export function isFrequentOrVip(client: Pick<ClientDTO, "visits" | "spent">): boolean {
  return client.visits >= 2 || (client.spent ?? 0) >= 200;
}
