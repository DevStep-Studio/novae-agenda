import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appointmentHistory,
  appointmentServices,
  appointments,
  bookingMembershipUsage,
  clients,
  companies,
  customerMembershipPayments,
  customerMemberships,
  employees,
  employeeServices,
  membershipPeriods,
  membershipPlanEmployees,
  membershipPlanServices,
  membershipPlans,
  notifications,
  services,
  users,
} from "@/db/schema";
import type { DbExecutor } from "@/lib/availability";
import { loadAvailability, type AvailableSlot } from "@/lib/booking/engine";
import { BookingError } from "@/lib/booking/errors";
import {
  calculatePeriodAllowance,
  formatDaySlotMeta,
  getMonthDateRange,
  getWeekdayDatesInMonth,
} from "./calendar-engine";
import type {
  BatchBookingConflict,
  BatchBookingResultDTO,
  CustomerMembershipDTO,
  MembershipFrequencyType,
  MembershipPeriodDTO,
  MembershipPlanDTO,
  MonthScheduleBatchInput,
  MonthSlotDay,
} from "@/shared/types";
import { centsToNumber, isUuid, normalizeTime, timeToMinutes } from "@/lib/domain";

// ========================================================
// 1. MEMBERSHIP PLANS CRUD (OWNER)
// ========================================================

export async function createMembershipPlan(
  companyId: string,
  input: {
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    price: number;
    billingPeriod?: string;
    frequencyType: MembershipFrequencyType;
    sessionsPerPeriod?: number;
    weeklyFrequency?: number;
    allowReschedule?: boolean;
    rescheduleHoursNotice?: number;
    allowCarryOver?: boolean;
    noShowConsumesSession?: boolean;
    lateCancelConsumesSession?: boolean;
    badgeColor?: string | null;
    serviceIds: string[];
    employeeIds?: string[];
  },
) {
  return db.transaction(async (tx) => {
    const planId = crypto.randomUUID();

    await tx.insert(membershipPlans).values({
      id: planId,
      companyId,
      name: input.name,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      price: input.price.toFixed(2),
      billingPeriod: input.billingPeriod ?? "monthly",
      frequencyType: input.frequencyType,
      sessionsPerPeriod: input.sessionsPerPeriod ?? 4,
      weeklyFrequency: input.weeklyFrequency ?? 1,
      allowReschedule: input.allowReschedule ?? true,
      rescheduleHoursNotice: input.rescheduleHoursNotice ?? 2,
      allowCarryOver: input.allowCarryOver ?? false,
      noShowConsumesSession: input.noShowConsumesSession ?? true,
      lateCancelConsumesSession: input.lateCancelConsumesSession ?? true,
      badgeColor: input.badgeColor ?? "#3b82f6",
      active: true,
    });

    if (input.serviceIds && input.serviceIds.length > 0) {
      for (const serviceId of input.serviceIds) {
        await tx.insert(membershipPlanServices).values({
          membershipPlanId: planId,
          serviceId,
        });
      }
    }

    if (input.employeeIds && input.employeeIds.length > 0) {
      for (const employeeId of input.employeeIds) {
        await tx.insert(membershipPlanEmployees).values({
          membershipPlanId: planId,
          employeeId,
        });
      }
    }

    return getMembershipPlan(companyId, planId, tx);
  });
}

export async function updateMembershipPlan(
  companyId: string,
  planId: string,
  input: Partial<{
    name: string;
    description: string | null;
    imageUrl: string | null;
    price: number;
    frequencyType: MembershipFrequencyType;
    sessionsPerPeriod: number;
    weeklyFrequency: number;
    allowReschedule: boolean;
    rescheduleHoursNotice: number;
    allowCarryOver: boolean;
    noShowConsumesSession: boolean;
    lateCancelConsumesSession: boolean;
    badgeColor: string | null;
    active: boolean;
    serviceIds: string[];
    employeeIds: string[];
  }>,
) {
  return db.transaction(async (tx) => {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.imageUrl !== undefined) updateData.imageUrl = input.imageUrl;
    if (input.price !== undefined) updateData.price = input.price.toFixed(2);
    if (input.frequencyType !== undefined) updateData.frequencyType = input.frequencyType;
    if (input.sessionsPerPeriod !== undefined) updateData.sessionsPerPeriod = input.sessionsPerPeriod;
    if (input.weeklyFrequency !== undefined) updateData.weeklyFrequency = input.weeklyFrequency;
    if (input.allowReschedule !== undefined) updateData.allowReschedule = input.allowReschedule;
    if (input.rescheduleHoursNotice !== undefined) updateData.rescheduleHoursNotice = input.rescheduleHoursNotice;
    if (input.allowCarryOver !== undefined) updateData.allowCarryOver = input.allowCarryOver;
    if (input.noShowConsumesSession !== undefined) updateData.noShowConsumesSession = input.noShowConsumesSession;
    if (input.lateCancelConsumesSession !== undefined) updateData.lateCancelConsumesSession = input.lateCancelConsumesSession;
    if (input.badgeColor !== undefined) updateData.badgeColor = input.badgeColor;
    if (input.active !== undefined) updateData.active = input.active;

    await tx
      .update(membershipPlans)
      .set(updateData)
      .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.companyId, companyId)));

    if (input.serviceIds !== undefined) {
      await tx.delete(membershipPlanServices).where(eq(membershipPlanServices.membershipPlanId, planId));
      for (const serviceId of input.serviceIds) {
        await tx.insert(membershipPlanServices).values({
          membershipPlanId: planId,
          serviceId,
        });
      }
    }

    if (input.employeeIds !== undefined) {
      await tx.delete(membershipPlanEmployees).where(eq(membershipPlanEmployees.membershipPlanId, planId));
      for (const employeeId of input.employeeIds) {
        await tx.insert(membershipPlanEmployees).values({
          membershipPlanId: planId,
          employeeId,
        });
      }
    }

    return getMembershipPlan(companyId, planId, tx);
  });
}

