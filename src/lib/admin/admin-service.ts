import { and, count, desc, eq, gt, gte, inArray, isNotNull, isNull, like, lte, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  adminAuditLogs,
  appointments,
  clients,
  companies,
  companyMemberships,
  customerCredentials,
  employees,
  payments,
  saasCouponRedemptions,
  saasCoupons,
  saasPlans,
  services,
  subscriptionInvoices,
  subscriptions,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { generateRandomPin, hashPinLookup, isWeakPin } from "@/lib/customer-access/service";
import { normalizePhoneDigits } from "@/lib/domain";
import { logAdminAction } from "./audit";

export interface ListOwnersParams {
  q?: string;
  search?: string;
  status?:
    | "all"
    | "active"
    | "inactive"
    | "trial"
    | "trial_expired"
    | "pending_payment"
    | "suspended"
    | "cancelled"
    | "deleted";
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
  accessType?: "trial" | "courtesy" | "pending";
  grantCourtesy?: boolean;
  couponCode?: string;
  periodDays?: number;
  reason?: string;
}

export interface ListUsersParams {
  q?: string;
  search?: string;
  role?: "all" | "superadmin" | "owner" | "employee" | "customer" | "admin" | "manager" | "client";
  status?: "all" | "active" | "inactive";
  companyId?: string;
  page?: number;
  limit?: number;
}

export interface CreateUserManualInput {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role: "superadmin" | "owner" | "employee" | "customer";
  companyId?: string;
  companyName?: string;
  businessType?: string;
  planSlug?: string;
  accessType?: "trial" | "courtesy" | "pending";
  grantCourtesy?: boolean;
  reason?: string;
}

export interface ListUserPinsParams {
  q?: string;
  search?: string;
  role?: "all" | "superadmin" | "owner" | "employee" | "customer" | "admin" | "manager" | "client";
  pinStatus?: "all" | "configured" | "not_configured" | "locked";
  page?: number;
  limit?: number;
}

export interface ResetUserPinInput {
  pin?: string;
  newPhone?: string;
  unlock?: boolean;
}

export class AdminService {
  /**
   * List companies/owners with pagination, rich multi-field search and filters
   */
  static async listOwners(params: ListOwnersParams = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;
    const now = new Date();

    const conditions = [];

    // Status filter
    if (params.status === "deleted") {
      conditions.push(isNotNull(companies.deletedAt));
    } else if (params.status === "active") {
      conditions.push(
        and(
          isNull(companies.deletedAt),
          eq(companies.onboarded, true),
          eq(companies.publicEnabled, true)
        )
      );
    } else if (params.status === "inactive") {
      conditions.push(and(isNull(companies.deletedAt), eq(companies.onboarded, false)));
    } else if (params.status === "trial") {
      conditions.push(
        and(
          isNull(companies.deletedAt),
          eq(subscriptions.status, "trialing"),
          gte(subscriptions.trialEndsAt, now)
        )
      );
    } else if (params.status === "trial_expired") {
      conditions.push(
        and(
          isNull(companies.deletedAt),
          or(
            eq(subscriptions.status, "expired"),
            and(eq(subscriptions.status, "trialing"), lte(subscriptions.trialEndsAt, now))
          )
        )
      );
    } else if (params.status === "pending_payment") {
      conditions.push(
        and(
          isNull(companies.deletedAt),
          inArray(subscriptions.status, ["pending", "past_due", "payment_failed"])
        )
      );
    } else if (params.status === "suspended") {
      conditions.push(
        and(
          isNull(companies.deletedAt),
          or(eq(subscriptions.status, "suspended"), eq(companies.publicEnabled, false))
        )
      );
    } else if (params.status === "cancelled") {
      conditions.push(and(isNull(companies.deletedAt), eq(subscriptions.status, "cancelled")));
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
    const queryTerm = (params.q || params.search || "").trim();
    if (queryTerm) {
      const q = `%${queryTerm}%`;
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

    const whereClause = conditions.length ? and(...conditions) : undefined;

    // Total count query
    const [countResult] = await db
      .select({ count: sql<number>`count(distinct ${companies.id})` })
      .from(companies)
      .leftJoin(subscriptions, eq(subscriptions.companyId, companies.id))
      .leftJoin(
        companyMemberships,
        and(eq(companyMemberships.companyId, companies.id), eq(companyMemberships.role, "owner"))
      )
      .leftJoin(
        users,
        or(
          eq(users.id, companyMemberships.userId),
          and(eq(users.companyId, companies.id), eq(users.role, "owner"))
        )
      )
      .where(whereClause);

    const total = Number(countResult?.count ?? 0);

    // Data query (Distinct per company)
    const compRows = await db
      .select({
        id: companies.id,
        name: companies.name,
        businessType: companies.businessType,
        email: companies.email,
        phone: companies.phone,
        cnpjOrCpf: companies.cnpjOrCpf,
        publicSlug: companies.publicSlug,
        publicEnabled: companies.publicEnabled,
        onboarded: companies.onboarded,
        originCouponId: companies.originCouponId,
        deletedAt: companies.deletedAt,
        createdAt: companies.createdAt,
        subscriptionPlan: subscriptions.plan,
        subscriptionStatus: subscriptions.status,
        subscriptionOrigin: subscriptions.origin,
        trialEndsAt: subscriptions.trialEndsAt,
        nextPaymentAt: subscriptions.nextPaymentAt,
      })
      .from(companies)
      .leftJoin(subscriptions, eq(subscriptions.companyId, companies.id))
      .leftJoin(
        companyMemberships,
        and(eq(companyMemberships.companyId, companies.id), eq(companyMemberships.role, "owner"))
      )
      .leftJoin(
        users,
        or(
          eq(users.id, companyMemberships.userId),
          and(eq(users.companyId, companies.id), eq(users.role, "owner"))
        )
      )
      .where(whereClause)
      .groupBy(companies.id)
      .orderBy(desc(companies.createdAt))
      .limit(limit)
      .offset(offset);

    // Batch resolve owner info, employee count, and client count
    const companyIds = compRows.map((r) => r.id);
    let employeesCountMap = new Map<string, number>();
    let clientsCountMap = new Map<string, number>();
    const ownerMap = new Map<string, { id: string; name: string; email: string; phone: string | null }>();

    if (companyIds.length > 0) {
      const [empCounts, clientCounts, membershipOwners, directOwners] = await Promise.all([
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
        db
          .select({
            companyId: companyMemberships.companyId,
            id: users.id,
            name: users.name,
            email: users.email,
            phone: users.phone,
          })
          .from(companyMemberships)
          .innerJoin(users, eq(users.id, companyMemberships.userId))
          .where(and(inArray(companyMemberships.companyId, companyIds), eq(companyMemberships.role, "owner"))),
        db
          .select({
            companyId: users.companyId,
            id: users.id,
            name: users.name,
            email: users.email,
            phone: users.phone,
          })
          .from(users)
          .where(and(inArray(users.companyId, companyIds), eq(users.role, "owner"))),
      ]);

      employeesCountMap = new Map(empCounts.map((e) => [e.companyId, Number(e.count)]));
      clientsCountMap = new Map(clientCounts.map((c) => [c.companyId, Number(c.count)]));

      for (const d of directOwners) {
        if (d.companyId) ownerMap.set(d.companyId, { id: d.id, name: d.name, email: d.email, phone: d.phone });
      }
      for (const m of membershipOwners) {
        if (m.companyId) ownerMap.set(m.companyId, { id: m.id, name: m.name, email: m.email, phone: m.phone });
      }
    }

    const items = compRows.map((r) => {
      const owner = ownerMap.get(r.id);
      return {
        ...r,
        plan: r.subscriptionPlan || "trial",
        status: r.subscriptionStatus || (r.publicEnabled ? "active" : "inactive"),
        ownerId: owner?.id ?? null,
        ownerName: owner?.name ?? null,
        ownerEmail: owner?.email ?? null,
        ownerPhone: owner?.phone ?? null,
        primaryOwner: owner ? { id: owner.id, name: owner.name, email: owner.email, phone: owner.phone } : null,
        totalEmployees: employeesCountMap.get(r.id) ?? 0,
        totalClients: clientsCountMap.get(r.id) ?? 0,
        isDeleted: Boolean(r.deletedAt),
      };
    });

    return {
      data: items,
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

    // Find owner user checking both memberships and direct association
    let primaryUser: any = null;
    const [ownerMembership] = await db
      .select({
        membershipId: companyMemberships.id,
        role: companyMemberships.role,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          role: users.role,
          active: users.active,
          createdAt: users.createdAt,
        },
      })
      .from(companyMemberships)
      .innerJoin(users, eq(users.id, companyMemberships.userId))
      .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.role, "owner")))
      .limit(1);

    if (ownerMembership?.user) {
      primaryUser = ownerMembership.user;
    } else {
      const [directUser] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          role: users.role,
          active: users.active,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(and(eq(users.companyId, companyId), eq(users.role, "owner")))
        .limit(1);
      if (directUser) primaryUser = directUser;
    }

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
    } else if (subscription?.plan) {
      const [p] = await db.select().from(saasPlans).where(eq(saasPlans.slug, subscription.plan)).limit(1);
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

    // Counts & lists
    const [empList, clientList, [servicesCountRes], [appointmentsCountRes]] = await Promise.all([
      db
        .select({
          id: employees.id,
          name: employees.name,
          phone: employees.phone,
          jobTitle: employees.jobTitle,
          active: employees.active,
          createdAt: employees.createdAt,
        })
        .from(employees)
        .where(and(eq(employees.companyId, companyId), isNull(employees.deletedAt)))
        .orderBy(desc(employees.createdAt)),
      db
        .select({
          id: clients.id,
          name: clients.name,
          email: clients.email,
          phone: clients.phone,
          active: clients.active,
          createdAt: clients.createdAt,
        })
        .from(clients)
        .where(and(eq(clients.companyId, companyId), isNull(clients.deletedAt)))
        .orderBy(desc(clients.createdAt))
        .limit(50),
      db
        .select({ count: sql<number>`count(*)` })
        .from(services)
        .where(eq(services.companyId, companyId)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(appointments)
        .where(eq(appointments.companyId, companyId)),
    ]);

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
          primaryUser?.id
            ? and(eq(adminAuditLogs.entity, "user"), eq(adminAuditLogs.entityId, primaryUser.id))
            : undefined,
          subscription
            ? and(eq(adminAuditLogs.entity, "subscription"), eq(adminAuditLogs.entityId, subscription.id))
            : undefined
        )
      )
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(50);

    return {
      company,
      primaryOwner: primaryUser,
      owner: primaryUser,
      subscription,
      plan,
      invoices,
      employees: empList,
      clients: clientList,
      totalServices: Number(servicesCountRes?.count ?? 0),
      totalAppointments: Number(appointmentsCountRes?.count ?? 0),
      originCoupon,
      auditLogs: auditHistory,
      auditHistory,
    };
  }

  /**
   * Create an owner and company manually from Super Admin with full MySQL transaction
   */
  static async createOwnerManual(
    input: CreateOwnerManualInput,
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    const cleanEmail = input.email.trim().toLowerCase();

    // 1. Check email uniqueness across users
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (existingUser) {
      throw new Error(`O e-mail '${cleanEmail}' já está cadastrado no sistema.`);
    }

    const cleanSlug =
      input.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 50) || `negocio-${Date.now()}`;

    // Ensure unique slug
    let finalSlug = cleanSlug;
    const [existingSlug] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.publicSlug, finalSlug))
      .limit(1);

    if (existingSlug) {
      finalSlug = `${cleanSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Password
    const rawPassword = input.password || `Reservei@${Math.floor(1000 + Math.random() * 9000)}`;
    const passwordHash = await hashPassword(rawPassword);

    // Origin coupon check
    let originCouponId: string | null = null;
    if (input.couponCode) {
      const [cp] = await db
        .select()
        .from(saasCoupons)
        .where(eq(saasCoupons.code, input.couponCode.trim().toUpperCase()))
        .limit(1);
      if (cp) originCouponId = cp.id;
    }

    const companyId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const subId = crypto.randomUUID();

    const planSlug = input.planSlug || "trial";
    let planId: string | null = null;
    if (planSlug !== "trial") {
      const [p] = await db.select().from(saasPlans).where(eq(saasPlans.slug, planSlug)).limit(1);
      if (p) planId = p.id;
    }

    const now = new Date();
    const isCourtesy =
      input.accessType === "courtesy" ||
      Boolean(input.grantCourtesy) ||
      (Boolean(input.reason) && /cortesia/i.test(input.reason || ""));
    const isPending = input.accessType === "pending";

    let initialSubStatus = "trialing";
    let subOrigin = "checkout";
    const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const periodEnds = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (isCourtesy) {
      if (!input.reason || !input.reason.trim()) {
        throw new Error("Justificativa obrigatória para concessão de cortesia administrativa.");
      }
      initialSubStatus = "active";
      subOrigin = "manual_courtesy";
    } else if (isPending) {
      initialSubStatus = "pending";
    }

    // Execute atomic transaction
    await db.transaction(async (tx) => {
      // 1. Create company
      await tx.insert(companies).values({
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

      // 2. Create user (owner)
      await tx.insert(users).values({
        id: userId,
        companyId,
        name: input.ownerName || input.name,
        email: cleanEmail,
        phone: input.phone ?? null,
        passwordHash,
        role: "owner",
        emailVerified: true,
        emailVerifiedAt: now,
      });

      // 3. Create membership link
      await tx.insert(companyMemberships).values({
        userId,
        companyId,
        role: "owner",
        active: true,
      });

      // 4. Create subscription
      await tx.insert(subscriptions).values({
        id: subId,
        companyId,
        plan: planSlug,
        planId,
        status: initialSubStatus,
        origin: subOrigin,
        grantedByAdminId: isCourtesy ? adminUser.id : null,
        grantReason: isCourtesy ? input.reason : null,
        trialStartedAt: now,
        trialEndsAt: trialEnds,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnds,
      });

      // 5. Audit log
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
          accessType: input.accessType || (isCourtesy ? "courtesy" : "trial"),
        },
        request,
      });
    });

    return {
      companyId,
      userId,
      ownerId: userId,
      email: cleanEmail,
      slug: finalSlug,
      temporaryPassword: rawPassword,
    };
  }

  /**
   * List all system users with role/level, active status, linked company and subscription
   */
  static async listUsers(params: ListUsersParams = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    // Role filter
    if (params.role && params.role !== "all") {
      if (params.role === "superadmin") {
        conditions.push(or(eq(users.isSuperadmin, true), eq(users.role, "superadmin")));
      } else if (params.role === "customer" || params.role === "client") {
        conditions.push(or(eq(users.role, "customer"), eq(users.role, "client")));
      } else {
        conditions.push(eq(users.role, params.role));
      }
    }

    // Status filter
    if (params.status && params.status !== "all") {
      if (params.status === "active") {
        conditions.push(and(eq(users.active, true), isNull(users.deletedAt)));
      } else if (params.status === "inactive") {
        conditions.push(or(eq(users.active, false), isNotNull(users.deletedAt)));
      }
    }

    // Company filter
    if (params.companyId) {
      conditions.push(eq(users.companyId, params.companyId));
    }

    // Search query
    const queryTerm = (params.q || params.search || "").trim();
    if (queryTerm) {
      const q = `%${queryTerm}%`;
      conditions.push(
        or(
          like(users.name, q),
          like(users.email, q),
          like(users.phone, q),
          like(companies.name, q)
        )
      );
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    // Total count
    const [countRes] = await db
      .select({ count: sql<number>`count(distinct ${users.id})` })
      .from(users)
      .leftJoin(companies, eq(companies.id, users.companyId))
      .where(whereClause);

    const total = Number(countRes?.count ?? 0);

    // Users list
    const userRows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isSuperadmin: users.isSuperadmin,
        adminRole: users.adminRole,
        active: users.active,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        companyId: users.companyId,
        companyName: companies.name,
        companySlug: companies.publicSlug,
        subscriptionPlan: subscriptions.plan,
        subscriptionStatus: subscriptions.status,
        trialEndsAt: subscriptions.trialEndsAt,
      })
      .from(users)
      .leftJoin(companies, eq(companies.id, users.companyId))
      .leftJoin(subscriptions, eq(subscriptions.companyId, companies.id))
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const items = userRows.map((u) => {
      const level = u.isSuperadmin || u.role === "superadmin"
        ? "superadmin"
        : u.role === "owner"
        ? "owner"
        : u.role === "employee"
        ? "employee"
        : "customer";

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        level,
        isSuperadmin: Boolean(u.isSuperadmin),
        adminRole: u.adminRole,
        active: Boolean(u.active),
        emailVerified: Boolean(u.emailVerified),
        company: u.companyId
          ? {
              id: u.companyId,
              name: u.companyName || "Empresa",
              slug: u.companySlug || "",
            }
          : null,
        subscription: u.subscriptionPlan
          ? {
              plan: u.subscriptionPlan,
              status: u.subscriptionStatus || "active",
              trialEndsAt: u.trialEndsAt,
            }
          : null,
      };
    });

    // Compute system-wide user stats for dashboard cards
    const [statsRes] = await db
      .select({
        totalUsers: sql<number>`count(*)`,
        totalOwners: sql<number>`sum(case when ${users.role} = 'owner' then 1 else 0 end)`,
        totalEmployees: sql<number>`sum(case when ${users.role} in ('employee', 'professional', 'manager', 'admin') and (${users.isSuperadmin} is false or ${users.isSuperadmin} is null) then 1 else 0 end)`,
        totalCustomers: sql<number>`sum(case when ${users.role} in ('customer', 'client') then 1 else 0 end)`,
        totalSuperadmins: sql<number>`sum(case when ${users.isSuperadmin} is true or ${users.role} = 'superadmin' then 1 else 0 end)`,
        totalActive: sql<number>`sum(case when ${users.active} is true and ${users.deletedAt} is null then 1 else 0 end)`,
      })
      .from(users);

    const stats = {
      totalUsers: Number(statsRes?.totalUsers ?? 0),
      totalOwners: Number(statsRes?.totalOwners ?? 0),
      totalEmployees: Number(statsRes?.totalEmployees ?? 0),
      totalCustomers: Number(statsRes?.totalCustomers ?? 0),
      totalSuperadmins: Number(statsRes?.totalSuperadmins ?? 0),
      totalActive: Number(statsRes?.totalActive ?? 0),
    };

    return {
      items,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Create any user (Super Admin, Owner, Employee, Customer) directly in MySQL
   */
  static async createUserManual(
    input: CreateUserManualInput,
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    const cleanEmail = input.email.trim().toLowerCase();

    // Check unique email
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (existing) {
      throw new Error(`O e-mail '${cleanEmail}' já está cadastrado no sistema.`);
    }

    const rawPassword = input.password || `Reservei@${Math.floor(1000 + Math.random() * 9000)}`;
    const passwordHash = await hashPassword(rawPassword);
    const userId = crypto.randomUUID();
    const now = new Date();

    const isSuperadmin = input.role === "superadmin";
    let targetCompanyId: string | null = input.companyId || null;

    await db.transaction(async (tx) => {
      // If role is owner and companyName provided, create company & subscription
      if (input.role === "owner" && input.companyName && !targetCompanyId) {
        const companyId = crypto.randomUUID();
        const cleanSlug =
          input.companyName
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 50) || `empresa-${Date.now()}`;

        let finalSlug = cleanSlug;
        const [existingSlug] = await tx
          .select({ id: companies.id })
          .from(companies)
          .where(eq(companies.publicSlug, finalSlug))
          .limit(1);

        if (existingSlug) {
          finalSlug = `${cleanSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
        }

        await tx.insert(companies).values({
          id: companyId,
          name: input.companyName,
          businessType: input.businessType ?? "Geral",
          email: cleanEmail,
          phone: input.phone ?? null,
          publicSlug: finalSlug,
          publicEnabled: true,
          onboarded: true,
        });

        const subId = crypto.randomUUID();
        const isCourtesy = input.accessType === "courtesy" || Boolean(input.grantCourtesy);
        const initialStatus = isCourtesy ? "active" : input.accessType === "pending" ? "pending" : "trialing";
        const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const periodEnds = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        await tx.insert(subscriptions).values({
          id: subId,
          companyId,
          plan: input.planSlug || "trial",
          status: initialStatus,
          origin: isCourtesy ? "manual_courtesy" : "checkout",
          grantedByAdminId: isCourtesy ? adminUser.id : null,
          grantReason: isCourtesy ? input.reason || "Cortesia Super Admin" : null,
          trialStartedAt: now,
          trialEndsAt: trialEnds,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnds,
        });

        targetCompanyId = companyId;
      }

      // Insert User
      await tx.insert(users).values({
        id: userId,
        companyId: targetCompanyId,
        name: input.name,
        email: cleanEmail,
        phone: input.phone ?? null,
        passwordHash,
        role: isSuperadmin ? "superadmin" : input.role,
        isSuperadmin,
        adminRole: isSuperadmin ? "super_admin" : null,
        active: true,
        emailVerified: true,
        emailVerifiedAt: now,
      });

      // Insert membership if associated with a company
      if (targetCompanyId) {
        await tx.insert(companyMemberships).values({
          userId,
          companyId: targetCompanyId,
          role: input.role === "superadmin" ? "owner" : input.role,
          active: true,
        });

        if (input.role === "employee") {
          await tx.insert(employees).values({
            id: crypto.randomUUID(),
            companyId: targetCompanyId,
            userId,
            name: input.name,
            phone: input.phone ?? null,
            active: true,
          });
        }
      }

      // Audit Log
      await logAdminAction({
        adminUserId: adminUser.id,
        adminEmail: adminUser.email,
        action: "CREATE_USER_MANUAL",
        entity: "user",
        entityId: userId,
        entityName: input.name,
        reason: input.reason || `Criação manual do usuário (${input.role}) pelo Super Admin`,
        afterState: {
          id: userId,
          name: input.name,
          email: cleanEmail,
          role: input.role,
          isSuperadmin,
          companyId: targetCompanyId,
        },
        request,
      });
    });

    return {
      userId,
      name: input.name,
      email: cleanEmail,
      role: input.role,
      isSuperadmin,
      temporaryPassword: rawPassword,
      companyId: targetCompanyId,
    };
  }

  /**
   * Update user level/role, active status or reset password
   */
  static async updateUserRoleAndStatus(
    userId: string,
    input: {
      role?: string;
      isSuperadmin?: boolean;
      active?: boolean;
      name?: string;
      phone?: string;
      password?: string;
    },
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error("Usuário não encontrado.");

    const updateData: any = {};
    if (typeof input.name === "string") updateData.name = input.name.trim();
    if (typeof input.phone === "string") updateData.phone = input.phone.trim();
    if (typeof input.role === "string") updateData.role = input.role;
    if (typeof input.isSuperadmin === "boolean") {
      updateData.isSuperadmin = input.isSuperadmin;
      updateData.adminRole = input.isSuperadmin ? "super_admin" : null;
    }
    if (typeof input.active === "boolean") updateData.active = input.active;
    if (input.password && input.password.length >= 6) {
      updateData.passwordHash = await hashPassword(input.password);
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(users).set(updateData).where(eq(users.id, userId));

      await logAdminAction({
        adminUserId: adminUser.id,
        adminEmail: adminUser.email,
        action: "UPDATE_USER",
        entity: "user",
        entityId: userId,
        entityName: user.name,
        reason: "Atualização de dados/nível do usuário pelo Super Admin",
        beforeState: { role: user.role, isSuperadmin: user.isSuperadmin, active: user.active },
        afterState: updateData,
        request,
      });
    }

    return { success: true };
  }

  /**
   * Delete or deactivate user
   */
  static async deleteUser(
    userId: string,
    mode: "soft" | "hard" = "soft",
    reason = "Exclusão administrativa",
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    if (userId === adminUser.id) {
      throw new Error("Você não pode excluir sua própria conta de Super Admin.");
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error("Usuário não encontrado.");

    if (mode === "hard") {
      await db.delete(users).where(eq(users.id, userId));
    } else {
      await db
        .update(users)
        .set({ active: false, deletedAt: new Date(), deletedBy: adminUser.id })
        .where(eq(users.id, userId));
    }

    await logAdminAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: "DELETE_USER",
      entity: "user",
      entityId: userId,
      entityName: user.name,
      reason,
      afterState: { deleted: true, mode },
      request,
    });

    return { success: true };
  }

  /**
   * List users with their PIN credential status, lock indicators and metrics
   */
  static async listUserPins(params: ListUserPinsParams = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;
    const now = new Date();

    const conditions = [];

    // Role filter
    if (params.role && params.role !== "all") {
      if (params.role === "superadmin") {
        conditions.push(or(eq(users.isSuperadmin, true), eq(users.role, "superadmin")));
      } else if (params.role === "customer" || params.role === "client") {
        conditions.push(or(eq(users.role, "customer"), eq(users.role, "client")));
      } else {
        conditions.push(eq(users.role, params.role));
      }
    }

    // Pre-fetch credentials for PIN status filtering to prevent MySQL collation mismatch
    if (params.pinStatus && params.pinStatus !== "all") {
      if (params.pinStatus === "configured") {
        const creds = await db.select({ userId: customerCredentials.userId }).from(customerCredentials);
        const userIdsWithCreds = creds.map((c) => c.userId);
        if (userIdsWithCreds.length > 0) {
          conditions.push(inArray(users.id, userIdsWithCreds));
        } else {
          conditions.push(sql`1=0`);
        }
      } else if (params.pinStatus === "not_configured") {
        const creds = await db.select({ userId: customerCredentials.userId }).from(customerCredentials);
        const userIdsWithCreds = creds.map((c) => c.userId);
        if (userIdsWithCreds.length > 0) {
          conditions.push(notInArray(users.id, userIdsWithCreds));
        }
      } else if (params.pinStatus === "locked") {
        const creds = await db
          .select({ userId: customerCredentials.userId })
          .from(customerCredentials)
          .where(and(isNotNull(customerCredentials.lockedUntil), gt(customerCredentials.lockedUntil, now)));
        const userIdsLocked = creds.map((c) => c.userId);
        if (userIdsLocked.length > 0) {
          conditions.push(inArray(users.id, userIdsLocked));
        } else {
          conditions.push(sql`1=0`);
        }
      }
    }

    // Search query on users and companies (same collation)
    const queryTerm = (params.q || params.search || "").trim();
    if (queryTerm) {
      const q = `%${queryTerm}%`;
      conditions.push(
        or(
          like(users.name, q),
          like(users.email, q),
          like(users.phone, q),
          like(companies.name, q)
        )
      );
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    // Total count for current filter
    const [countRes] = await db
      .select({ count: sql<number>`count(distinct ${users.id})` })
      .from(users)
      .leftJoin(companies, eq(companies.id, users.companyId))
      .where(whereClause);

    const total = Number(countRes?.count ?? 0);

    // Global summary counts (across all users)
    const [totalUsersRes] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const allCreds = await db.select().from(customerCredentials);
    const totalUsers = Number(totalUsersRes?.count ?? 0);
    const lockedPins = allCreds.filter((c) => c.lockedUntil && new Date(c.lockedUntil) > now).length;
    const configuredPins = allCreds.length - lockedPins;
    const unconfiguredPins = Math.max(0, totalUsers - allCreds.length);

    // Rows from users & companies
    const userRows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isSuperadmin: users.isSuperadmin,
        active: users.active,
        createdAt: users.createdAt,
        companyId: users.companyId,
        companyName: companies.name,
      })
      .from(users)
      .leftJoin(companies, eq(companies.id, users.companyId))
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    // Fetch credentials only for the returned user rows
    const pageUserIds = userRows.map((u) => u.id);
    const pageCreds = pageUserIds.length > 0
      ? await db
          .select()
          .from(customerCredentials)
          .where(inArray(customerCredentials.userId, pageUserIds))
      : [];

    const credsMap = new Map(pageCreds.map((c) => [c.userId, c]));

    const items = userRows.map((r) => {
      const cred = credsMap.get(r.id);
      const isLocked = Boolean(cred?.lockedUntil && new Date(cred.lockedUntil) > now);
      const hasPin = Boolean(cred?.id);
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        role: r.role,
        isSuperadmin: r.isSuperadmin,
        active: r.active,
        createdAt: r.createdAt,
        companyId: r.companyId,
        companyName: r.companyName || "Global / Sem Empresa",
        hasPin,
        pinUpdatedAt: cred?.pinUpdatedAt || null,
        pinCreatedAt: cred?.pinCreatedAt || null,
        failedAttempts: cred?.failedAttempts ?? 0,
        lockedUntil: cred?.lockedUntil || null,
        isLocked,
        lastLoginAt: cred?.lastLoginAt || null,
      };
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats: {
        totalUsers,
        configuredPins,
        unconfiguredPins,
        lockedPins,
      },
    };
  }

  /**
   * Reset or set a user's 6-digit PIN (admin override)
   */
  static async resetUserPin(
    userId: string,
    input: ResetUserPinInput,
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error("Usuário não encontrado.");

    let finalPin = input.pin?.trim();
    if (finalPin) {
      if (!/^\d{4,6}$/.test(finalPin)) {
        throw new Error("O PIN deve conter exatamente 4 a 6 dígitos numéricos.");
      }
      if (isWeakPin(finalPin)) {
        throw new Error("Este PIN é muito fraco (sequência óbvia ou repetitiva). Escolha outro.");
      }
    } else {
      finalPin = generateRandomPin();
    }

    let phoneToUse = user.phone || "";
    if (input.newPhone && input.newPhone.trim()) {
      phoneToUse = input.newPhone.trim();
      await db.update(users).set({ phone: phoneToUse, updatedAt: new Date() }).where(eq(users.id, userId));
      await db.update(clients).set({ phone: phoneToUse, updatedAt: new Date() }).where(eq(clients.userId, userId));
    }

    const phoneNorm = phoneToUse.trim()
      ? normalizePhoneDigits(phoneToUse)
      : `u_${user.id.replace(/-/g, "").slice(0, 18)}`;

    const pinHash = await hashPassword(finalPin);
    const pinLookupHash = hashPinLookup(finalPin);

    const [existingCred] = await db
      .select()
      .from(customerCredentials)
      .where(eq(customerCredentials.userId, userId))
      .limit(1);

    if (existingCred) {
      await db
        .update(customerCredentials)
        .set({
          pinHash,
          pinLookupHash,
          phoneNormalized: phoneNorm,
          pinUpdatedAt: new Date(),
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(customerCredentials.id, existingCred.id));
    } else {
      await db.insert(customerCredentials).values({
        id: crypto.randomUUID(),
        userId: user.id,
        phoneNormalized: phoneNorm,
        pinHash,
        pinLookupHash,
        pinCreatedAt: new Date(),
        pinUpdatedAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
      });
    }

    await logAdminAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: "RESET_USER_PIN",
      entity: "user",
      entityId: userId,
      entityName: user.name,
      reason: "Redefinição de PIN pelo Super Admin",
      afterState: {
        userId: user.id,
        phone: phoneToUse,
        pinGenerated: !input.pin,
        unlocked: true,
      },
      request,
    });

    return {
      success: true,
      pin: finalPin,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userPhone: phoneToUse,
    };
  }

  /**
   * Unlock a user whose PIN was locked after failed attempts
   */
  static async unlockUserPin(
    userId: string,
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error("Usuário não encontrado.");

    await db
      .update(customerCredentials)
      .set({
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(customerCredentials.userId, userId));

    await logAdminAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: "UNLOCK_USER_PIN",
      entity: "user",
      entityId: userId,
      entityName: user.name,
      reason: "Desbloqueio de tentativas de PIN pelo Super Admin",
      afterState: { unlocked: true },
      request,
    });

    return { success: true };
  }

  /**
   * Remove a user's PIN credential
   */
  static async removeUserPin(
    userId: string,
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error("Usuário não encontrado.");

    await db.delete(customerCredentials).where(eq(customerCredentials.userId, userId));

    await logAdminAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: "REMOVE_USER_PIN",
      entity: "user",
      entityId: userId,
      entityName: user.name,
      reason: "Remoção de credencial PIN pelo Super Admin",
      afterState: { removed: true },
      request,
    });

    return { success: true };
  }

  /**
   * Alias for creating an owner with company
   */
  static async createOwnerWithCompany(input: {
    ownerName: string;
    ownerEmail: string;
    ownerPhone?: string;
    companyName: string;
    companySlug?: string;
    category?: string;
    planSlug: string;
    accessType?: "trial" | "courtesy" | "pending";
    periodDays?: number;
    reason?: string;
    adminUser: { id: string; email: string };
    request?: Request;
  }) {
    return this.createOwnerManual(
      {
        name: input.companyName,
        businessType: input.category,
        phone: input.ownerPhone,
        ownerName: input.ownerName,
        email: input.ownerEmail,
        planSlug: input.planSlug,
        accessType: input.accessType,
        periodDays: input.periodDays,
        reason: input.reason,
      },
      input.adminUser,
      input.request
    );
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
    if (data.active !== undefined) {
      companyUpdates.onboarded = data.active;
      companyUpdates.publicEnabled = data.active;
    }

    await db.update(companies).set(companyUpdates).where(eq(companies.id, companyId));

    // Update owner user if owner fields provided
    if (data.ownerName !== undefined || data.ownerPhone !== undefined) {
      // Look in companyMemberships first, then direct
      let targetUserId: string | null = null;
      const [membership] = await db
        .select({ userId: companyMemberships.userId })
        .from(companyMemberships)
        .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.role, "owner")))
        .limit(1);

      if (membership) {
        targetUserId = membership.userId;
      } else {
        const [direct] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.companyId, companyId), eq(users.role, "owner")))
          .limit(1);
        if (direct) targetUserId = direct.id;
      }

      if (targetUserId) {
        const userUpdates: Record<string, unknown> = { updatedAt: new Date() };
        if (data.ownerName !== undefined) userUpdates.name = data.ownerName;
        if (data.ownerPhone !== undefined) userUpdates.phone = data.ownerPhone;
        await db.update(users).set(userUpdates).where(eq(users.id, targetUserId));
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
   * Suspend company access
   */
  static async suspendCompany(
    companyId: string,
    reason: string,
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    if (!reason || !reason.trim()) {
      throw new Error("O motivo da suspensão é obrigatório para auditoria.");
    }

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) throw new Error("Empresa não encontrada.");

    const now = new Date();

    await db
      .update(companies)
      .set({
        publicEnabled: false,
        onboarded: false,
        updatedAt: now,
      })
      .where(eq(companies.id, companyId));

    await db
      .update(subscriptions)
      .set({
        status: "suspended",
        revokedByAdminId: adminUser.id,
        revokeReason: reason,
        updatedAt: now,
      })
      .where(eq(subscriptions.companyId, companyId));

    await logAdminAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: "SUSPEND_COMPANY",
      entity: "company",
      entityId: companyId,
      entityName: company.name,
      reason,
      afterState: { publicEnabled: false, onboarded: false, subscriptionStatus: "suspended" },
      request,
    });

    return { success: true, message: `Empresa '${company.name}' suspensa com sucesso.` };
  }

  /**
   * Reactivate company access
   */
  static async reactivateCompany(
    companyId: string,
    reason: string,
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) throw new Error("Empresa não encontrada.");

    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, companyId)).limit(1);

    const now = new Date();
    let restoredSubStatus = "active";
    if (sub) {
      if (sub.trialEndsAt && sub.trialEndsAt > now) {
        restoredSubStatus = "trialing";
      } else if (sub.currentPeriodEnd && sub.currentPeriodEnd > now) {
        restoredSubStatus = "active";
      } else {
        restoredSubStatus = "past_due";
      }
    }

    await db
      .update(companies)
      .set({
        publicEnabled: true,
        onboarded: true,
        updatedAt: now,
      })
      .where(eq(companies.id, companyId));

    if (sub && sub.status === "suspended") {
      await db
        .update(subscriptions)
        .set({
          status: restoredSubStatus,
          updatedAt: now,
        })
        .where(eq(subscriptions.companyId, companyId));
    }

    await logAdminAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: "REACTIVATE_COMPANY",
      entity: "company",
      entityId: companyId,
      entityName: company.name,
      reason: reason || "Reativação administrativa",
      afterState: { publicEnabled: true, onboarded: true, subscriptionStatus: restoredSubStatus },
      request,
    });

    return { success: true, message: `Empresa '${company.name}' reativada com sucesso.` };
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
        onboarded: false,
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
    } else {
      await db
        .update(users)
        .set({
          deletedAt: now,
          deletedBy: adminUser.id,
          active: false,
          updatedAt: now,
        })
        .where(and(eq(users.companyId, companyId), eq(users.role, "owner")));
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
   * Hard delete owner / company (Definitive removal with exact name confirmation)
   */
  static async hardDeleteOwner(
    companyId: string,
    confirmedName: string | undefined,
    reason: string,
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) throw new Error("Empresa não encontrada.");

    if (confirmedName && company.name.trim().toLowerCase() !== confirmedName.trim().toLowerCase()) {
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
   * Bulk delete owners / companies (Soft or Hard)
   */
  static async bulkDeleteOwners(
    companyIds: string[],
    mode: "soft" | "hard",
    reason: string,
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    if (!companyIds.length) return { success: true, deletedCount: 0, totalRequested: 0 };

    let deletedCount = 0;
    for (const id of companyIds) {
      try {
        if (mode === "hard") {
          await this.hardDeleteOwner(id, undefined, reason, adminUser, request);
        } else {
          await this.softDeleteOwner(id, reason, adminUser, request);
        }
        deletedCount++;
      } catch (err) {
        console.error(`[bulkDeleteOwners] Failed to delete company ${id}:`, err);
      }
    }

    return { success: true, deletedCount, totalRequested: companyIds.length };
  }

  /**
   * Bulk delete clients (Soft or Hard)
   */
  static async bulkDeleteClients(
    clientIds: string[],
    mode: "soft" | "hard",
    reason: string,
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    if (!clientIds.length) return { success: true, deletedCount: 0, totalRequested: 0 };

    let deletedCount = 0;
    for (const id of clientIds) {
      try {
        if (mode === "hard") {
          await this.hardDeleteClient(id, reason, adminUser, request);
        } else {
          await this.softDeleteClient(id, reason, adminUser, request);
        }
        deletedCount++;
      } catch (err) {
        console.error(`[bulkDeleteClients] Failed to delete client ${id}:`, err);
      }
    }

    return { success: true, deletedCount, totalRequested: clientIds.length };
  }

  /**
   * Bulk delete users (Soft or Hard)
   */
  static async bulkDeleteUsers(
    userIds: string[],
    mode: "soft" | "hard",
    reason: string,
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    if (!userIds.length) return { success: true, deletedCount: 0, totalRequested: 0 };

    let deletedCount = 0;
    for (const id of userIds) {
      try {
        await this.deleteUser(id, mode, reason, adminUser, request);
        deletedCount++;
      } catch (err) {
        console.error(`[bulkDeleteUsers] Failed to delete user ${id}:`, err);
      }
    }

    return { success: true, deletedCount, totalRequested: userIds.length };
  }

  /**
   * List subscriptions across the platform with company & owner details
   */
  static async listSubscriptions(
    params: {
      q?: string;
      search?: string;
      status?: string;
      plan?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (params.status && params.status !== "all") {
      conditions.push(eq(subscriptions.status, params.status));
    }
    if (params.plan && params.plan !== "all") {
      conditions.push(eq(subscriptions.plan, params.plan));
    }

    const queryTerm = (params.q || params.search || "").trim();
    if (queryTerm) {
      const q = `%${queryTerm}%`;
      conditions.push(
        or(
          like(companies.name, q),
          like(companies.email, q),
          like(subscriptions.plan, q),
          like(subscriptions.status, q)
        )
      );
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [countRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscriptions)
      .leftJoin(companies, eq(companies.id, subscriptions.companyId))
      .where(whereClause);

    const total = Number(countRes?.count ?? 0);

    const rows = await db
      .select({
        id: subscriptions.id,
        companyId: subscriptions.companyId,
        companyName: companies.name,
        companySlug: companies.publicSlug,
        plan: subscriptions.plan,
        status: subscriptions.status,
        billingInterval: subscriptions.billingInterval,
        amount: subscriptions.amount,
        origin: subscriptions.origin,
        paymentMethod: subscriptions.paymentMethod,
        trialStartedAt: subscriptions.trialStartedAt,
        trialEndsAt: subscriptions.trialEndsAt,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        nextPaymentAt: subscriptions.nextPaymentAt,
        grantReason: subscriptions.grantReason,
        createdAt: subscriptions.createdAt,
      })
      .from(subscriptions)
      .leftJoin(companies, eq(companies.id, subscriptions.companyId))
      .where(whereClause)
      .orderBy(desc(subscriptions.createdAt))
      .limit(limit)
      .offset(offset);

    // Resolve owner users
    const companyIds = rows.map((r) => r.companyId);
    const ownerMap = new Map<string, { name: string; email: string }>();

    if (companyIds.length > 0) {
      const [memberships, directUsers] = await Promise.all([
        db
          .select({
            companyId: companyMemberships.companyId,
            name: users.name,
            email: users.email,
          })
          .from(companyMemberships)
          .innerJoin(users, eq(users.id, companyMemberships.userId))
          .where(and(inArray(companyMemberships.companyId, companyIds), eq(companyMemberships.role, "owner"))),
        db
          .select({
            companyId: users.companyId,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(and(inArray(users.companyId, companyIds), eq(users.role, "owner"))),
      ]);

      for (const d of directUsers) {
        if (d.companyId) ownerMap.set(d.companyId, { name: d.name, email: d.email });
      }
      for (const m of memberships) {
        if (m.companyId) ownerMap.set(m.companyId, { name: m.name, email: m.email });
      }
    }

    const items = rows.map((r) => {
      const owner = ownerMap.get(r.companyId);
      return {
        ...r,
        ownerName: owner?.name ?? "—",
        ownerEmail: owner?.email ?? "—",
      };
    });

    return {
      data: items,
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
   * List global clients across the platform
   */
  static async listClients(
    params: {
      q?: string;
      search?: string;
      companyId?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (params.companyId) {
      conditions.push(eq(clients.companyId, params.companyId));
    }

    const queryTerm = (params.q || params.search || "").trim();
    if (queryTerm) {
      const q = `%${queryTerm}%`;
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

    const rawClients = await db
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

    // Batch enrich with appointments count and last appointment date
    const clientIds = rawClients.map((c) => c.id);
    let aptStatsMap = new Map<string, { totalBookings: number; lastBookingAt: Date | null }>();

    if (clientIds.length > 0) {
      const aptStats = await db
        .select({
          clientId: appointments.clientId,
          count: sql<number>`count(*)`,
          lastAppointment: sql<Date | null>`max(${appointments.appointmentDate})`,
        })
        .from(appointments)
        .where(inArray(appointments.clientId, clientIds))
        .groupBy(appointments.clientId);

      aptStatsMap = new Map(
        aptStats.map((a) => [
          a.clientId!,
          { totalBookings: Number(a.count), lastBookingAt: a.lastAppointment },
        ])
      );
    }

    const items = rawClients.map((c) => {
      const stats = aptStatsMap.get(c.id);
      return {
        ...c,
        totalBookings: stats?.totalBookings ?? 0,
        totalAppointments: stats?.totalBookings ?? 0,
        lastBookingAt: stats?.lastBookingAt ?? null,
        lastAppointment: stats?.lastBookingAt ?? null,
      };
    });

    return {
      data: items,
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
  static async softDeleteClient(
    clientId: string,
    reason: string,
    adminUser: { id: string; email: string },
    request?: Request
  ) {
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
  static async hardDeleteClient(
    clientId: string,
    reason: string,
    adminUser: { id: string; email: string },
    request?: Request
  ) {
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

    const [existingSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, companyId))
      .limit(1);

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

    // Record invoice receipt
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

  /**
   * Update subscription details directly (plan, status, interval, amount, origin, dates)
   */
  static async updateSubscription(
    subscriptionId: string,
    data: {
      plan?: string;
      status?: string;
      billingInterval?: "monthly" | "yearly";
      amount?: string | number;
      origin?: "checkout" | "manual_courtesy" | "manual_paid";
      paymentMethod?: string;
      nextPaymentAt?: string | Date | null;
      trialEndsAt?: string | Date | null;
      currentPeriodEnd?: string | Date | null;
      reason: string;
    },
    adminUser: { id: string; email: string },
    request?: Request
  ) {
    const { reason } = data;
    if (!reason || !reason.trim()) {
      throw new Error("Justificativa para auditoria é obrigatória.");
    }

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);

    if (!sub) {
      throw new Error("Assinatura não encontrada.");
    }

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, sub.companyId))
      .limit(1);

    const beforeState = { ...sub };
    const now = new Date();
    const updatePayload: Record<string, any> = {
      updatedAt: now,
    };

    // Plan update
    if (data.plan && data.plan !== sub.plan) {
      updatePayload.plan = data.plan;
      if (data.plan !== "trial") {
        const [planRow] = await db
          .select()
          .from(saasPlans)
          .where(eq(saasPlans.slug, data.plan))
          .limit(1);
        updatePayload.planId = planRow?.id ?? null;
      } else {
        updatePayload.planId = null;
      }
    }

    // Status update
    if (data.status && data.status !== sub.status) {
      updatePayload.status = data.status;
      if (data.status === "cancelled") {
        updatePayload.cancelledAt = now;
      } else if (sub.status === "cancelled") {
        updatePayload.cancelledAt = null;
      }
    }

    // Billing interval update
    if (data.billingInterval && (data.billingInterval === "monthly" || data.billingInterval === "yearly")) {
      updatePayload.billingInterval = data.billingInterval;
    }

    // Amount update
    if (data.amount !== undefined && data.amount !== null) {
      const num = Number(data.amount);
      if (!isNaN(num) && num >= 0) {
        updatePayload.amount = num.toFixed(2);
      }
    }

    // Origin update
    if (data.origin) {
      updatePayload.origin = data.origin;
    }

    // Payment method update
    if (data.paymentMethod) {
      updatePayload.paymentMethod = data.paymentMethod;
    }

    // Next payment / period dates update
    if (data.nextPaymentAt !== undefined) {
      updatePayload.nextPaymentAt = data.nextPaymentAt ? new Date(data.nextPaymentAt) : null;
    }
    if (data.trialEndsAt !== undefined) {
      updatePayload.trialEndsAt = data.trialEndsAt ? new Date(data.trialEndsAt) : sub.trialEndsAt;
    }
    if (data.currentPeriodEnd !== undefined) {
      updatePayload.currentPeriodEnd = data.currentPeriodEnd ? new Date(data.currentPeriodEnd) : null;
    }

    await db
      .update(subscriptions)
      .set(updatePayload)
      .where(eq(subscriptions.id, subscriptionId));

    const [afterSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);

    await logAdminAction({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: "UPDATE_SUBSCRIPTION",
      entity: "subscription",
      entityId: subscriptionId,
      entityName: `${company?.name || "Empresa"} (${sub.plan} -> ${data.plan || sub.plan})`,
      reason,
      beforeState,
      afterState: afterSub,
      request,
    });

    return {
      success: true,
      subscription: afterSub,
    };
  }

  /**
   * System overview metrics with period filtering and revenue segregation
   */
  static async getSystemOverviewMetrics(params: {
    period?: "today" | "7d" | "30d" | "all" | "custom";
    startDate?: string | null;
    endDate?: string | null;
  }) {
    const period = params.period || "30d";
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = now;

    if (period === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (period === "7d") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "30d") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === "custom" && params.startDate) {
      startDate = new Date(params.startDate);
      if (params.endDate) {
        endDate = new Date(params.endDate);
        endDate.setHours(23, 59, 59, 999);
      }
    } else if (period === "all") {
      startDate = null;
    }

    // 1. Ecosystem Entities counts
    const [
      [totalCompaniesRes],
      [activeCompaniesRes],
      [periodCompaniesRes],
      [totalOwnersRes],
      [activeEmployeesRes],
      [totalClientsRes],
      [totalAppointmentsRes],
      [periodAppointmentsRes],
    ] = await Promise.all([
      db.select({ count: count() }).from(companies),
      db
        .select({ count: count() })
        .from(companies)
        .where(and(isNull(companies.deletedAt), eq(companies.publicEnabled, true), eq(companies.onboarded, true))),
      startDate
        ? db
            .select({ count: count() })
            .from(companies)
            .where(and(gte(companies.createdAt, startDate), endDate ? lte(companies.createdAt, endDate) : undefined))
        : db.select({ count: count() }).from(companies),
      db.select({ count: count() }).from(users).where(eq(users.role, "owner")),
      db.select({ count: count() }).from(employees).where(and(isNull(employees.deletedAt), eq(employees.active, true))),
      db.select({ count: count() }).from(clients).where(isNull(clients.deletedAt)),
      db.select({ count: count() }).from(appointments),
      startDate
        ? db
            .select({ count: count() })
            .from(appointments)
            .where(and(gte(appointments.createdAt, startDate), endDate ? lte(appointments.createdAt, endDate) : undefined))
        : db.select({ count: count() }).from(appointments),
    ]);

    // 2. Subscriptions & SaaS breakdown
    const allSubs = await db
      .select({
        status: subscriptions.status,
        billingInterval: subscriptions.billingInterval,
        amount: subscriptions.amount,
        finalPriceSnapshot: subscriptions.finalPriceSnapshot,
        trialEndsAt: subscriptions.trialEndsAt,
      })
      .from(subscriptions);

    let mrr = 0;
    let activeSubscribers = 0;
    let trialingCount = 0;
    let expiredTrialsCount = 0;
    let pendingSubsCount = 0;
    let cancelledSubsCount = 0;

    for (const sub of allSubs) {
      if (sub.status === "active") {
        activeSubscribers++;
        const price = Number(sub.finalPriceSnapshot || sub.amount || 0);
        if (sub.billingInterval === "yearly") {
          mrr += price / 12;
        } else {
          mrr += price;
        }
      } else if (sub.status === "trialing") {
        if (sub.trialEndsAt && sub.trialEndsAt < now) {
          expiredTrialsCount++;
        } else {
          trialingCount++;
        }
      } else if (sub.status === "expired") {
        expiredTrialsCount++;
      } else if (sub.status === "pending" || sub.status === "past_due") {
        pendingSubsCount++;
      } else if (sub.status === "cancelled") {
        cancelledSubsCount++;
      }
    }

    const churnedCount = cancelledSubsCount + expiredTrialsCount;
    const churnRate =
      activeSubscribers + churnedCount > 0
        ? Number(((churnedCount / (activeSubscribers + churnedCount)) * 100).toFixed(1))
        : 0;

    // 3. Platform SaaS Revenue
    const saasRevenueConditions = [eq(subscriptionInvoices.status, "paid")];
    if (startDate) {
      saasRevenueConditions.push(gte(subscriptionInvoices.createdAt, startDate));
      if (endDate) saasRevenueConditions.push(lte(subscriptionInvoices.createdAt, endDate));
    }
    const [saasRevRes] = await db
      .select({ total: sql<string>`coalesce(sum(${subscriptionInvoices.amount}), 0)` })
      .from(subscriptionInvoices)
      .where(and(...saasRevenueConditions));

    const platformRevenue = Number(saasRevRes?.total ?? 0);

    // 4. Businesses Service Revenue
    const bookingRevenueConditions = [
      or(eq(payments.status, "confirmed"), eq(payments.status, "approved")),
    ];
    if (startDate) {
      bookingRevenueConditions.push(gte(payments.createdAt, startDate));
      if (endDate) bookingRevenueConditions.push(lte(payments.createdAt, endDate));
    }
    const [bookingRevRes] = await db
      .select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(and(...bookingRevenueConditions));

    const establishmentsRevenue = Number(bookingRevRes?.total ?? 0);

    // 5. Pending & failures
    const [pendingInvoicesRes, pendingPaymentsRes, failedInvoicesRes, failedPaymentsRes] = await Promise.all([
      db.select({ count: count() }).from(subscriptionInvoices).where(eq(subscriptionInvoices.status, "pending")),
      db.select({ count: count() }).from(payments).where(eq(payments.status, "pending")),
      db.select({ count: count() }).from(subscriptionInvoices).where(eq(subscriptionInvoices.status, "failed")),
      db.select({ count: count() }).from(payments).where(or(eq(payments.status, "rejected"), eq(payments.status, "cancelled"))),
    ]);

    const totalPendingPayments = Number(pendingInvoicesRes[0]?.count ?? 0) + Number(pendingPaymentsRes[0]?.count ?? 0);
    const totalPaymentFailures = Number(failedInvoicesRes[0]?.count ?? 0) + Number(failedPaymentsRes[0]?.count ?? 0);

    // 6. Top Coupons
    const topCoupons = await db
      .select({
        couponId: saasCoupons.id,
        code: saasCoupons.code,
        name: saasCoupons.name,
        influencerName: saasCoupons.influencerName,
        totalUses: count(saasCouponRedemptions.id),
        convertedUses: sql<number>`sum(case when ${saasCouponRedemptions.isConverted} = true or ${saasCouponRedemptions.status} = 'confirmed' then 1 else 0 end)`,
      })
      .from(saasCoupons)
      .leftJoin(saasCouponRedemptions, eq(saasCoupons.id, saasCouponRedemptions.couponId))
      .groupBy(saasCoupons.id, saasCoupons.code, saasCoupons.name, saasCoupons.influencerName)
      .orderBy(desc(count(saasCouponRedemptions.id)))
      .limit(5);

    // 7. Recent Audit
    const recentAudit = await db
      .select({
        id: adminAuditLogs.id,
        action: adminAuditLogs.action,
        entity: adminAuditLogs.entity,
        entityName: adminAuditLogs.entityName,
        adminEmail: adminAuditLogs.adminEmail,
        createdAt: adminAuditLogs.createdAt,
      })
      .from(adminAuditLogs)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(6);

    return {
      period,
      filterPeriod: period,
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
      companies: {
        total: Number(totalCompaniesRes?.count ?? 0),
        active: Number(activeCompaniesRes?.count ?? 0),
        newInPeriod: Number(periodCompaniesRes?.count ?? 0),
      },
      revenue: {
        totalPlatformRevenue: Number(platformRevenue.toFixed(2)),
        totalEstablishmentsGrossRevenue: Number(establishmentsRevenue.toFixed(2)),
        mrr: Number(mrr.toFixed(2)),
      },
      subscriptions: {
        active: activeSubscribers,
        trialing: trialingCount,
        expiredTrials: expiredTrialsCount,
        pending: pendingSubsCount,
        cancelled: cancelledSubsCount,
        churned: churnedCount,
        churnRate,
      },
      totalCompanies: Number(totalCompaniesRes?.count ?? 0),
      activeCompanies: Number(activeCompaniesRes?.count ?? 0),
      newCompaniesInPeriod: Number(periodCompaniesRes?.count ?? 0),
      totalOwners: Number(totalOwnersRes?.count ?? 0),
      activeEmployees: Number(activeEmployeesRes?.count ?? 0),
      totalClients: Number(totalClientsRes?.count ?? 0),
      totalAppointments: Number(totalAppointmentsRes?.count ?? 0),
      newAppointmentsInPeriod: Number(periodAppointmentsRes?.count ?? 0),
      activeSubscribers,
      trialingCount,
      expiredTrialsCount,
      pendingSubsCount,
      cancelledSubsCount,
      churnedCount,
      churnRate,
      mrr: Number(mrr.toFixed(2)),
      platformRevenue: Number(platformRevenue.toFixed(2)),
      establishmentsRevenue: Number(establishmentsRevenue.toFixed(2)),
      totalPendingPayments,
      totalPaymentFailures,
      topCoupons: topCoupons.map((c) => ({
        ...c,
        convertedUses: Number(c.convertedUses || 0),
        conversionRate:
          Number(c.totalUses) > 0
            ? Number(((Number(c.convertedUses || 0) / Number(c.totalUses)) * 100).toFixed(1))
            : 0,
      })),
      recentAudit,
    };
  }
}
