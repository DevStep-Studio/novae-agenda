import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  employeeSchedules,
  employees,
  services,
} from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export type SetupStatusResponse = {
  percentage: number;
  isComplete: boolean;
  steps: {
    id: string;
    label: string;
    completed: boolean;
    targetTab: string;
  }[];
  publicSlug: string | null;
  publicEnabled: boolean;
  publicUrl: string | null;
};

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const companyId = auth.user.companyId;

  // 1. Fetch company record
  const [company] = await db
    .select({
      name: companies.name,
      phone: companies.phone,
      address: companies.address,
      publicSlug: companies.publicSlug,
      publicEnabled: companies.publicEnabled,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) {
    return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  // 2. Count services
  const [{ value: servicesCount }] = await db
    .select({ value: count() })
    .from(services)
    .where(and(eq(services.companyId, companyId), eq(services.active, true)));

  // 3. Count employees
  const [{ value: teamCount }] = await db
    .select({ value: count() })
    .from(employees)
    .where(and(eq(employees.companyId, companyId), eq(employees.active, true)));

  // 4. Count schedules
  const [{ value: scheduleCount }] = await db
    .select({ value: count() })
    .from(employeeSchedules)
    .innerJoin(employees, eq(employeeSchedules.employeeId, employees.id))
    .where(and(eq(employees.companyId, companyId), eq(employeeSchedules.active, true)));

  const companyCompleted = Boolean(company.name && (company.phone || company.address));
  const servicesCompleted = Number(servicesCount) > 0;
  const teamCompleted = Number(teamCount) > 0;
  const scheduleCompleted = Number(scheduleCount) > 0;
  const publicPageCompleted = Boolean(company.publicSlug && company.publicEnabled);

  const steps = [
    {
      id: "company",
      label: "Dados da empresa",
      completed: companyCompleted,
      targetTab: "configuracoes",
    },
    {
      id: "services",
      label: "Cadastrar serviços",
      completed: servicesCompleted,
      targetTab: "servicos",
    },
    {
      id: "team",
      label: "Cadastrar equipe",
      completed: teamCompleted,
      targetTab: "equipe",
    },
    {
      id: "schedule",
      label: "Configurar horários",
      completed: scheduleCompleted,
      targetTab: "configuracoes",
    },
    {
      id: "public_page",
      label: "Publicar página de agendamentos",
      completed: publicPageCompleted,
      targetTab: "link-agendamento",
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const percentage = Math.round((completedCount / steps.length) * 100);
  const isComplete = completedCount === steps.length;

  const origin = process.env.APP_URL || "";
  const publicUrl = company.publicSlug
    ? `${origin}/agendar/${company.publicSlug}`
    : null;

  const responseData: SetupStatusResponse = {
    percentage,
    isComplete,
    steps,
    publicSlug: company.publicSlug ?? null,
    publicEnabled: company.publicEnabled ?? false,
    publicUrl,
  };

  return Response.json({ data: responseData });
}