export async function getMembershipPlan(
  companyId: string,
  planId: string,
  executor: DbExecutor = db,
): Promise<MembershipPlanDTO | null> {
  const [plan] = await executor
    .select()
    .from(membershipPlans)
    .where(and(eq(membershipPlans.id, planId), eq(membershipPlans.companyId, companyId)));

  if (!plan) return null;

  const planServices = await executor
    .select({
      id: services.id,
      name: services.name,
      price: services.price,
      durationMinutes: services.durationMinutes,
    })
    .from(membershipPlanServices)
    .innerJoin(services, eq(membershipPlanServices.serviceId, services.id))
    .where(eq(membershipPlanServices.membershipPlanId, planId));

  const planEmployees = await executor
    .select({
      id: employees.id,
      name: employees.name,
    })
    .from(membershipPlanEmployees)
    .innerJoin(employees, eq(membershipPlanEmployees.employeeId, employees.id))
    .where(eq(membershipPlanEmployees.membershipPlanId, planId));

  const [activeCountRow] = await executor
    .select({ count: sql<number>`count(*)` })
    .from(customerMemberships)
    .where(
      and(
        eq(customerMemberships.membershipPlanId, planId),
        eq(customerMemberships.companyId, companyId),
        eq(customerMemberships.status, "active"),
      ),
    );

  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    imageUrl: plan.imageUrl,
    price: centsToNumber(plan.price),
    billingPeriod: plan.billingPeriod,
    frequencyType: plan.frequencyType as MembershipFrequencyType,
    sessionsPerPeriod: plan.sessionsPerPeriod,
    weeklyFrequency: plan.weeklyFrequency,
    allowReschedule: plan.allowReschedule,
    rescheduleHoursNotice: plan.rescheduleHoursNotice,
    allowCarryOver: plan.allowCarryOver,
    noShowConsumesSession: plan.noShowConsumesSession,
    lateCancelConsumesSession: plan.lateCancelConsumesSession,
    badgeColor: plan.badgeColor,
    active: plan.active,
    serviceIds: planServices.map((s) => s.id),
    services: planServices.map((s) => ({
      id: s.id,
      name: s.name,
      price: centsToNumber(s.price),
      durationMinutes: s.durationMinutes,
    })),
    employeeIds: planEmployees.map((e) => e.id),
    employees: planEmployees,
    activeMembersCount: Number(activeCountRow?.count ?? 0),
  };
}

