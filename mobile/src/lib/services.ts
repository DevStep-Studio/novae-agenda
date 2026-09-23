import { api, resolveImageUrl } from "./api-client";

// Mirrors ServiceDTO in src/shared/types.ts (root project).
export type ServiceDTO = {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  description: string | null;
  price: number;
  durationMinutes: number;
  color: string | null;
  active: boolean;
  imageUrl?: string | null;
  paymentType?: string;
};

export async function getServices() {
  return api<ServiceDTO[]>("/api/services");
}

/** PATCH /api/services/[id] — partial update; only `active` is used here. */
export async function setServiceActive(id: string, active: boolean) {
  return api<ServiceDTO>(`/api/services/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export async function updateService(id: string, data: Partial<ServiceDTO>) {
  return api<ServiceDTO>(`/api/services/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteService(id: string) {
  return api<{ ok: boolean }>(`/api/services/${id}`, {
    method: "DELETE",
  });
}

export { getServiceImage, getServiceDescription, formatDuration } from "./service-utils";
