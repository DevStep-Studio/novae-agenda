import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { pushDevices } from "@/db/schema";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  pushToken: z.string().min(10, "Token de push inválido."),
  platform: z.enum(["ios", "android", "web", "unknown"]).default("unknown"),
  deviceIdentifier: z.string().optional(),
  appVersion: z.string().optional(),
  environment: z.enum(["development", "preview", "production"]).default("production"),
  customerId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const { pushToken, platform, deviceIdentifier, appVersion, environment, customerId } = parsed.data;

    // Check if there is an authenticated staff session
    const user = await getSession();

    // Look for existing device record by pushToken
    const [existing] = await db
      .select({ id: pushDevices.id })
      .from(pushDevices)
      .where(eq(pushDevices.pushToken, pushToken))
      .limit(1);

    const now = new Date();

    if (existing) {
      await db
        .update(pushDevices)
        .set({
          userId: user?.userId || null,
          customerId: customerId || null,
          companyId: user?.companyId || null,
          platform,
          deviceIdentifier: deviceIdentifier || null,
          appVersion: appVersion || null,
          environment,
          isActive: true,
          lastRegisteredAt: now,
          lastError: null,
        })
        .where(eq(pushDevices.id, existing.id));

      return NextResponse.json({ data: { ok: true, deviceId: existing.id } });
    }

    const newId = crypto.randomUUID();
    await db.insert(pushDevices).values({
      id: newId,
      userId: user?.userId || null,
      customerId: customerId || null,
      companyId: user?.companyId || null,
      provider: "expo",
      pushToken,
      platform,
      deviceIdentifier: deviceIdentifier || null,
      appVersion: appVersion || null,
      environment,
      isActive: true,
      lastRegisteredAt: now,
    });

    return NextResponse.json({ data: { ok: true, deviceId: newId } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro ao registrar dispositivo para notificações." },
      { status: 500 }
    );
  }
}