export async function listMembershipPlans(
  companyId: string,
  includeInactive = false,
): Promise<MembershipPlanDTO[]> {
  const conditions = [eq(membershipPlans.companyId, companyId)];
  if (!includeInactive) {
    conditions.push(eq(membershipPlans.active, true));
  }

  const plans = await db
    .select()
    .from(membershipPlans)
    .where(and(...conditions))
    .orderBy(desc(membershipPlans.createdAt));

  if (plans.length === 0) return [];

  const planIds = plans.map((p) => p.id);

  const planServices = await db
    .select({
      planId: membershipPlanServices.membershipPlanId,
      id: services.id,
      name: services.name,
      price: services.price,
      durationMinutes: services.durationMinutes,
    })
    .from(membershipPlanServices)
    .innerJoin(services, eq(membershipPlanServices.serviceId, services.id))
    .where(inArray(membershipPlanServices.membershipPlanId, planIds));

  const planEmployees = await db
    .select({
      planId: membershipPlanEmployees.membershipPlanId,
      id: employees.id,
      name: employees.name,
    })
    .from(membershipPlanEmployees)
    .innerJoin(employees, eq(membershipPlanEmployees.employeeId, employees.id))
    .where(inArray(membershipPlanEmployees.membershipPlanId, planIds));

  const activeMembersCounts = await db
    .select({
      planId: customerMemberships.membershipPlanId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(customerMemberships)
    .where(
      and(
        eq(customerMemberships.companyId, companyId),
        eq(customerMemberships.status, "active"),
      ),
    )
    .groupBy(customerMemberships.membershipPlanId);

  const countMap = new Map<string, number>();
  for (const c of activeMembersCounts) {
    countMap.set(c.planId, Number(c.count));
  }

  return plans.map((plan) => {
    const svcs = planServices.filter((s) => s.planId === plan.id);
    const emps = planEmployees.filter((e) => e.planId === plan.id);

    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      imageUrl: plan.imageUrl,
      price: centsToNumber(plan.price),
      billingPeriod: plan.billingPeriod,
      frequencyType: plan.frequencyType as MembershipFrequencyType,
      sessionsPerPeriod: plan.sessionsPerPeriod,
      weeklyFrequency: plan.weeklyFrequency,
      allowReschedule: plan.allowReschedule,
      rescheduleHoursNotice: plan.rescheduleHoursNotice,
      allowCarryOver: plan.allowCarryOver,
      noShowConsumesSession: plan.noShowConsumesSession,
      lateCancelConsumesSession: plan.lateCancelConsumesSession,
      badgeColor: plan.badgeColor,
      active: plan.active,
      serviceIds: svcs.map((s) => s.id),
      services: svcs.map((s) => ({
        id: s.id,
        name: s.name,
        price: centsToNumber(s.price),
        durationMinutes: s.durationMinutes,
      })),
      employeeIds: emps.map((e) => e.id),
      employees: emps.map((e) => ({ id: e.id, name: e.name })),
      activeMembersCount: countMap.get(plan.id) ?? 0,
    };
  });
}

// ========================================================
// 2. CUSTOMER MEMBERSHIPS (ADESÃO E GESTÃO)
// ========================================================

export async function assignCustomerMembership(
  companyId: string,
  input: {
    clientId: string;
    membershipPlanId: string;
    preferredProfessionalId?: string | null;
    preferredWeekdays?: number[];
    preferredTime?: string | null;
    notes?: string | null;
    startsAt?: Date;
    initialPaymentMethod?: string | null;
    initialPaymentRecorded?: boolean;
  },
) {
  return db.transaction(async (tx) => {
    const plan = await getMembershipPlan(companyId, input.membershipPlanId, tx);
    if (!plan) throw new BookingError("Plano mensal não encontrado.", 404);

    // Cancel or pause any previous active membership for this client
    await tx
      .update(customerMemberships)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(customerMemberships.companyId, companyId),
          eq(customerMemberships.clientId, input.clientId),
          eq(customerMemberships.status, "active"),
        ),
      );

    const membershipId = crypto.randomUUID();
    const startsAt = input.startsAt ?? new Date();

    await tx.insert(customerMemberships).values({
      id: membershipId,
      companyId,
      clientId: input.clientId,
      membershipPlanId: plan.id,
      startsAt,
      status: "active",
      preferredProfessionalId: input.preferredProfessionalId ?? null,
      preferredWeekdays: input.preferredWeekdays ?? [4], // Default to Thursday if none
      preferredTime: input.preferredTime ?? null,
      monthlyPriceSnapshot: plan.price.toFixed(2),
      notes: input.notes ?? null,
    });

    // Create current period automatically
    const period = await createMembershipPeriodForDate(
      companyId,
      membershipId,
      plan,
      startsAt,
      input.preferredWeekdays ?? [4],
      tx,
    );

    if (input.initialPaymentRecorded && input.initialPaymentMethod) {
      await recordMembershipPeriodPayment(
        companyId,
        membershipId,
        period.id,
        {
          method: input.initialPaymentMethod,
          amount: plan.price,
          notes: "Pagamento inicial da mensalidade",
        },
        tx,
      );
    }

    // In-app notification
    const [client] = await tx
      .select({ name: clients.name })
      .from(clients)
      .where(eq(clients.id, input.clientId));

    await tx.insert(notifications).values({
      companyId,
      type: "membership.assigned",
      title: "Novo cliente mensalista",
      body: `${client?.name ?? "Cliente"} agora é mensalista do plano ${plan.name}.`,
      entityType: "membership",
      entityId: membershipId,
    });

    return getCustomerMembershipDetails(companyId, membershipId, tx);
  });
}

export async function createMembershipPeriodForDate(
  companyId: string,
  customerMembershipId: string,
  plan: MembershipPlanDTO,
  targetDate: Date,
  preferredWeekdays: number[],
  tx: DbExecutor = db,
) {
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1; // 1-12
  const { periodStart, periodEnd } = getMonthDateRange(year, month);

  const { allowance } = calculatePeriodAllowance(
    plan.frequencyType,
    year,
    month,
    preferredWeekdays,
    plan.sessionsPerPeriod,
    plan.weeklyFrequency,
  );

  const periodId = crypto.randomUUID();

  await tx.insert(membershipPeriods).values({
    id: periodId,
    companyId,
    customerMembershipId,
    periodStart,
    periodEnd,
    sessionAllowance: allowance,
    sessionsBooked: 0,
    sessionsUsed: 0,
    paymentStatus: "pending",
    amount: plan.price.toFixed(2),
    status: "active",
  });

  return {
    id: periodId,
    periodStart,
    periodEnd,
    sessionAllowance: allowance,
    sessionsBooked: 0,
    sessionsUsed: 0,
    paymentStatus: "pending" as const,
    amount: plan.price,
    status: "active" as const,
  };
}

