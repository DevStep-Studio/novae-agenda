import { requireRole } from "@/lib/auth";
import { bookingError } from "@/lib/booking/errors";
import { waitlistMatches } from "@/lib/booking/waitlist";
export const dynamic = "force-dynamic";
export async function GET() {
  const gate = await requireRole("manager");
  if (gate.response) return gate.response;
  try {
    return Response.json({ data: await waitlistMatches(gate.auth.user.companyId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return bookingError(error); }
}
