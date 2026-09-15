import { getIdentity } from "@/lib/auth";
import { CustomerAccessService } from "@/lib/customer-access/service";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getIdentity();
  const hasPin = user ? await CustomerAccessService.userHasPin(user.id) : false;
  return Response.json({
    data: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          emailVerified: user.emailVerified,
          hasPin,
        }
      : null,
  });
}

export async function PATCH(request: Request) {
  const { z } = await import("zod");
  const { db } = await import("@/db");
  const { users } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const { bookingError, sameOrigin, BookingError } =
    await import("@/lib/booking/errors");
  try {
    sameOrigin(request);
    const user = await getIdentity();
    if (!user) throw new BookingError("Entre na sua conta.", 401);
    const { phone } = z
      .object({
        phone: z
          .string()
          .regex(/^[+\d ()-]{8,25}$/, "Informe um telefone válido."),
      })
      .parse(await request.json());
    await db
      .update(users)
      .set({ phone, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    const hasPin = await CustomerAccessService.userHasPin(user.id);
    return Response.json({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone,
        emailVerified: user.emailVerified,
        hasPin,
      },
    });
  } catch (error) {
    return bookingError(error);
  }
}