export async function getCustomerMembershipDetails(
  companyId: string,
  membershipId: string,
  executor: DbExecutor = db,
  targetDate?: Date,
): Promise<CustomerMembershipDTO | null> {
  const [membership] = await executor
    .select({
      id: customerMemberships.id,
      companyId: customerMemberships.companyId,
      clientId: customerMemberships.clientId,
      clientName: clients.name,
      clientPhone: clients.phone,
      clientPhotoUrl: clients.photoUrl,
      membershipPlanId: customerMemberships.membershipPlanId,
      membershipPlanName: membershipPlans.name,
      membershipPlanDescription: membershipPlans.description,
      frequencyType: membershipPlans.frequencyType,
      startsAt: customerMemberships.startsAt,
      endsAt: customerMemberships.endsAt,
      status: customerMemberships.status,
      preferredProfessionalId: customerMemberships.preferredProfessionalId,
      preferredProfessionalName: employees.name,
      preferredWeekdays: customerMemberships.preferredWeekdays,
      preferredTime: customerMemberships.preferredTime,
      monthlyPriceSnapshot: customerMemberships.monthlyPriceSnapshot,
      notes: customerMemberships.notes,
      createdAt: customerMemberships.createdAt,
    })
    .from(customerMemberships)
    .innerJoin(membershipPlans, eq(customerMemberships.membershipPlanId, membershipPlans.id))
    .innerJoin(clients, eq(customerMemberships.clientId, clients.id))
    .leftJoin(employees, eq(customerMemberships.preferredProfessionalId, employees.id))
    .where(and(eq(customerMemberships.id, membershipId), eq(customerMemberships.companyId, companyId)));

  if (!membership) return null;

  let periodDate = targetDate;
  if (!periodDate) {
    const [latestPeriod] = await executor
      .select({ periodStart: membershipPeriods.periodStart })
      .from(membershipPeriods)
      .where(
        and(
          eq(membershipPeriods.customerMembershipId, membershipId),
          eq(membershipPeriods.companyId, companyId),
        ),
      )
      .orderBy(desc(membershipPeriods.periodStart))
      .limit(1);

    if (latestPeriod) {
      const [py, pm, pd] = latestPeriod.periodStart.split("-").map(Number);
      periodDate = new Date(py, pm - 1, pd, 12, 0, 0);
    } else {
      periodDate = membership.startsAt ? new Date(membership.startsAt) : new Date();
    }
  }

  const currentPeriod = await getOrCreateCurrentPeriod(
    companyId,
    membershipId,
    periodDate,
    executor,
  );

  const planServices = await executor
    .select({
      id: services.id,
      name: services.name,
      price: services.price,
      durationMinutes: services.durationMinutes,
    })
    .from(membershipPlanServices)
    .innerJoin(services, eq(membershipPlanServices.serviceId, services.id))
    .where(eq(membershipPlanServices.membershipPlanId, membership.membershipPlanId));

  return {
    id: membership.id,
    companyId: membership.companyId,
    clientId: membership.clientId,
    clientName: membership.clientName,
    clientPhone: membership.clientPhone,
    clientPhotoUrl: membership.clientPhotoUrl,
    membershipPlanId: membership.membershipPlanId,
    membershipPlanName: membership.membershipPlanName,
    membershipPlanDescription: membership.membershipPlanDescription,
    frequencyType: membership.frequencyType as MembershipFrequencyType,
    startsAt: membership.startsAt.toISOString(),
    endsAt: membership.endsAt ? membership.endsAt.toISOString() : null,
    status: membership.status as CustomerMembershipDTO["status"],
    preferredProfessionalId: membership.preferredProfessionalId,
    preferredProfessionalName: membership.preferredProfessionalName,
    preferredWeekdays: membership.preferredWeekdays ?? [],
    preferredTime: membership.preferredTime ? normalizeTime(membership.preferredTime) : null,
    monthlyPriceSnapshot: centsToNumber(membership.monthlyPriceSnapshot),
    notes: membership.notes,
    createdAt: membership.createdAt.toISOString(),
    currentPeriod,
    includedServices: planServices.map((s) => ({
      id: s.id,
      name: s.name,
      price: centsToNumber(s.price),
      durationMinutes: s.durationMinutes,
    })),
  };
}

export async function listCustomerMemberships(
  companyId: string,
  filters?: { clientId?: string; status?: string },
): Promise<CustomerMembershipDTO[]> {
  const conditions = [eq(customerMemberships.companyId, companyId)];
  if (filters?.clientId) {
    conditions.push(eq(customerMemberships.clientId, filters.clientId));
  }
  if (filters?.status) {
    conditions.push(eq(customerMemberships.status, filters.status));
  }

  const rows = await db
    .select({
      id: customerMemberships.id,
      companyId: customerMemberships.companyId,
      clientId: customerMemberships.clientId,
      clientName: clients.name,
      clientPhone: clients.phone,
      clientPhotoUrl: clients.photoUrl,
      membershipPlanId: customerMemberships.membershipPlanId,
      membershipPlanName: membershipPlans.name,
      membershipPlanDescription: membershipPlans.description,
      frequencyType: membershipPlans.frequencyType,
      startsAt: customerMemberships.startsAt,
      endsAt: customerMemberships.endsAt,
      status: customerMemberships.status,
      preferredProfessionalId: customerMemberships.preferredProfessionalId,
      preferredProfessionalName: employees.name,
      preferredWeekdays: customerMemberships.preferredWeekdays,
      preferredTime: customerMemberships.preferredTime,
      monthlyPriceSnapshot: customerMemberships.monthlyPriceSnapshot,
      notes: customerMemberships.notes,
      createdAt: customerMemberships.createdAt,
    })
    .from(customerMemberships)
    .innerJoin(membershipPlans, eq(customerMemberships.membershipPlanId, membershipPlans.id))
    .innerJoin(clients, eq(customerMemberships.clientId, clients.id))
    .leftJoin(employees, eq(customerMemberships.preferredProfessionalId, employees.id))
    .where(and(...conditions))
    .orderBy(desc(customerMemberships.createdAt));

  const result: CustomerMembershipDTO[] = [];
  for (const row of rows) {
    const details = await getCustomerMembershipDetails(companyId, row.id);
    if (details) {
      result.push(details);
    }
  }

  return result;
}

