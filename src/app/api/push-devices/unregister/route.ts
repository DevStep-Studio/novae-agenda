import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { pushDevices } from "@/db/schema";

export const dynamic = "force-dynamic";

const unregisterSchema = z.object({
  pushToken: z.string().min(10, "Token de push inválido."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = unregisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const { pushToken } = parsed.data;

    await db
      .update(pushDevices)
      .set({
        isActive: false,
        lastFailureAt: new Date(),
        lastError: "User logged out / unregistered",
      })
      .where(eq(pushDevices.pushToken, pushToken));

    return NextResponse.json({ data: { ok: true } });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro ao desregistrar dispositivo." },
      { status: 500 }
    );
  }
}
