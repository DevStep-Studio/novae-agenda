import { db } from "@/db";
import { companies, saasCouponRedemptions, saasCoupons } from "@/db/schema";
import { requireSuperadmin } from "@/lib/auth";
import { and, desc, eq, gte, lte } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  const { searchParams } = new URL(request.url);
  const couponId = searchParams.get("couponId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const conditions = [];

  if (couponId) {
    conditions.push(eq(saasCouponRedemptions.couponId, couponId));
  }

  if (startDate) {
    conditions.push(gte(saasCouponRedemptions.createdAt, new Date(startDate)));
  }

  if (endDate) {
    conditions.push(lte(saasCouponRedemptions.createdAt, new Date(endDate)));
  }

  const redemptions = await db
    .select({
      id: saasCouponRedemptions.id,
      couponCode: saasCoupons.code,
      couponName: saasCoupons.name,
      influencerName: saasCoupons.influencerName,
      companyName: companies.name,
      originalAmount: saasCouponRedemptions.originalAmount,
      discountAmount: saasCouponRedemptions.discountAmount,
      finalAmount: saasCouponRedemptions.finalAmount,
      status: saasCouponRedemptions.status,
      isConverted: saasCouponRedemptions.isConverted,
      convertedAt: saasCouponRedemptions.convertedAt,
      redeemedAt: saasCouponRedemptions.redeemedAt,
      createdAt: saasCouponRedemptions.createdAt,
    })
    .from(saasCouponRedemptions)
    .innerJoin(saasCoupons, eq(saasCouponRedemptions.couponId, saasCoupons.id))
    .innerJoin(companies, eq(saasCouponRedemptions.companyId, companies.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(saasCouponRedemptions.createdAt));

  // Build CSV
  const headers = [
    "ID Resgate",
    "Codigo Cupom",
    "Nome Cupom",
    "Influenciador",
    "Empresa / Proprietario",
    "Valor Original (R$)",
    "Desconto (R$)",
    "Valor Pago (R$)",
    "Status",
    "Convertido em Pagamento",
    "Data Conversao",
    "Data Resgate",
    "Data Criacao",
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return "";
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = redemptions.map((r) => [
    escapeCsv(r.id),
    escapeCsv(r.couponCode),
    escapeCsv(r.couponName),
    escapeCsv(r.influencerName ?? "N/A"),
    escapeCsv(r.companyName),
    escapeCsv(r.originalAmount),
    escapeCsv(r.discountAmount),
    escapeCsv(r.finalAmount),
    escapeCsv(r.status),
    escapeCsv(r.isConverted ? "Sim" : "Nao"),
    escapeCsv(r.convertedAt ? r.convertedAt.toISOString() : ""),
    escapeCsv(r.redeemedAt ? r.redeemedAt.toISOString() : ""),
    escapeCsv(r.createdAt.toISOString()),
  ]);

  const csvContent = [
    headers.join(";"),
    ...rows.map((row) => row.join(";")),
  ].join("\r\n");

  const filename = `resgates_cupons_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