export async function getCustomerActiveMembership(
  companyId: string,
  clientId: string,
  targetDate?: Date,
): Promise<CustomerMembershipDTO | null> {
  const [active] = await db
    .select({ id: customerMemberships.id })
    .from(customerMemberships)
    .where(
      and(
        eq(customerMemberships.companyId, companyId),
        eq(customerMemberships.clientId, clientId),
        eq(customerMemberships.status, "active"),
      ),
    )
    .limit(1);

  if (!active) return null;
  return getCustomerMembershipDetails(companyId, active.id, db, targetDate);
}

// ========================================================
// 3. PERIODS & PAYMENTS
// ========================================================

export async function getOrCreateCurrentPeriod(
  companyId: string,
  customerMembershipId: string,
  targetDate = new Date(),
  executor: DbExecutor = db,
): Promise<MembershipPeriodDTO> {
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;
  const { periodStart, periodEnd } = getMonthDateRange(year, month);

  const [existing] = await executor
    .select()
    .from(membershipPeriods)
    .where(
      and(
        eq(membershipPeriods.customerMembershipId, customerMembershipId),
        eq(membershipPeriods.companyId, companyId),
        eq(membershipPeriods.periodStart, periodStart),
      ),
    );

  if (existing) {
    // Count current active usages
    const usages = await executor
      .select({
        appointmentId: bookingMembershipUsage.appointmentId,
        date: appointments.appointmentDate,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        status: appointments.status,
        serviceName: services.name,
        employeeName: employees.name,
      })
      .from(bookingMembershipUsage)
      .innerJoin(appointments, eq(bookingMembershipUsage.appointmentId, appointments.id))
      .leftJoin(services, eq(bookingMembershipUsage.serviceId, services.id))
      .leftJoin(employees, eq(appointments.employeeId, employees.id))
      .where(
        and(
          eq(bookingMembershipUsage.membershipPeriodId, existing.id),
          eq(bookingMembershipUsage.companyId, companyId),
          inArray(appointments.status, ["scheduled", "confirmed", "completed", "in_progress"]),
        ),
      )
      .orderBy(asc(appointments.appointmentDate), asc(appointments.startTime));

    const bookedCount = usages.length;
    const usedCount = usages.filter((u) => u.status === "completed").length;

    // Sync counts if changed
    if (existing.sessionsBooked !== bookedCount || existing.sessionsUsed !== usedCount) {
      await executor
        .update(membershipPeriods)
        .set({ sessionsBooked: bookedCount, sessionsUsed: usedCount })
        .where(eq(membershipPeriods.id, existing.id));
    }

    return {
      id: existing.id,
      customerMembershipId: existing.customerMembershipId,
      periodStart: existing.periodStart,
      periodEnd: existing.periodEnd,
      sessionAllowance: existing.sessionAllowance,
      sessionsBooked: bookedCount,
      sessionsUsed: usedCount,
      sessionsRemaining: Math.max(0, existing.sessionAllowance - bookedCount),
      paymentStatus: existing.paymentStatus as MembershipPeriodDTO["paymentStatus"],
      paidAt: existing.paidAt ? existing.paidAt.toISOString() : null,
      paymentMethod: existing.paymentMethod,
      amount: centsToNumber(existing.amount),
      status: existing.status as MembershipPeriodDTO["status"],
      bookings: usages.map((u) => ({
        appointmentId: u.appointmentId,
        date: u.date,
        startTime: normalizeTime(u.startTime),
        endTime: normalizeTime(u.endTime),
        serviceName: u.serviceName ?? "Serviço incluído",
        employeeName: u.employeeName ?? "Profissional",
        status: u.status as any,
      })),
    };
  }

  // If not found, load membership and plan to compute allowance
  const [membership] = await executor
    .select()
    .from(customerMemberships)
    .where(and(eq(customerMemberships.id, customerMembershipId), eq(customerMemberships.companyId, companyId)));

  if (!membership) throw new BookingError("Assinatura não encontrada.", 404);

  const plan = await getMembershipPlan(companyId, membership.membershipPlanId, executor);
  if (!plan) throw new BookingError("Plano não encontrado.", 404);

  const created = await createMembershipPeriodForDate(
    companyId,
    customerMembershipId,
    plan,
    targetDate,
    membership.preferredWeekdays ?? [4],
    executor,
  );

  return {
    ...created,
    customerMembershipId,
    paidAt: null,
    paymentMethod: null,
    sessionsRemaining: created.sessionAllowance,
    bookings: [],
  };
}

