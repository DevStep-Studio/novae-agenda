import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies, employeeSchedules, employeeServices, employees, services } from "@/db/schema";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().max(120).optional().nullable(),
  businessType: z.string().optional().nullable(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de abertura inválido.").optional().default("09:00"),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de fechamento inválido.").optional().default("18:00"),
  workingDays: z.array(z.number().min(0).max(6)).optional().default([1, 2, 3, 4, 5]),
  employeeName: z.string().max(120).optional().nullable(),
  serviceName: z.string().max(120).optional().nullable(),
  servicePrice: z.coerce.number().min(0).max(1000000).optional().default(0),
  serviceDuration: z.coerce.number().min(1).max(1440).optional().default(30),
});

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) {
    return Response.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { name, businessType, openTime, closeTime, workingDays, employeeName, serviceName, servicePrice, serviceDuration } = parsed.data;

  const companyName = name?.trim() || user.name || "Meu Estabelecimento";

  await db
    .update(companies)
    .set({ name: companyName, businessType: businessType ?? null, onboarded: true })
    .where(eq(companies.id, user.companyId));

  // Determine employee name or default to user name / main staff
  const staffName = employeeName?.trim() || user.name || "Profissional Principal";
  const employeeId = crypto.randomUUID();
  await db
    .insert(employees)
    .values({ id: employeeId, companyId: user.companyId, name: staffName, jobTitle: "Profissional", active: true });

  const activeDays = workingDays && workingDays.length > 0 ? workingDays : [1, 2, 3, 4, 5];
  for (const day of activeDays) {
    await db.insert(employeeSchedules).values({
      id: crypto.randomUUID(),
      employeeId: employeeId,
      dayOfWeek: day,
      startTime: `${openTime || "09:00"}:00`,
      endTime: `${closeTime || "18:00"}:00`,
      breakStart: null,
      breakEnd: null,
      active: true,
    });
  }

  const servName = serviceName?.trim() || "Atendimento Padrão";
  const serviceId = crypto.randomUUID();
  await db
    .insert(services)
    .values({
      id: serviceId,
      companyId: user.companyId,
      name: servName,
      price: (servicePrice || 0).toFixed(2),
      durationMinutes: serviceDuration || 30,
      active: true,
    });

  await db.insert(employeeServices).values({ employeeId, serviceId });

  return Response.json({ data: { onboarded: true } }, { status: 201 });
}
