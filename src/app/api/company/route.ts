import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import type { Company } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const [company] = await db.select().from(companies).where(eq(companies.id, auth.user.companyId)).limit(1);
  if (!company) return Response.json({ error: "Empresa não encontrada." }, { status: 404 });

  const dto: Company = {
    id: company.id,
    name: company.name,
    businessType: company.businessType,
    phone: company.phone,
    whatsapp: company.whatsapp,
    email: company.email,
    address: company.address,
    instagram: company.instagram,
    website: company.website,
    timezone: company.timezone,
    currency: company.currency,
    primaryColor: company.primaryColor,
    secondaryColor: company.secondaryColor,
    onboarded: company.onboarded,
  };

  return Response.json({ data: dto });
}

const updateSchema = z.object({
  name: z.string().min(2, "Informe o nome da empresa.").max(120).optional(),
  phone: z.string().max(20).optional(),
  whatsapp: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(200).optional(),
  instagram: z.string().max(80).optional(),
  website: z.string().max(200).optional(),
  timezone: z.string().max(80).optional(),
  primaryColor: z.string().max(20).optional(),
  secondaryColor: z.string().max(20).optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role === "employee") {
    return Response.json({ error: "Você não tem permissão para alterar as configurações." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  const data = parsed.data;
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.phone !== undefined) patch.phone = data.phone.trim();
  if (data.whatsapp !== undefined) patch.whatsapp = data.whatsapp.trim();
  if (data.email !== undefined) patch.email = data.email.trim() || null;
  if (data.address !== undefined) patch.address = data.address.trim() || null;
  if (data.instagram !== undefined) patch.instagram = data.instagram.trim() || null;
  if (data.website !== undefined) patch.website = data.website.trim() || null;
  if (data.timezone !== undefined) patch.timezone = data.timezone;
  if (data.primaryColor !== undefined) patch.primaryColor = data.primaryColor;
  if (data.secondaryColor !== undefined) patch.secondaryColor = data.secondaryColor;

  await db.update(companies).set(patch).where(eq(companies.id, auth.user.companyId));

  return Response.json({ data: { ok: true } });
}
