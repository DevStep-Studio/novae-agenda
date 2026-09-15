import { NextResponse } from "next/server";
import { generateRandomPin } from "@/lib/customer-access/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const pin = generateRandomPin();
  return NextResponse.json({ pin });
}
