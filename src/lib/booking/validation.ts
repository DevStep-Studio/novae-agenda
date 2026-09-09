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
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return (
    1.05 / (rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 + 0.05) >= 4.5
  );
}
