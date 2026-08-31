import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies, employeeSchedules, employeeServices, employees, services } from "@/db/schema";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2, "Informe o nome do estabelecimento.").max(120),
  businessType: z.string().optional(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de abertura inválido."),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário de fechamento inválido."),
  workingDays: z.array(z.number().min(0).max(6)).min(1, "Selecione pelo menos um dia de funcionamento."),
  employeeName: z.string().min(2, "Informe o nome do profissional.").max(120),
  serviceName: z.string().min(2, "Informe o nome do serviço.").max(120),
  servicePrice: z.number().min(0).max(1000000),
  serviceDuration: z.number().min(5).max(1440),
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

  await db
    .update(companies)
    .set({ name: name.trim(), businessType: businessType ?? null, onboarded: true })
    .where(eq(companies.id, user.companyId));

  const [employee] = await db
    .insert(employees)
    .values({ companyId: user.companyId, name: employeeName.trim(), jobTitle: "Profissional", active: true })
    .returning();

  for (const day of workingDays) {
    await db.insert(employeeSchedules).values({
      employeeId: employee.id,
      dayOfWeek: day,
      startTime: `${openTime}:00`,
      endTime: `${closeTime}:00`,
      breakStart: null,
      breakEnd: null,
      active: true,
    });
  }

  const [service] = await db
    .insert(services)
    .values({
      companyId: user.companyId,
      name: serviceName.trim(),
      price: servicePrice.toFixed(2),
      durationMinutes: serviceDuration,
      active: true,
    })
    .returning();

  await db.insert(employeeServices).values({ employeeId: employee.id, serviceId: service.id });

  return Response.json({ data: { onboarded: true } }, { status: 201 });
}