export async function recordMembershipPeriodPayment(
  companyId: string,
  customerMembershipId: string,
  periodId: string,
  input: {
    method: string;
    amount?: number;
    notes?: string | null;
  },
  tx: DbExecutor = db,
) {
  const [period] = await tx
    .select()
    .from(membershipPeriods)
    .where(
      and(
        eq(membershipPeriods.id, periodId),
        eq(membershipPeriods.customerMembershipId, customerMembershipId),
        eq(membershipPeriods.companyId, companyId),
      ),
    );

  if (!period) throw new BookingError("Período de mensalidade não encontrado.", 404);

  const payAmount = input.amount ?? centsToNumber(period.amount);
  const paymentId = crypto.randomUUID();

  await tx.insert(customerMembershipPayments).values({
    id: paymentId,
    companyId,
    customerMembershipId,
    membershipPeriodId: periodId,
    amount: payAmount.toFixed(2),
    method: input.method.toLowerCase(),
    status: "paid",
    paidAt: new Date(),
    notes: input.notes ?? null,
  });

  await tx
    .update(membershipPeriods)
    .set({
      paymentStatus: "paid",
      paidAt: new Date(),
      paymentMethod: input.method.toLowerCase(),
      updatedAt: new Date(),
    })
    .where(eq(membershipPeriods.id, periodId));

  await tx.insert(notifications).values({
    companyId,
    type: "membership.payment_recorded",
    title: "Mensalidade confirmada",
    body: `Mensalidade no valor de R$ ${payAmount.toFixed(2)} registrada via ${input.method.toUpperCase()}.`,
    entityType: "membership_payment",
    entityId: paymentId,
  });

  return { success: true, paymentId };
}

// ========================================================
// 4. MONTHLY SCHEDULE ENGINE & AVAILABILITY
// ========================================================

export async function getMonthScheduleSlots(
  companyId: string,
  customerMembershipId: string,
  year: number,
  month: number,
  overrideEmployeeId?: string,
  overrideServiceId?: string,
): Promise<{
  membership: CustomerMembershipDTO;
  period: MembershipPeriodDTO;
  days: MonthSlotDay[];
  allowance: number;
}> {
  const membership = await getCustomerMembershipDetails(companyId, customerMembershipId);
  if (!membership) throw new BookingError("Assinatura não encontrada.", 404);

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  if (!company) throw new BookingError("Empresa não encontrada.", 404);

  const targetDate = new Date(year, month - 1, 1, 12, 0, 0);
  const period = await getOrCreateCurrentPeriod(companyId, customerMembershipId, targetDate);

  const serviceId = overrideServiceId ?? membership.includedServices?.[0]?.id;
  if (!serviceId) throw new BookingError("Nenhum serviço vinculado ao plano.", 400);

  const employeeId = overrideEmployeeId ?? membership.preferredProfessionalId ?? undefined;

  // Candidate dates
  let candidateDates: string[] = [];
  if (membership.frequencyType === "FIXED_MONTHLY_QUOTA") {
    // If fixed monthly quota, candidate dates can be all preferred weekdays or all working days
    candidateDates =
      membership.preferredWeekdays.length > 0
        ? getWeekdayDatesInMonth(year, month, membership.preferredWeekdays)
        : getWeekdayDatesInMonth(year, month, [1, 2, 3, 4, 5, 6]);
  } else {
    // Weekly calendar based: exact preferred weekdays
    const weekdays = membership.preferredWeekdays.length > 0 ? membership.preferredWeekdays : [4];
    candidateDates = getWeekdayDatesInMonth(year, month, weekdays);
  }

  // Existing bookings mapped by date
  const existingBookingsByDate = new Map<string, NonNullable<MembershipPeriodDTO["bookings"]>[0]>();
  if (period.bookings) {
    for (const b of period.bookings) {
      existingBookingsByDate.set(b.date, b);
    }
  }

  const selection = [{ serviceId, employeeId: employeeId ?? null }];
  const days: MonthSlotDay[] = [];

  for (const dateStr of candidateDates) {
    const meta = formatDaySlotMeta(dateStr);
    const existing = existingBookingsByDate.get(dateStr) ?? null;

    let availableSlots: AvailableSlot[] = [];
    try {
      const avail = await loadAvailability(company, null, selection, dateStr, dateStr);
      availableSlots = avail.slots(dateStr);
    } catch {
      availableSlots = [];
    }

    days.push({
      date: dateStr,
      weekday: meta.weekday,
      weekdayLabel: meta.weekdayLabel,
      dateLabel: meta.dateLabel,
      shortDateLabel: meta.shortDateLabel,
      selectedStartTime: existing ? existing.startTime : (membership.preferredTime ?? null),
      isBooked: !!existing,
      existingAppointment: existing
        ? {
            id: existing.appointmentId,
            startTime: existing.startTime,
            endTime: existing.endTime,
            status: existing.status,
          }
        : null,
      availableSlots: availableSlots.map((s) => ({
        startTime: normalizeTime(s.startTime),
        endTime: normalizeTime(s.endTime),
      })),
    });
  }

  return {
    membership,
    period,
    days,
    allowance: period.sessionAllowance,
  };
}

// ========================================================
// 5. BATCH BOOKING ENGINE (ATOMIC & CONFLICT-AWARE)
// ========================================================

