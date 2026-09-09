import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  try {
    await db.execute(sql`select 1`);
    const dbLatencyMs = Date.now() - start;

    return Response.json({
      status: "healthy",
      ok: true,
      timestamp: new Date().toISOString(),
      database: {
        status: "connected",
        latencyMs: dbLatencyMs,
      },
      uptime: process.uptime(),
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
      },
      environment: process.env.NODE_ENV ?? "development",
    });
  } catch (error: any) {
    return Response.json(
      {
        status: "unhealthy",
        ok: false,
        timestamp: new Date().toISOString(),
        database: {
          status: "disconnected",
          error: error?.message ?? "Database check failed",
        },
      },
      { status: 503 }
    );
  }
}
