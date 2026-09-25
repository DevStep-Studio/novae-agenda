import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies, coupons, products, services } from "@/db/schema";
import type { DbExecutor } from "@/lib/availability";
import { BookingError } from "./errors";
export const quoteSchema = z.object({
  serviceIds: z.array(z.uuid()).min(1).max(8),
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
});
export async function quoteBooking(
  company: typeof companies.$inferSelect,
  input: z.infer<typeof quoteSchema>,
  executor: DbExecutor = db,
) {
  if (
    new Set(input.serviceIds).size !== input.serviceIds.length ||
    new Set(input.products.map((p) => p.productId)).size !==
      input.products.length
  )
    throw new BookingError("Seleção duplicada.");
  const serviceRows = await executor
    .select()
    .from(services)
    .where(
      and(
        eq(services.companyId, company.id),
        inArray(services.id, input.serviceIds),
        eq(services.active, true),
        inArray(services.paymentType, ["PAY_LATER", "QUOTE", "FULL_PAYMENT", "DEPOSIT", "IN_PERSON", "ONLINE", "FREE"]),
      ),
    );
  if (serviceRows.length !== input.serviceIds.length)
    throw new BookingError("Um serviço não está mais disponível.");
  const extras =
    input.products.length && company.allowProducts
      ? await executor
          .select()
          .from(products)
          .where(
            and(
              eq(products.companyId, company.id),
              eq(products.active, true),
              inArray(
                products.id,
                input.products.map((p) => p.productId),
              ),
            ),
          )
      : [];
  if (extras.length !== input.products.length)
    throw new BookingError("Um produto não está mais disponível.");
  const subtotalCents =
    serviceRows.reduce((sum, s) => sum + Math.round(Number(s.price) * 100), 0) +
    extras.reduce(
      (sum, p) =>
        sum +
        Math.round(Number(p.price) * 100) *
          input.products.find((i) => i.productId === p.id)!.quantity,
      0,
    );
  let discountCents = 0;
  const code = input.couponCode?.trim().toUpperCase();
  if (code) {
    const [coupon] = await executor
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.companyId, company.id),
          eq(coupons.code, code),
          eq(coupons.active, true),
        ),
      );
    if (!coupon || (coupon.expiresAt && coupon.expiresAt < new Date()))
      throw new BookingError("Cupom inválido ou expirado.");
    discountCents = Math.min(
      subtotalCents,
      coupon.type === "percentage"
        ? Math.round((subtotalCents * Number(coupon.value)) / 100)
        : Math.round(Number(coupon.value) * 100),
    );
  }
  return {
    subtotal: subtotalCents / 100,
    discount: discountCents / 100,
    total: (subtotalCents - discountCents) / 100,
    extras,
    couponCode: code || null,
  };
}
