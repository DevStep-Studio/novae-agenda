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
          photoUrl: user.avatarUrl,
          emailVerified: user.emailVerified,
          hasPin,
        }
      : null,
  });
}

export async function PATCH(request: Request) {
  const { z } = await import("zod");
  const { db } = await import("@/db");
  const { users, clients } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const { saveClientImage } = await import("@/lib/storage");
  const { bookingError, sameOrigin, BookingError } =
    await import("@/lib/booking/errors");
  try {
    sameOrigin(request);
    const user = await getIdentity();
    if (!user) throw new BookingError("Entre na sua conta.", 401);
    const input = z
      .object({
        name: z.string().min(2, "Informe seu nome completo.").optional(),
        phone: z
          .string()
          .regex(/^[+\d ()-]{8,25}$/, "Informe um telefone válido.")
          .optional(),
        email: z.string().email("Informe um e-mail válido.").optional(),
        photoUrl: z.string().optional(),
      })
      .parse(await request.json());

    const userPatch: Record<string, unknown> = { updatedAt: new Date() };
    const clientPatch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) {
      userPatch.name = input.name.trim();
      clientPatch.name = input.name.trim();
    }
    if (input.phone !== undefined) {
      userPatch.phone = input.phone;
      clientPatch.phone = input.phone;
    }
    if (input.email !== undefined) {
      userPatch.email = input.email.trim().toLowerCase();
    }
    if (input.photoUrl !== undefined) {
      const savedUrl = await saveClientImage(input.photoUrl, user.avatarUrl);
      userPatch.avatarUrl = savedUrl;
      clientPatch.photoUrl = savedUrl;
    }

    await db.update(users).set(userPatch).where(eq(users.id, user.id));
    // Reflect name/phone/photo on every company's client record for this
    // customer, so the owner/employee screen always shows what the customer
    // last set for themselves whenever they show up on an appointment.
    if (Object.keys(clientPatch).length > 1) {
      await db.update(clients).set(clientPatch).where(eq(clients.userId, user.id));
    }

    const hasPin = await CustomerAccessService.userHasPin(user.id);
    return Response.json({
      data: {
        id: user.id,
        name: (userPatch.name as string) ?? user.name,
        email: (userPatch.email as string) ?? user.email,
        phone: (userPatch.phone as string) ?? user.phone,
        photoUrl: (userPatch.avatarUrl as string) ?? user.avatarUrl,
        emailVerified: user.emailVerified,
        hasPin,
      },
    });
  } catch (error) {
    return bookingError(error);
  }
}
