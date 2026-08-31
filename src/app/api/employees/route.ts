import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employeeServices, employees, services } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { centsToNumber } from "@/lib/domain";
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
      active: row.active,
      color: avatarColor(row.name),
      initials: initials(row.name),
      commissionType: row.commissionType as EmployeeDTO["commissionType"],
      commissionValue: centsToNumber(row.commissionValue),
      services: serviceIds.map((id) => servicesMap.get(id) ?? "Serviço").sort(),
      serviceIds,
    };
  });

  return Response.json({ data: dto });
}

const createSchema = z.object({
  name: z.string().min(2, "Informe o nome do profissional.").max(120),
  jobTitle: z.string().max(80).optional(),
  phone: z.string().max(20).optional(),
  commissionType: z.enum(["none", "percentage", "fixed"]).optional(),
  commissionValue: z.number().min(0).optional(),
  serviceIds: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { name, jobTitle, phone, commissionType, commissionValue, serviceIds } = parsed.data;

  const [created] = await db
    .insert(employees)
    .values({
      companyId: auth.user.companyId,
      name: name.trim(),
      jobTitle: jobTitle?.trim() || null,
      phone: phone?.trim() || null,
      commissionType: commissionType ?? "none",
      commissionValue: String(commissionValue ?? 0),
      active: true,
    })
    .returning();

  if (serviceIds && serviceIds.length > 0) {
    await db
      .insert(employeeServices)
      .values(serviceIds.map((serviceId) => ({ employeeId: created.id, serviceId })));
  }

  const dto: EmployeeDTO = {
    id: created.id,
    name: created.name,
    jobTitle: created.jobTitle,
    phone: created.phone,
    active: created.active,
    color: avatarColor(created.name),
    initials: initials(created.name),
    commissionType: commissionType ?? "none",
    commissionValue: commissionValue ?? 0,
    services: [],
    serviceIds: serviceIds ?? [],
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