export async function bookBatchAppointments(
  companyId: string,
  input: MonthScheduleBatchInput,
  actorId = "system",
): Promise<BatchBookingResultDTO> {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  if (!company) throw new BookingError("Empresa não encontrada.", 404);

  const membership = await getCustomerMembershipDetails(companyId, input.customerMembershipId);
  if (!membership) throw new BookingError("Assinatura do cliente não encontrada.", 404);
  if (membership.status !== "active") throw new BookingError("A assinatura não está ativa.", 400);

  const firstDate = input.slots[0]?.date ?? new Date().toISOString().slice(0, 10);
  const [fYear, fMonth, fDay] = firstDate.split("-").map(Number);
  const targetDate = new Date(fYear, fMonth - 1, fDay || 1, 12, 0, 0);
  const period = await getOrCreateCurrentPeriod(companyId, input.customerMembershipId, targetDate);

  const defaultServiceId = input.serviceId ?? membership.includedServices?.[0]?.id;
  if (!defaultServiceId) throw new BookingError("Serviço não especificado para o agendamento.", 400);

  const defaultEmployeeId = input.employeeId ?? membership.preferredProfessionalId ?? null;

  const conflicts: BatchBookingConflict[] = [];
  const validSlotsToBook: Array<{
    date: string;
    startTime: string;
    endTime: string;
    serviceId: string;
    employeeId: string;
    slotData: AvailableSlot;
  }> = [];

  // Revalidate ALL slots against availability engine
  for (const item of input.slots) {
    const serviceId = item.serviceId ?? defaultServiceId;
    const employeeId = item.employeeId ?? defaultEmployeeId;

    const selection = [{ serviceId, employeeId: employeeId ?? null }];

    try {
      const avail = await loadAvailability(company, null, selection, item.date, item.date);
      const daySlots = avail.slots(item.date);
      const matchingSlot = daySlots.find((s) => normalizeTime(s.startTime) === normalizeTime(item.startTime));

      if (!matchingSlot) {
        conflicts.push({
          date: item.date,
          requestedStartTime: item.startTime,
          reason: "Horário não disponível ou já ocupado.",
          alternativeSlots: daySlots.slice(0, 5).map((s) => ({
            startTime: normalizeTime(s.startTime),
            endTime: normalizeTime(s.endTime),
          })),
        });
      } else {
        const plannedItem = matchingSlot.items[0];
        validSlotsToBook.push({
          date: item.date,
          startTime: normalizeTime(matchingSlot.startTime),
          endTime: normalizeTime(matchingSlot.endTime),
          serviceId,
          employeeId: plannedItem ? plannedItem.employeeId : (employeeId ?? ""),
          slotData: matchingSlot,
        });
      }
    } catch (err: any) {
      conflicts.push({
        date: item.date,
        requestedStartTime: item.startTime,
        reason: err.message ?? "Indisponibilidade de agenda.",
      });
    }
  }

  // If there are conflicts and none valid, return conflict report
  if (validSlotsToBook.length === 0) {
    return {
      success: false,
      bookedCount: 0,
      totalRequested: input.slots.length,
      createdAppointments: [],
      conflicts,
      message: "Nenhum horário pôde ser reservado devido a conflitos de agenda.",
    };
  }

  // Create appointments for valid slots
  const createdAppointments: any[] = [];

  await db.transaction(async (tx) => {
    for (const valid of validSlotsToBook) {
      const aptId = crypto.randomUUID();
      const plannedItem = valid.slotData.items[0];

      await tx.insert(appointments).values({
        id: aptId,
        companyId,
        clientId: membership.clientId,
        employeeId: valid.employeeId,
        appointmentDate: valid.date,
        startTime: valid.startTime,
        endTime: valid.endTime,
        status: "confirmed",
        total: "0.00", // INCLUÍDO NO PLANO
        notes: `Incluído no plano ${membership.membershipPlanName}`,
        source: "MEMBERSHIP",
        bufferMinutes: plannedItem?.bufferMinutes ?? 0,
      });

      await tx.insert(appointmentServices).values({
        appointmentId: aptId,
        serviceId: valid.serviceId,
        price: "0.00",
        durationMinutes: plannedItem?.durationMinutes ?? 30,
        commissionType: plannedItem?.commissionType ?? "none",
        commissionValue: plannedItem?.commissionValue ?? "0",
        commissionAmount: "0.00",
      });

      const usageId = crypto.randomUUID();
      await tx.insert(bookingMembershipUsage).values({
        id: usageId,
        companyId,
        appointmentId: aptId,
        customerMembershipId: membership.id,
        membershipPeriodId: period.id,
        serviceId: valid.serviceId,
        status: "booked",
      });

      await tx.insert(appointmentHistory).values({
        appointmentId: aptId,
        actorId: isUuid(actorId) ? actorId : null,
        action: "membership.batch_booking",
        metadata: {
          customerMembershipId: membership.id,
          periodId: period.id,
          planName: membership.membershipPlanName,
        },
      });

      createdAppointments.push({
        id: aptId,
        locationId: null,
        locationName: null,
        date: valid.date,
        startTime: valid.startTime,
        endTime: valid.endTime,
        durationMinutes: plannedItem?.durationMinutes ?? 30,
        clientId: membership.clientId,
        clientName: membership.clientName ?? "",
        clientPhone: membership.clientPhone ?? "",
        clientPhotoUrl: membership.clientPhotoUrl,
        clientInitials: "CL",
        clientColor: "#d8e5f0",
        employeeId: valid.employeeId,
        employeeName: plannedItem?.employeeName ?? "Profissional",
        employeeInitials: "PR",
        serviceId: valid.serviceId,
        serviceName: plannedItem?.name ?? "Serviço incluído",
        serviceColor: null,
        total: 0,
        status: "confirmed",
        notes: `Incluído no plano ${membership.membershipPlanName}`,
        paid: true,
        isMembershipBooking: true,
        membershipPlanName: membership.membershipPlanName,
        membershipUsageId: usageId,
      });
    }

    // Update period counts
    await tx
      .update(membershipPeriods)
      .set({
        sessionsBooked: period.sessionsBooked + validSlotsToBook.length,
        updatedAt: new Date(),
      })
      .where(eq(membershipPeriods.id, period.id));

    // Send in-app notification
    await tx.insert(notifications).values({
      companyId,
      type: "membership.batch_booked",
      title: "Horários mensais agendados",
      body: `${membership.clientName ?? "Cliente"} agendou ${validSlotsToBook.length} atendimento(s) do plano ${membership.membershipPlanName}.`,
      entityType: "membership",
      entityId: membership.id,
    });
  });

  return {
    success: conflicts.length === 0,
    bookedCount: validSlotsToBook.length,
    totalRequested: input.slots.length,
    createdAppointments,
    conflicts,
    message:
      conflicts.length === 0
        ? `Todos os ${validSlotsToBook.length} horários do mês foram confirmados com sucesso!`
        : `${validSlotsToBook.length} horário(s) confirmado(s). ${conflicts.length} horário(s) precisaram de ajuste por conflito de agenda.`,
  };
}

