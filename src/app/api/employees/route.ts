import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employeeLocations, employeeSchedules, employeeServices, employees, locations, services, users } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { hashPassword, normalizeEmail, requireAuth, requireRole, unauthorized } from "@/lib/auth";
import { centsToNumber } from "@/lib/domain";
import { saveProfessionalImage } from "@/lib/storage";
import type { EmployeeDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const rows = await db.select().from(employees).where(eq(employees.companyId, auth.user.companyId)).orderBy(asc(employees.name));

  const servicesMap = await getServiceNamesByCompany(auth.user.companyId);

  const employeeIds = rows.map((row) => row.id);
  const links = employeeIds.length
    ? await db.select().from(employeeServices).where(inArray(employeeServices.employeeId, employeeIds))
    : [];

  const linksByEmployee = new Map<string, string[]>();
  for (const link of links) {
    const list = linksByEmployee.get(link.employeeId) ?? [];
    list.push(link.serviceId);
    linksByEmployee.set(link.employeeId, list);
  }

  const dto: EmployeeDTO[] = rows.map((row) => {
    const serviceIds = linksByEmployee.get(row.id) ?? [];
    return {
      id: row.id,
      name: row.name,
      jobTitle: row.jobTitle,
      phone: row.phone,
      photoUrl: row.photoUrl ?? null,
      active: row.active,
      color: avatarColor(row.name),
      initials: initials(row.name),
      commissionType: row.commissionType as EmployeeDTO["commissionType"],
      commissionValue: centsToNumber(row.commissionValue),
      services: serviceIds.map((id) => servicesMap.get(id) ?? "Serviço").sort(),
      serviceIds,
      hasLogin: row.userId !== null,
    };
  });

  return Response.json({ data: dto });
}

const createSchema = z
  .object({
    name: z.string().min(2, "Informe o nome do profissional.").max(120),
    jobTitle: z.string().max(80).optional(),
    phone: z.string().max(20).optional(),
    commissionType: z.enum(["none", "percentage", "fixed"]).optional(),
    commissionValue: z.number().min(0).optional(),
    serviceIds: z.array(z.string()).optional(),
    photoUrl: z.string().max(8_000_000).optional().nullable(),
    // Optional: grants the employee their own login (role "employee"), scoped
    // to this company. Owner sets the initial password directly — no invite
    // email flow yet, see [[novae-engagement]].
    grantAccess: z.boolean().optional(),
    email: z.string().email("Informe um e-mail válido.").optional(),
    password: z.string().min(8, "A senha deve ter ao menos 8 caracteres.").optional(),
  })
  .refine((data) => !data.grantAccess || (data.email && data.password), {
    message: "Informe e-mail e senha para liberar o acesso ao sistema.",
    path: ["email"],
  });

export async function POST(request: Request) {
  const gate = await requireRole("manager");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { name, jobTitle, phone, commissionType, commissionValue, serviceIds, grantAccess } = parsed.data;
  let photoUrl: string | null = null;
  try {
    photoUrl = parsed.data.photoUrl ? await saveProfessionalImage(parsed.data.photoUrl) : null;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Imagem inválida." }, { status: 400 });
  }

  // Grant a login account (role "employee") scoped to this company, if requested.
  let loginUserId: string | null = null;
  if (grantAccess && parsed.data.email && parsed.data.password) {
    const normalizedEmail = normalizeEmail(parsed.data.email);
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.companyId, auth.user.companyId), eq(users.email, normalizedEmail)));
    if (existing) {
      return Response.json(
        { error: "Já existe um usuário com este e-mail nesta empresa." },
        { status: 409 },
      );
    }
    const passwordHash = await hashPassword(parsed.data.password);
    loginUserId = crypto.randomUUID();
    await db
      .insert(users)
      .values({
        id: loginUserId,
        companyId: auth.user.companyId,
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: "employee",
        active: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      });
  }

  const employeeId = crypto.randomUUID();
  const trimmedName = name.trim();
  const trimmedJobTitle = jobTitle?.trim() || null;
  const trimmedPhone = phone?.trim() || null;

  await db
    .insert(employees)
    .values({
      id: employeeId,
      companyId: auth.user.companyId,
      userId: loginUserId,
      name: trimmedName,
      jobTitle: trimmedJobTitle,
      phone: trimmedPhone,
      photoUrl,
      commissionType: commissionType ?? "none",
      commissionValue: String(commissionValue ?? 0),
      active: true,
    });

  const created = {
    id: employeeId,
    name: trimmedName,
    jobTitle: trimmedJobTitle,
    phone: trimmedPhone,
    photoUrl,
    active: true,
  };

  if (serviceIds && serviceIds.length > 0) {
    const owned = await db
      .select({ id: services.id })
      .from(services)
      .where(and(inArray(services.id, serviceIds), eq(services.companyId, auth.user.companyId)));
    const ownedIds = new Set(owned.map((s) => s.id));
    const linkIds = serviceIds.filter((sid) => ownedIds.has(sid));
    if (linkIds.length > 0) {
      await db.insert(employeeServices).values(linkIds.map((serviceId) => ({ id: crypto.randomUUID(), employeeId: created.id, serviceId })));
    }
  }

  // Link to company's primary location
  const [primaryLoc] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.companyId, auth.user.companyId), eq(locations.active, true)))
    .limit(1);

  if (primaryLoc) {
    await db.insert(employeeLocations).values({
      id: crypto.randomUUID(),
      employeeId: created.id,
      locationId: primaryLoc.id,
      isPrimary: true,
    });
  }

  // Create default schedules for working days (Seg-Sáb, 08:00-19:00 com almoço 12:00-13:00)
  for (const day of [1, 2, 3, 4, 5, 6]) {
    await db.insert(employeeSchedules).values({
      id: crypto.randomUUID(),
      employeeId: created.id,
      locationId: primaryLoc?.id ?? null,
      dayOfWeek: day,
      startTime: "08:00:00",
      endTime: "19:00:00",
      breakStart: "12:00:00",
      breakEnd: "13:00:00",
      active: true,
    });
  }

  await recordAudit({
    companyId: auth.user.companyId,
    userId: auth.user.userId,
    action: "employee.created",
    entity: "employee",
    entityId: created.id,
    metadata: { name: created.name, grantedAccess: Boolean(loginUserId) },
  });

  const dto: EmployeeDTO = {
    id: created.id,
    name: created.name,
    jobTitle: created.jobTitle,
    phone: created.phone,
    photoUrl: created.photoUrl,
    active: created.active,
    color: avatarColor(created.name),
    initials: initials(created.name),
    commissionType: commissionType ?? "none",
    commissionValue: commissionValue ?? 0,
    services: [],
    serviceIds: serviceIds ?? [],
    hasLogin: Boolean(loginUserId),
  };

  return Response.json({ data: dto }, { status: 201 });
}

async function getServiceNamesByCompany(companyId: string): Promise<Map<string, string>> {
  const rows = await db.select({ id: services.id, name: services.name }).from(services).where(eq(services.companyId, companyId));
  return new Map(rows.map((row) => [row.id, row.name]));
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}

const PALETTE = ["#d6ebe6", "#e9e1d6", "#e7dce8", "#dce5ee", "#e2d9ea", "#d9e8e0"];
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  return PALETTE[hash % PALETTE.length];
}
