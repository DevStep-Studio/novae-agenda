import { z } from "zod";
import { isValidDateKey, isValidTime } from "@/lib/domain";
export const slugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use letras minúsculas, números e hífens.",
  )
  .refine(
    (v) =>
      ![
        "admin",
        "api",
        "login",
        "cadastro",
        "agendar",
        "dashboard",
        "novae",
        "suporte",
        "meus-agendamentos",
        "configuracoes",
        "www",
        "app",
      ].includes(v),
    "Este endereço é reservado.",
  );
export const selectionSchema = z
  .array(
    z.object({
      serviceId: z.uuid(),
      employeeId: z.uuid().nullable().optional(),
    }),
  )
  .min(1)
  .max(8)
  .refine(
    (items) => new Set(items.map((i) => i.serviceId)).size === items.length,
    "Selecione cada serviço apenas uma vez.",
  );
export const dateSchema = z.string().refine(isValidDateKey, "Data inválida.");
export const timeSchema = z.string().refine(isValidTime, "Horário inválido.");
export const searchSchema = z.object({
  locationId: z.uuid(),
  date: dateSchema,
  items: selectionSchema,
});
export const createBookingSchema = searchSchema.extend({
  slug: slugSchema,
  startTime: timeSchema,
  notes: z.string().max(2000).optional(),
  idempotencyKey: z.uuid(),
  // How the customer intends to pay at the establishment. Payment for the
  // service itself is always presential — this never triggers an online charge.
  intendedPaymentMethod: z.enum(["pix", "cash", "card"], {
    message: "Escolha como pretende pagar no estabelecimento.",
  }),
  products: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .max(20)
    .default([]),
  couponCode: z.string().max(40).optional(),
  customer: z
    .object({
      name: z.string().min(2, "Informe seu nome.").max(120),
      phone: z.string().min(8, "Informe seu telefone.").max(25),
      email: z.string().email("E-mail inválido.").optional().or(z.literal("")).nullable(),
    })
    .optional(),
});
export type Selection = z.infer<typeof selectionSchema>;
export const safeImageUrl = z
  .string()
  .max(1000)
  .refine(
    (v) => !v || /^https:\/\//.test(v) || /^\/(?!\/)/.test(v),
    "Use uma imagem HTTPS ou um caminho local.",
  );
export function accessibleColor(hex: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) / 255;
  const g = ((num >> 8) & 0xff) / 255;
  const b = (num & 0xff) / 255;
  const toL = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * toL(r) + 0.7152 * toL(g) + 0.0722 * toL(b);
  const contrastWithWhite = (1 + 0.05) / (L + 0.05);
  return contrastWithWhite >= 4.5;
}

export function toSlug(text: string): string {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return normalized || "empresa";
}
