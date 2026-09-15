import { NextResponse } from "next/server";
import { CustomerAccessService } from "@/lib/customer-access/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const pin = await CustomerAccessService.generateAvailablePin();
  return NextResponse.json({ data: { pin } });
}
