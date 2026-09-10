import { getIdentity } from "@/lib/auth";
import { BookingError, bookingError, sameOrigin } from "@/lib/booking/errors";
import { createBooking } from "@/lib/booking/service";
import { createBookingSchema } from "@/lib/booking/validation";
import { consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json();
    const parsed = createBookingSchema.parse(body);

    const user = await getIdentity();
    if (!user) throw new BookingError("Entre na sua conta para confirmar.", 401);

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
