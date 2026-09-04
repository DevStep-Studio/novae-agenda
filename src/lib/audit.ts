import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export type AuditEntry = {
  companyId: string;
  userId?: string | null;
  action: string; // e.g. "appointment.cancelled", "appointment.value_changed", "employee.created"
  entity: string; // e.g. "appointment", "employee", "service", "client", "company"
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Records a sensitive action to the audit trail. Never throws — a failed audit write
 * must not break the operation it describes.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      companyId: entry.companyId,
      userId: entry.userId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
    });
  } catch (error) {
    console.error("[audit] failed to record entry", entry.action, error);
  }
}
