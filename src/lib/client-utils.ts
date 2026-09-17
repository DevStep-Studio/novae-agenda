import type { AppointmentStatus, PaymentMethod, Role } from "@/shared/types";

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Superadmin",
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gerente",
  employee: "Profissional",
  client: "Cliente",
};

export function roleLabel(role: string | null | undefined): string {
  return role && role in ROLE_LABELS ? ROLE_LABELS[role as Role] : "Profissional";
}

export function formatCurrency(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}

const PALETTE = ["#d8e5f0", "#eadbdc", "#e4e0d2", "#e2d9ea", "#d9e8e0", "#e7e0d7", "#dce5ee", "#d6ebe6", "#e9e1d6", "#e7dce8"];
export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  return PALETTE[hash % PALETTE.length];
}

export function toTimeString(time: string): string {
  return time.length > 5 ? time.slice(0, 5) : time;
}

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Aguardando confirmação",
  confirmed: "Confirmado",
  waiting: "Cliente chegou",
  in_progress: "Em atendimento",
  completed: "Finalizado",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  debit: "Débito",
  credit: "Crédito",
  other: "Outro",
};

export function displayDayCount(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function getServiceDescription(service: {
  name: string;
  description?: string | null;
  categoryName?: string | null;
}): string {
  const raw = service.description?.trim();
  if (raw) return raw;

  const n = (service.name || "").toLowerCase();
  const c = (service.categoryName || "").toLowerCase();

  if ((n.includes("corte") && (n.includes("barba") || n.includes("barboterapia"))) || (c.includes("corte") && (c.includes("barba") || c.includes("barboterapia")))) {
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
  if (n.includes("massagem") || n.includes("spa") || n.includes("drenagem") || n.includes("relaxante") || c.includes("massagem") || c.includes("spa") || (n.includes("terapia") && !n.includes("barba"))) {
    return "Sessão relaxante para alívio de tensões musculares, bem-estar e renovação de energias.";
  }
  if (n.includes("sobrancelha") || n.includes("cilios") || n.includes("cílios") || n.includes("lash") || c.includes("sobrancelha") || c.includes("olhar")) {
    return "Design anatômico e alinhamento sob medida para valorizar sua expressão e olhar.";
  }
  if (n.includes("limpeza") || n.includes("facial") || n.includes("pele") || n.includes("peeling") || c.includes("estetica") || c.includes("estética")) {
    return "Higienização profunda, renovação celular e hidratação intensiva para a sua pele.";
  }
  if (n.includes("química") || n.includes("quimica") || n.includes("coloração") || n.includes("coloracao") || n.includes("luzes") || n.includes("mechas") || n.includes("progressiva") || n.includes("botox")) {
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

