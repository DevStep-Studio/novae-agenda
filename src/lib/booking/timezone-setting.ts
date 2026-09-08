import { eq } from "drizzle-orm";
import { appointments, companies } from "@/db/schema";
import type { DbExecutor } from "@/lib/availability";
import { BookingError } from "./errors";
export async function assertTimezoneChange(
  tx: DbExecutor,
  companyId: string,
  timezone: string,
) {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone });
  } catch {
    throw new BookingError("Fuso horário inválido.");
  }
  const [company] = await tx
    .select({ timezone: companies.timezone })
    .from(companies)
    .where(eq(companies.id, companyId));
  if (company.timezone === timezone) return;
  const [booking] = await tx
    .select({ id: appointments.id })
    .from(appointments)
    .where(eq(appointments.companyId, companyId))
    .limit(1);
  if (booking)
    throw new BookingError(
      "O fuso não pode ser alterado após criar atendimentos. Contate o suporte.",
      422,
    );
}