// ========================================================
// 6. RESCHEDULE & CANCEL RULES
// ========================================================

export async function rescheduleMembershipAppointment(
  companyId: string,
  appointmentId: string,
  newDate: string,
  newStartTime: string,
  actorId = "system",
) {
  const [apt] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, appointmentId), eq(appointments.companyId, companyId)));

  if (!apt) throw new BookingError("Agendamento não encontrado.", 404);

  const [usage] = await db
    .select()
    .from(bookingMembershipUsage)
    .where(and(eq(bookingMembershipUsage.appointmentId, appointmentId), eq(bookingMembershipUsage.companyId, companyId)));

  if (!usage) throw new BookingError("Agendamento não está vinculado a um plano mensal.", 400);

  const membership = await getCustomerMembershipDetails(companyId, usage.customerMembershipId);
  if (!membership) throw new BookingError("Plano do cliente não encontrado.", 404);

  // Validate availability for new date/time
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  const selection = [{ serviceId: usage.serviceId, employeeId: apt.employeeId }];
  const avail = await loadAvailability(company!, null, selection, newDate, newDate);
  const matchingSlot = avail.slots(newDate).find((s) => normalizeTime(s.startTime) === normalizeTime(newStartTime));

  if (!matchingSlot) {
    throw new BookingError("O novo horário selecionado não está disponível.", 409);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(appointments)
      .set({
        appointmentDate: newDate,
        startTime: matchingSlot.startTime,
        endTime: matchingSlot.endTime,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId));

    await tx.insert(appointmentHistory).values({
      appointmentId,
      actorId: isUuid(actorId) ? actorId : null,
      action: "membership.rescheduled",
      metadata: { newDate, newStartTime },
    });
  });

  return { success: true };
}

export async function cancelMembershipAppointment(
  companyId: string,
  appointmentId: string,
  reason?: string,
  actorId = "system",
) {
  const [apt] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, appointmentId), eq(appointments.companyId, companyId)));

  if (!apt) throw new BookingError("Agendamento não encontrado.", 404);

  const [usage] = await db
    .select()
    .from(bookingMembershipUsage)
    .where(and(eq(bookingMembershipUsage.appointmentId, appointmentId), eq(bookingMembershipUsage.companyId, companyId)));

  if (!usage) throw new BookingError("Agendamento não está vinculado a um plano mensal.", 400);

  const [period] = await db
    .select()
    .from(membershipPeriods)
    .where(eq(membershipPeriods.id, usage.membershipPeriodId));

  await db.transaction(async (tx) => {
    await tx
      .update(appointments)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: reason ?? "Cancelado pelo cliente/estabelecimento",
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId));

    // Refund session credit to period
    await tx
      .update(bookingMembershipUsage)
      .set({ status: "cancelled_refunded", updatedAt: new Date() })
      .where(eq(bookingMembershipUsage.id, usage.id));

    if (period && period.sessionsBooked > 0) {
      await tx
        .update(membershipPeriods)
        .set({
          sessionsBooked: sql`GREATEST(0, ${membershipPeriods.sessionsBooked} - 1)`,
          updatedAt: new Date(),
        })
        .where(eq(membershipPeriods.id, period.id));
    }

    await tx.insert(appointmentHistory).values({
      appointmentId,
      actorId: isUuid(actorId) ? actorId : null,
      action: "membership.cancelled",
      metadata: { reason, refunded: true },
    });
  });

  return { success: true, sessionRefunded: true };
}
