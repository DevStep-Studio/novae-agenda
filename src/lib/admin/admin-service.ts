import { and, desc, eq, gte, inArray, isNotNull, isNull, like, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  adminAuditLogs,
  appointments,
  clients,
  companies,
  companyMemberships,
  employees,
  saasCoupons,
  saasPlans,
  subscriptionInvoices,
  subscriptions,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { logAdminAction } from "./audit";

export interface ListOwnersParams {
  q?: string;
  status?: "all" | "active" | "inactive" | "deleted";
  plan?: string;
  startDate?: string;
  endDate?: string;
  couponCode?: string;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "name" | "plan";
  sortOrder?: "asc" | "desc";
}

export interface CreateOwnerManualInput {
  name: string;
  ownerName: string;
  email: string;
  phone?: string;
  password?: string;
  businessType?: string;
  cnpjOrCpf?: string;
  planSlug?: string;
  couponCode?: string;
  reason?: string;
}

export class AdminService {
  /**
   * List companies/owners with pagination, rich multi-field search and filters
   */
  static async listOwners(params: ListOwnersParams = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    // Status filter
    if (params.status === "deleted") {
      conditions.push(isNotNull(companies.deletedAt));
    } else if (params.status === "active") {
      conditions.push(and(isNull(companies.deletedAt), eq(companies.onboarded, true)));
    } else if (params.status === "inactive") {
      conditions.push(and(isNull(companies.deletedAt), eq(companies.onboarded, false)));
    }

    // Date filters
    if (params.startDate) {
      conditions.push(gte(companies.createdAt, new Date(params.startDate)));
    }
    if (params.endDate) {
      const end = new Date(params.endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(companies.createdAt, end));
    }

    // Search query across multiple fields
    if (params.q && params.q.trim()) {
      const q = `%${params.q.trim()}%`;
      conditions.push(
        or(
          like(companies.name, q),
          like(companies.email, q),
          like(companies.phone, q),
          like(companies.cnpjOrCpf, q),
          like(companies.publicSlug, q),
          like(users.name, q),
          like(users.email, q),
          like(users.phone, q)
        )
      );
    }

    // Plan filter
    if (params.plan && params.plan !== "all") {
      conditions.push(eq(subscriptions.plan, params.plan));
    }

    // Base query joining company, owner user, and subscription
    const whereClause = conditions.length ? and(...conditions) : undefined;

    // Total count query
    const [countResult] = await db
      .select({ count: sql<number>`count(distinct ${companies.id})` })
      .from(companies)
      .leftJoin(companyMemberships, and(eq(companyMemberships.companyId, companies.id), eq(companyMemberships.role, "owner")))
      .leftJoin(users, eq(users.id, companyMemberships.userId))
      .leftJoin(subscriptions, eq(subscriptions.companyId, companies.id))
      .where(whereClause);

    const total = Number(countResult?.count ?? 0);

    // Data query
    const rows = await db
      .select({
        id: companies.id,
        name: companies.name,
        businessType: companies.businessType,
        email: companies.email,
        phone: companies.phone,
        cnpjOrCpf: companies.cnpjOrCpf,
        publicSlug: companies.publicSlug,
        onboarded: companies.onboarded,
        originCouponId: companies.originCouponId,
        deletedAt: companies.deletedAt,
        createdAt: companies.createdAt,
        ownerId: users.id,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerPhone: users.phone,
        subscriptionPlan: subscriptions.plan,
        subscriptionStatus: subscriptions.status,
        subscriptionOrigin: subscriptions.origin,
        trialEndsAt: subscriptions.trialEndsAt,
        nextPaymentAt: subscriptions.nextPaymentAt,
      })
      .from(companies)
      .leftJoin(companyMemberships, and(eq(companyMemberships.companyId, companies.id), eq(companyMemberships.role, "owner")))
      .leftJoin(users, eq(users.id, companyMemberships.userId))
      .leftJoin(subscriptions, eq(subscriptions.companyId, companies.id))
      .where(whereClause)
      .orderBy(desc(companies.createdAt))
      .limit(limit)
      .offset(offset);

    // Fetch counts for employees and clients in batch
    const companyIds = rows.map((r) => r.id);
    let employeesCountMap = new Map<string, number>();
    let clientsCountMap = new Map<string, number>();

    if (companyIds.length > 0) {
      const [empCounts, clientCounts] = await Promise.all([
        db
          .select({ companyId: employees.companyId, count: sql<number>`count(*)` })
          .from(employees)
          .where(and(inArray(employees.companyId, companyIds), isNull(employees.deletedAt)))
          .groupBy(employees.companyId),
        db
          .select({ companyId: clients.companyId, count: sql<number>`count(*)` })
          .from(clients)
          .where(and(inArray(clients.companyId, companyIds), isNull(clients.deletedAt)))
          .groupBy(clients.companyId),
      ]);

      employeesCountMap = new Map(empCounts.map((e) => [e.companyId, Number(e.count)]));
      clientsCountMap = new Map(clientCounts.map((c) => [c.companyId, Number(c.count)]));
    }

    const items = rows.map((r) => ({
      ...r,
      totalEmployees: employeesCountMap.get(r.id) ?? 0,
      totalClients: clientsCountMap.get(r.id) ?? 0,
      isDeleted: Boolean(r.deletedAt),
    }));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get 360-degree detail of an owner/company
   */
  static async getOwnerDetails(companyId: string) {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) return null;

    // Find owner user
    const [ownerMembership] = await db
      .select({
        membershipId: companyMemberships.id,
        role: companyMemberships.role,
        user: users,
      })
      .from(companyMemberships)
      .innerJoin(users, eq(users.id, companyMemberships.userId))
      .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.role, "owner")))
      .limit(1);

    // Subscription & Plan
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, companyId))
      .limit(1);

    let plan = null;
    if (subscription?.planId) {
      const [p] = await db.select().from(saasPlans).where(eq(saasPlans.id, subscription.planId)).limit(1);
      plan = p ?? null;
    }

    // Invoices
    const invoices = subscription
      ? await db
          .select()
          .from(subscriptionInvoices)
          .where(eq(subscriptionInvoices.subscriptionId, subscription.id))
          .orderBy(desc(subscriptionInvoices.createdAt))
          .limit(20)
      : [];

    // Employees
    const empList = await db
      .select()
      .from(employees)
      .where(and(eq(employees.companyId, companyId), isNull(employees.deletedAt)))
      .orderBy(desc(employees.createdAt));

    // Clients
    const clientList = await db
      .select()
      .from(clients)
      .where(and(eq(clients.companyId, companyId), isNull(clients.deletedAt)))
      .orderBy(desc(clients.createdAt))
      .limit(50);

    // Origin Coupon
    let originCoupon = null;
    if (company.originCouponId) {
      const [c] = await db.select().from(saasCoupons).where(eq(saasCoupons.id, company.originCouponId)).limit(1);
      originCoupon = c ?? null;
    }

    // Admin Audit Logs for this company
    const auditHistory = await db
      .select()
      .from(adminAuditLogs)
      .where(
        or(
          and(eq(adminAuditLogs.entity, "company"), eq(adminAuditLogs.entityId, companyId)),
          ownerMembership?.user?.id ? and(eq(adminAuditLogs.entity, "user"), eq(adminAuditLogs.entityId, ownerMembership.user.id)) : undefined,
          subscription ? and(eq(adminAuditLogs.entity, "subscription"), eq(adminAuditLogs.entityId, subscription.id)) : undefined
        )
      )
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(50);

    return {
      company,
      primaryOwner: ownerMembership?.user ?? null,
      owner: ownerMembership?.user ?? null,
      subscription,
      plan,
      invoices,
      employees: empList,
      clients: clientList,
      originCoupon,
      auditLogs: auditHistory,
      auditHistory,
    };
  }

  /**
   * Create an owner and company manually from Super Admin
   */
  static async createOwnerManual(
    input: CreateOwnerManualInput,
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanSlug = input.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || `negocio-${Date.now()}`;

    // Ensure unique slug
    let finalSlug = cleanSlug;
    const [existingSlug] = await db.select({ id: companies.id }).from(companies).where(eq(companies.publicSlug, finalSlug)).limit(1);
    if (existingSlug) {
      finalSlug = `${cleanSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Password
    const rawPassword = input.password || `Reservei@${Math.floor(1000 + Math.random() * 9000)}`;
    const passwordHash = await hashPassword(rawPassword);

    // Origin coupon check
    let originCouponId: string | null = null;
    if (input.couponCode) {
      const [cp] = await db.select().from(saasCoupons).where(eq(saasCoupons.code, input.couponCode.trim().toUpperCase())).limit(1);
      if (cp) originCouponId = cp.id;
    }

    const companyId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: input.name,
      businessType: input.businessType ?? "Geral",
      email: cleanEmail,
      phone: input.phone ?? null,
      cnpjOrCpf: input.cnpjOrCpf ?? null,
      publicSlug: finalSlug,
      publicEnabled: true,
      onboarded: true,
      originCouponId,
    });

    await db.insert(users).values({
      id: userId,
      companyId,
      name: input.ownerName || input.name,
      email: cleanEmail,
      phone: input.phone ?? null,
      passwordHash,
      role: "owner",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });

    await db.insert(companyMemberships).values({
      userId,
      companyId,
      role: "owner",
      active: true,
    });

    // Create Subscription
    const planSlug = input.planSlug || "trial";
    let planId: string | null = null;
    if (planSlug !== "trial") {
      const [p] = await db.select().from(saasPlans).where(eq(saasPlans.slug, planSlug)).limit(1);
      if (p) planId = p.id;
    }

    const subId = crypto.randomUUID();
    const now = new Date();
    const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(subscriptions).values({
      id: subId,
      companyId,
      plan: planSlug,
      planId,
      status: planSlug === "trial" ? "trialing" : "active",
      origin: "manual_courtesy",
      grantedByAdminId: adminUser.id,
      grantReason: input.reason || "Criação manual pelo Super Admin",
      trialStartedAt: now,
      trialEndsAt: trialEnds,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    });

    await logAdminAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: "CREATE_OWNER_MANUAL",
      entity: "company",
      entityId: companyId,
      entityName: input.name,
      reason: input.reason || "Criação manual pelo Super Admin",
      afterState: {
        companyId,
        userId,
        email: cleanEmail,
        plan: planSlug,
        slug: finalSlug,
      },
      request,
    });

    return {
      companyId,
      userId,
      email: cleanEmail,
      slug: finalSlug,
      temporaryPassword: rawPassword,
    };
  }

  /**
   * Edit owner / company details
   */
  static async updateOwner(
    companyId: string,
    data: {
      name?: string;
      businessType?: string;
      email?: string;
      phone?: string;
      cnpjOrCpf?: string;
      ownerName?: string;
      ownerPhone?: string;
      active?: boolean;
    },
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) throw new Error("Empresa não encontrada.");

    const companyUpdates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) companyUpdates.name = data.name;
    if (data.businessType !== undefined) companyUpdates.businessType = data.businessType;
    if (data.email !== undefined) companyUpdates.email = data.email.trim().toLowerCase();
    if (data.phone !== undefined) companyUpdates.phone = data.phone;
    if (data.cnpjOrCpf !== undefined) companyUpdates.cnpjOrCpf = data.cnpjOrCpf;
    if (data.active !== undefined) companyUpdates.onboarded = data.active;

    await db.update(companies).set(companyUpdates).where(eq(companies.id, companyId));

    // Update owner user if owner fields provided
    if (data.ownerName !== undefined || data.ownerPhone !== undefined) {
      const [ownerMembership] = await db
        .select({ userId: companyMemberships.userId })
        .from(companyMemberships)
        .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.role, "owner")))
        .limit(1);

      if (ownerMembership) {
        const userUpdates: Record<string, unknown> = { updatedAt: new Date() };
        if (data.ownerName !== undefined) userUpdates.name = data.ownerName;
        if (data.ownerPhone !== undefined) userUpdates.phone = data.ownerPhone;
        await db.update(users).set(userUpdates).where(eq(users.id, ownerMembership.userId));
      }
    }

    await logAdminAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: "UPDATE_OWNER",
      entity: "company",
      entityId: companyId,
      entityName: company.name,
      beforeState: company as any,
      afterState: { ...company, ...companyUpdates },
      request,
    });

    return { success: true };
  }

  /**
   * Soft delete owner / company
   */
  static async softDeleteOwner(
    companyId: string,
    reason: string,
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) throw new Error("Empresa não encontrada.");

    const now = new Date();

    // Mark company as deleted
    await db
      .update(companies)
      .set({
        deletedAt: now,
        deletedBy: adminUser.id,
        publicEnabled: false,
        updatedAt: now,
      })
      .where(eq(companies.id, companyId));

    // Deactivate owner user
    const [ownerMembership] = await db
      .select({ userId: companyMemberships.userId })
      .from(companyMemberships)
      .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.role, "owner")))
      .limit(1);

    if (ownerMembership) {
      await db
        .update(users)
        .set({
          deletedAt: now,
          deletedBy: adminUser.id,
          active: false,
          updatedAt: now,
        })
        .where(eq(users.id, ownerMembership.userId));
    }

    // Suspend subscription
    await db
      .update(subscriptions)
      .set({
        status: "suspended",
        revokedByAdminId: adminUser.id,
        revokeReason: reason || "Exclusão administrativa (Soft Delete)",
        updatedAt: now,
      })
      .where(eq(subscriptions.companyId, companyId));

    await logAdminAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: "SOFT_DELETE_OWNER",
      entity: "company",
      entityId: companyId,
      entityName: company.name,
      reason,
      beforeState: { deletedAt: company.deletedAt },
      afterState: { deletedAt: now, deletedBy: adminUser.id },
      request,
    });

    return { success: true };
  }

  /**
   * Hard delete owner / company (Definitive removal with name confirmation)
   */
  static async hardDeleteOwner(
    companyId: string,
    confirmedName: string,
    reason: string,
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) throw new Error("Empresa não encontrada.");

    if (company.name.trim().toLowerCase() !== confirmedName.trim().toLowerCase()) {
      throw new Error("O nome informado para confirmação não confere com o nome da empresa.");
    }

    // Record audit log BEFORE cascading delete
    await logAdminAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: "HARD_DELETE_OWNER",
      entity: "company",
      entityId: companyId,
      entityName: company.name,
      reason,
      beforeState: company as any,
      request,
    });

    // Delete company (cascades to locations, memberships, subscriptions, clients, employees)
    await db.delete(companies).where(eq(companies.id, companyId));

    return { success: true };
  }

  /**
   * List global clients across the platform
   */
  static async listClients(params: { q?: string; companyId?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (params.companyId) {
      conditions.push(eq(clients.companyId, params.companyId));
    }

    if (params.q && params.q.trim()) {
      const q = `%${params.q.trim()}%`;
      conditions.push(
        or(
          like(clients.name, q),
          like(clients.email, q),
          like(clients.phone, q),
          like(clients.document, q),
          like(companies.name, q)
        )
      );
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(clients)
      .leftJoin(companies, eq(companies.id, clients.companyId))
      .where(whereClause);

    const total = Number(countResult?.count ?? 0);

    const items = await db
      .select({
        id: clients.id,
        name: clients.name,
        email: clients.email,
        phone: clients.phone,
        document: clients.document,
        companyId: clients.companyId,
        companyName: companies.name,
        active: clients.active,
        deletedAt: clients.deletedAt,
        createdAt: clients.createdAt,
      })
      .from(clients)
      .leftJoin(companies, eq(companies.id, clients.companyId))
      .where(whereClause)
      .orderBy(desc(clients.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Soft delete client
   */
  static async softDeleteClient(clientId: string, reason: string, adminUser: { id: string; email: string }, request?: Request) {
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!client) throw new Error("Cliente não encontrado.");

    const now = new Date();
    await db
      .update(clients)
      .set({
        deletedAt: now,
        deletedBy: adminUser.id,
        active: false,
        updatedAt: now,
      })
      .where(eq(clients.id, clientId));

    await logAdminAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: "SOFT_DELETE_CLIENT",
      entity: "client",
      entityId: clientId,
      entityName: client.name,
      reason,
      beforeState: { deletedAt: client.deletedAt },
      afterState: { deletedAt: now, deletedBy: adminUser.id },
      request,
    });

    return { success: true };
  }

  /**
   * Hard delete client
   */
  static async hardDeleteClient(clientId: string, reason: string, adminUser: { id: string; email: string }, request?: Request) {
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!client) throw new Error("Cliente não encontrado.");

    await logAdminAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: "HARD_DELETE_CLIENT",
      entity: "client",
      entityId: clientId,
      entityName: client.name,
      reason,
      beforeState: client as any,
      request,
    });

    await db.delete(clients).where(eq(clients.id, clientId));
    return { success: true };
  }

  /**
   * Delete an employee (Soft delete with appointment treatment)
   */
  static async deleteEmployee(
    employeeId: string,
    actionOnAppointments: "cancel" | "keep",
    reason: string,
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
    if (!employee) throw new Error("Funcionário não encontrado.");

    const now = new Date();

    // Soft delete employee
    await db
      .update(employees)
      .set({
        deletedAt: now,
        deletedBy: adminUser.id,
        active: false,
        updatedAt: now,
      })
      .where(eq(employees.id, employeeId));

    let cancelledCount = 0;
    if (actionOnAppointments === "cancel") {
      const todayStr = now.toISOString().slice(0, 10);
      // Cancel upcoming scheduled appointments for this employee
      const futureAppointments = await db
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.employeeId, employeeId),
            gte(appointments.appointmentDate, todayStr),
            eq(appointments.status, "scheduled")
          )
        );

      if (futureAppointments.length > 0) {
        cancelledCount = futureAppointments.length;
        await db
          .update(appointments)
          .set({
            status: "cancelled",
            cancelledAt: now,
            cancelReason: `Profissional desligado via Super Admin: ${reason}`,
            updatedAt: now,
          })
          .where(
            inArray(
              appointments.id,
              futureAppointments.map((a) => a.id)
            )
          );
      }
    }

    await logAdminAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: "DELETE_EMPLOYEE",
      entity: "employee",
      entityId: employeeId,
      entityName: employee.name,
      reason,
      afterState: {
        actionOnAppointments,
        cancelledAppointments: cancelledCount,
        deletedAt: now,
        deletedBy: adminUser.id,
      },
      request,
    });

    return { success: true, cancelledAppointments: cancelledCount };
  }

  /**
   * Grant subscription manually (courtesy or future charge)
   */
  static async grantSubscriptionManual(
    params: {
      companyId: string;
      planSlug: string;
      originType: "manual_courtesy" | "manual_paid";
      periodDays?: number;
      reason: string;
    },
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    const { companyId, planSlug, originType, periodDays = 30, reason } = params;
    if (!reason || !reason.trim()) {
      throw new Error("Motivo da concessão manual é obrigatório para auditoria.");
    }

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) throw new Error("Empresa não encontrada.");

    let planId: string | null = null;
    let planName = planSlug;
    let planAmount = "0.00";

    if (planSlug !== "trial") {
      const [p] = await db.select().from(saasPlans).where(eq(saasPlans.slug, planSlug)).limit(1);
      if (!p) throw new Error(`Plano '${planSlug}' não encontrado.`);
      planId = p.id;
      planName = p.name;
      planAmount = p.monthlyPrice;
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

    const [existingSub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, companyId)).limit(1);

    const beforeState = existingSub ? (existingSub as any) : null;

    if (existingSub) {
      await db
        .update(subscriptions)
        .set({
          plan: planSlug,
          planId,
          status: "active",
          origin: originType,
          grantedByAdminId: adminUser.id,
          grantReason: reason,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextPaymentAt: originType === "manual_courtesy" ? null : periodEnd,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existingSub.id));
    } else {
      await db.insert(subscriptions).values({
        id: crypto.randomUUID(),
        companyId,
        plan: planSlug,
        planId,
        status: "active",
        origin: originType,
        grantedByAdminId: adminUser.id,
        grantReason: reason,
        trialStartedAt: now,
        trialEndsAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextPaymentAt: originType === "manual_courtesy" ? null : periodEnd,
      });
    }

    // Record invoice receipt if courtesy
    const invoiceId = crypto.randomUUID();
    await db.insert(subscriptionInvoices).values({
      id: invoiceId,
      subscriptionId: existingSub?.id ?? invoiceId,
      companyId,
      number: `INV-MANUAL-${Date.now().toString().slice(-6)}`,
      planSlug,
      billingInterval: "monthly",
      amount: originType === "manual_courtesy" ? "0.00" : planAmount,
      currency: "BRL",
      paymentMethod: "manual",
      status: "paid",
      paidAt: now,
      metadata: {
        grantedBy: adminUser.email,
        reason,
        originType,
      },
    });

    await logAdminAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: "GRANT_SUBSCRIPTION_MANUAL",
      entity: "subscription",
      entityId: existingSub?.id ?? companyId,
      entityName: `${company.name} (${planName})`,
      reason,
      beforeState,
      afterState: {
        plan: planSlug,
        origin: originType,
        periodDays,
        currentPeriodEnd: periodEnd,
        grantedBy: adminUser.email,
      },
      request,
    });

    return { success: true, planSlug, periodEnd };
  }

  /**
   * Revoke subscription manually
   */
  static async revokeSubscriptionManual(
    params: {
      companyId: string;
      immediately: boolean;
      reason: string;
    },
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    const { companyId, immediately, reason } = params;
    if (!reason || !reason.trim()) {
      throw new Error("Motivo da revogação é obrigatório para auditoria.");
    }

    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, companyId)).limit(1);
    if (!sub) throw new Error("Assinatura não encontrada para esta empresa.");

    const now = new Date();
    const beforeState = sub as any;

    if (immediately) {
      await db
        .update(subscriptions)
        .set({
          status: "cancelled",
          cancelledAt: now,
          cancelAtPeriodEnd: false,
          revokedByAdminId: adminUser.id,
          revokeReason: reason,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, sub.id));
    } else {
      await db
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: true,
          revokedByAdminId: adminUser.id,
          revokeReason: reason,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, sub.id));
    }

    await logAdminAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: immediately ? "REVOKE_SUBSCRIPTION_IMMEDIATELY" : "REVOKE_SUBSCRIPTION_AT_PERIOD_END",
      entity: "subscription",
      entityId: sub.id,
      reason,
      beforeState,
      afterState: {
        status: immediately ? "cancelled" : sub.status,
        cancelAtPeriodEnd: !immediately,
        revokedBy: adminUser.email,
      },
      request,
    });

    return { success: true, immediately };
  }
}

