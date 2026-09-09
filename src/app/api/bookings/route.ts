import { createSession, getIdentity, hashPassword } from "@/lib/auth";
import { BookingError, bookingError, sameOrigin } from "@/lib/booking/errors";
import { createBooking } from "@/lib/booking/service";
import { createBookingSchema } from "@/lib/booking/validation";
import { consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json();
    const parsed = createBookingSchema.parse(body);

    let user = await getIdentity();

    if (!user) {
      if (!parsed.customer?.name || !parsed.customer?.phone) {
        throw new BookingError("Entre na sua conta para confirmar.", 401);
      }

      const phoneDigits = parsed.customer.phone.replace(/\D/g, "");
      const cleanEmail = parsed.customer.email?.trim() || `${phoneDigits}@cliente.novae.app`;

      // Check if user already exists with this email or phone
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, cleanEmail))
        .limit(1);

      if (existing) {
        user = existing;
      } else {
        const dummyHash = await hashPassword(crypto.randomUUID());
        const [created] = await db
          .insert(users)
          .values({
            name: parsed.customer.name.trim(),
            email: cleanEmail,
            phone: parsed.customer.phone.trim(),
            passwordHash: dummyHash,
            role: "client",
            emailVerified: false,
          })
          .returning();
        user = created;
      }

      await createSession(user.id);
    }

    const limit = await consumeRateLimit(
      `booking:${user.id}:${clientIp(request)}`,
      { limit: 15, windowMs: 60000, blockMs: 60000 },
    );
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

    const booking = await createBooking(user, parsed);
    return Response.json({ data: { id: booking.id } }, { status: 201 });
  } catch (error) {
    return bookingError(error);
  }
}
