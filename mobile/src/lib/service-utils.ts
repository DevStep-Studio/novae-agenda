import { resolveMediaUrl } from "./media-utils";

// Ported verbatim from getServiceImage in src/components/app-shell.tsx:1888-1912.
export function getServiceImage(service: { name: string; imageUrl?: string | null }): string {
  if (service.imageUrl && service.imageUrl.trim() !== "") {
    return resolveMediaUrl(service.imageUrl) || service.imageUrl;
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
    n.includes("terapia") ||
    c.includes("massagem")
  ) {
    return "Terapia corporal relaxante para alívio de tensões e renovação do bem-estar.";
  }
  if (
    n.includes("sobrancelha") ||
    n.includes("cilios") ||
    n.includes("estetica") ||
    n.includes("limpeza de pele") ||
    c.includes("estetica")
  ) {
    return "Procedimento estético refinado para realçar a harmonia e os traços naturais.";
  }
  return "Serviço exclusivo com atendimento personalizado e produtos de alta performance.";
}

// Ported from the JSX in app-shell.tsx:2061-2063 (duration formatting).
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}
