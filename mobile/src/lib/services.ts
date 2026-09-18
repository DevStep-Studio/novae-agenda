import { api } from "./api-client";

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

// Ported verbatim from getServiceImage in src/components/app-shell.tsx:1888-1912.
export function getServiceImage(service: { name: string; imageUrl?: string | null }): string {
  if (service.imageUrl && service.imageUrl.trim() !== "") {
    return service.imageUrl;
  }
  const n = (service.name || "").toLowerCase();
  if (n.includes("corte") && n.includes("barba")) {
    return "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=800&q=80";
  }
  if (n.includes("barba") || n.includes("shave") || n.includes("navalha")) {
    return "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=800&q=80";
  }
  if (n.includes("corte") || n.includes("cabelo") || n.includes("fade") || n.includes("hair")) {
    return "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=800&q=80";
  }
  if (n.includes("manicure") || n.includes("unha") || n.includes("pedicure")) {
    return "https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=800&q=80";
  }
  if (n.includes("massagem") || n.includes("spa") || n.includes("terapia")) {
    return "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80";
  }
  if (n.includes("sobrancelha") || n.includes("cilios") || n.includes("estetica")) {
    return "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80";
  }
  return "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80";
}

// Ported verbatim from getServiceDescription in src/lib/client-utils.ts:57-102.
export function getServiceDescription(service: {
  name: string;
  description?: string | null;
  categoryName?: string | null;
}): string {
  const raw = service.description?.trim();
  if (raw) return raw;

  const n = (service.name || "").toLowerCase();
  const c = (service.categoryName || "").toLowerCase();

  if (
    (n.includes("corte") && (n.includes("barba") || n.includes("barboterapia"))) ||
    (c.includes("corte") && (c.includes("barba") || c.includes("barboterapia")))
  ) {
    return "Combo completo com corte personalizado e alinhamento impecável da barba.";
  }
  if (n.includes("corte") || n.includes("cabelo") || n.includes("fade") || n.includes("hair") || c.includes("cabelo")) {
    return "Corte sob medida com técnicas modernas de acabamento e finalização do estilo.";
  }
  if (n.includes("barba") || n.includes("barboterapia") || n.includes("shave") || n.includes("navalha") || c.includes("barba")) {
    return "Desenho e alinhamento com toalha quente, hidratação e acabamento navalhado de alta precisão.";
  }
  if (n.includes("manicure") || n.includes("unha") || n.includes("pedicure") || n.includes("podologia") || c.includes("unha")) {
    return "Cuidado e hidratação completos com cutilagem suave e esmaltação de alta durabilidade.";
  }
  if (
    n.includes("massagem") ||
    n.includes("spa") ||
    n.includes("drenagem") ||
    n.includes("relaxante") ||
    c.includes("massagem") ||
    c.includes("spa") ||
    (n.includes("terapia") && !n.includes("barba"))
  ) {
    return "Sessão relaxante para alívio de tensões musculares, bem-estar e renovação de energias.";
  }
  if (
    n.includes("sobrancelha") ||
    n.includes("cilios") ||
    n.includes("cílios") ||
    n.includes("lash") ||
    c.includes("sobrancelha") ||
    c.includes("olhar")
  ) {
    return "Design anatômico e alinhamento sob medida para valorizar sua expressão e olhar.";
  }
  if (n.includes("limpeza") || n.includes("facial") || n.includes("pele") || n.includes("peeling") || c.includes("estetica") || c.includes("estética")) {
    return "Higienização profunda, renovação celular e hidratação intensiva para a sua pele.";
  }
  if (
    n.includes("química") ||
    n.includes("quimica") ||
    n.includes("coloração") ||
    n.includes("coloracao") ||
    n.includes("luzes") ||
    n.includes("mechas") ||
    n.includes("progressiva") ||
    n.includes("botox")
  ) {
    return "Procedimento técnico especializado com produtos profissionais de alto tratamento e brilho.";
  }
  if (n.includes("depilação") || n.includes("depilacao") || n.includes("laser") || c.includes("depilação") || c.includes("depilacao")) {
    return "Remoção suave e higiênica dos pelos com produtos calmantes e cuidado com a pele.";
  }
  if (n.includes("combo") || n.includes("pacote") || n.includes("vip") || n.includes("completo") || n.includes("premium")) {
    return "Experiência completa combinando os melhores cuidados e procedimentos em uma única sessão.";
  }
  if (n.includes("padrao") || n.includes("padrão") || n.includes("atendimento")) {
    return "Atendimento completo e personalizado com foco no seu bem-estar, estilo e conforto.";
  }
  return "Atendimento exclusivo com máxima atenção aos detalhes e produtos de alta qualidade.";
}

// Ported from the JSX in app-shell.tsx:2061-2063 (duration formatting).
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}
