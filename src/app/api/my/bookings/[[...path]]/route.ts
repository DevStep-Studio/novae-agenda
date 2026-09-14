import { z } from "zod";
import { getIdentity } from "@/lib/auth";
import { BookingError, bookingError, sameOrigin } from "@/lib/booking/errors";
import {
  bookingDetails,
  changeBooking,
  listBookingDetails,
} from "@/lib/booking/service";
import { dateSchema, timeSchema } from "@/lib/booking/validation";
import { calendarIcs } from "@/lib/booking/calendar";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path?: string[] }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    const user = await getIdentity();
    if (!user) throw new BookingError("Entre para ver seus agendamentos.", 401);
    const { path = [] } = await params;
    if (path[0]) {
      const id = z.uuid().parse(path[0]),
        detail = await bookingDetails(id, user.id);
      if (path[1] === "calendar")
        return new Response(calendarIcs(detail), {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": `attachment; filename="agendamento-${id}.ics"`,
            "Cache-Control": "private, no-store",
          },
        });
      if (path.length > 1)
        throw new BookingError("Página não encontrada.", 404);
      return Response.json({ data: detail });
    }
    return Response.json(
      {
        data: await listBookingDetails(user.id),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return bookingError(error);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const user = await getIdentity();
    if (!user) throw new BookingError("Entre na sua conta.", 401);
    const { path = [] } = await params,
      id = z.uuid().parse(path[0]);
    const action = z.enum(["cancel", "reschedule"]).parse(path[1]);
    const input =
      action === "reschedule"
        ? z
            .object({ date: dateSchema, startTime: timeSchema })
            .parse(await request.json())
        : undefined;
    const result = await changeBooking(id, user.id, action, input);
    return Response.json({ data: { id: result.id } });
  } catch (error) {
    return bookingError(error);
  }
}
