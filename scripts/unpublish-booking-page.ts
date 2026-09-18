import "dotenv/config";
import { db, pool } from "../src/db";
import { bookingPages, companies } from "../src/db/schema";
import { eq } from "drizzle-orm";

// Reverts a company's public booking page from the custom Page Builder layout
// back to the standard catalog template, by flipping booking_pages.status to
// "draft". The draft layout is kept untouched so the owner can pick up editing
// later; only the live /agendar/[slug] page is affected.
//
// Usage: npx tsx scripts/unpublish-booking-page.ts <public-slug>

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Uso: npx tsx scripts/unpublish-booking-page.ts <public-slug>");
    process.exitCode = 1;
    return;
  }

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.publicSlug, slug))
    .limit(1);

  if (!company) {
    console.error(`Nenhuma empresa encontrada com public_slug="${slug}".`);
    process.exitCode = 1;
    return;
  }

  const [page] = await db
    .select()
    .from(bookingPages)
    .where(eq(bookingPages.companyId, company.id))
    .limit(1);

  if (!page) {
    console.log(`"${company.name}" não tem nenhuma página do Page Builder — já usa o template padrão.`);
    return;
  }

  if (page.status !== "published") {
    console.log(`"${company.name}" já está como rascunho (status="${page.status}"). Nada a fazer.`);
    return;
  }

  await db
    .update(bookingPages)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(bookingPages.id, page.id));

  console.log(
    `✅ "${company.name}" (${slug}) revertida para o template padrão. A página do Page Builder continua salva como rascunho e pode ser publicada de novo quando quiser.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
