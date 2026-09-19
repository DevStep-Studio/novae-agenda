import { NextResponse } from "next/server";
import { processPendingNotificationSchedules } from "@/lib/notification-scheduler";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is configured, require Bearer token
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await processPendingNotificationSchedules(100);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error("[CRON Reminders Error]:", error);
    return NextResponse.json(
      { error: "Internal scheduler error", details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
