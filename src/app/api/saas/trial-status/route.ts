import { requireRole } from "@/lib/auth";
import { getCompanySubscription } from "@/lib/subscriptions";
import { buildTrialStatus } from "@/lib/trial";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireRole("owner");
  if (gate.response) return gate.response;

  const serverNow = new Date();
  const subscription = await getCompanySubscription(gate.auth.user.companyId, undefined, serverNow);
  const snapshot = buildTrialStatus({
    status: subscription.status,
    startedAt: subscription.trialStartedAt,
    endsAt: subscription.trialEndsAt,
    serverNow,
  });

  return Response.json({
    data: {
      ...snapshot,
      timezone: gate.auth.companyTimezone,
    },
  });
}
