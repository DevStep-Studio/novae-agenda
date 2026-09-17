import { db } from "@/db";
import { adminAuditLogs } from "@/db/schema";
import { requireSuperadmin } from "@/lib/auth";
import { and, desc, eq, like, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;
  const action = searchParams.get("action");
  const entity = searchParams.get("entity");
  const search = searchParams.get("search");

  const conditions = [];

  if (action) {
    conditions.push(eq(adminAuditLogs.action, action));
  }
  if (entity) {
    conditions.push(eq(adminAuditLogs.entity, entity));
  }
  if (search) {
    const s = `%${search}%`;
    conditions.push(
      or(
        like(adminAuditLogs.adminEmail, s),
        like(adminAuditLogs.entityName, s),
        like(adminAuditLogs.reason, s),
        like(adminAuditLogs.action, s)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, countResult] = await Promise.all([
    db
      .select()
      .from(adminAuditLogs)
      .where(whereClause)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: adminAuditLogs.id })
      .from(adminAuditLogs)
      .where(whereClause),
  ]);

  const total = countResult.length;

  return Response.json({
    data: logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
