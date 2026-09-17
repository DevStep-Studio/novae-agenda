import { db } from "@/db";
import { adminAuditLogs } from "@/db/schema";
import { clientIp } from "@/lib/request";

export interface LogAdminActionParams {
  adminUserId: string;
  adminEmail: string;
  action: string;
  entity: "company" | "user" | "subscription" | "coupon" | "employee" | "client";
  entityId?: string | null;
  entityName?: string | null;
  reason?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  request?: Request | null;
}

export async function logAdminAction(params: LogAdminActionParams): Promise<void> {
  try {
    const ipAddress = params.request ? clientIp(params.request) : null;
    const userAgent = params.request ? params.request.headers.get("user-agent") : null;

    await db.insert(adminAuditLogs).values({
      adminUserId: params.adminUserId,
      adminEmail: params.adminEmail,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? null,
      entityName: params.entityName ?? null,
      reason: params.reason ?? null,
      beforeState: params.beforeState ?? null,
      afterState: params.afterState ?? null,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });
  } catch (error) {
    console.error("[logAdminAction] Error writing audit log:", error);
    // Non-blocking for critical paths, but logged in server console
  }
}
