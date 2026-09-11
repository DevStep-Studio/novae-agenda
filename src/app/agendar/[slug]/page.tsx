import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicCatalog } from "@/lib/booking/catalog";
import { BookingError } from "@/lib/booking/errors";
import { PublicBooking } from "@/components/booking/public-booking";
export const dynamic="force-dynamic";
const load=cache(async(slug:string)=>{try{return await publicCatalog(slug);}catch(e){if(e instanceof BookingError&&e.status===404)notFound();throw e;}});
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {company}=await load((await params).slug);return {title:`Agendar com ${company.name} | Reservei`,description:company.description||`Reserve seu horário online com ${company.name}.`,openGraph:{title:`Agendar com ${company.name} | Reservei`,description:company.description||`Reserve seu horário online com ${company.name}.`,...(company.logoUrl?.startsWith("https://")?{images:[company.logoUrl]}:{})}};}
export default async function Page({params}:{params:Promise<{slug:string}>}){return <PublicBooking catalog={await load((await params).slug)}/>;}
