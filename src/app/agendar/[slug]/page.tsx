import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicCatalog } from "@/lib/booking/catalog";
import { BookingError } from "@/lib/booking/errors";
import { PublicBooking } from "@/components/booking/public-booking";

export const dynamic = "force-dynamic";

const load = cache(async (slug: string) => {
  try {
    return await publicCatalog(slug);
  } catch (e: any) {
    if (
      (e instanceof BookingError && e.status === 404) ||
      e?.status === 404 ||
      e?.statusCode === 404 ||
      e?.message?.includes("não está disponível")
    ) {
      notFound();
    }
    throw e;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  try {
    const { slug } = await params;
    const { company } = await load(slug);
    return {
      title: `Agendar com ${company.name} | Reservei`,
      description: company.description || `Reserve seu horário online com ${company.name}.`,
      openGraph: {
        title: `Agendar com ${company.name} | Reservei`,
        description: company.description || `Reserve seu horário online com ${company.name}.`,
        ...(company.logoUrl?.startsWith("https://") ? { images: [company.logoUrl] } : {}),
      },
    };
  } catch {
    return {
      title: "Agendamento Online | Reservei",
      description: "Reserve seu horário online com facilidade e rapidez no Reservei.",
    };
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const catalog = await load(slug);
  return <PublicBooking catalog={catalog} />;
}

