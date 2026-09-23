import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { authTokens, users } from "@/db/schema";
import { AUTH_RULES, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token || !token.trim()) {
      return NextResponse.json({ error: "Token de verificação ausente." }, { status: 400 });
    }

    const ip = clientIp(request);
    const limit = await consumeRateLimit(`verify-email:ip:${ip}`, AUTH_RULES.login);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

    const tokenHash = sha256(token.trim());

    const [validToken] = await db
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.kind, "email_verification"),
          eq(authTokens.tokenHash, tokenHash),
          isNull(authTokens.consumedAt),
          gt(authTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!validToken) {
      return NextResponse.json(
        { error: "Link de verificação inválido ou expirado. Solicite um novo link." },
        { status: 400 },
      );
    }

    // 1. Marca token como consumido (single-use)
    await db
      .update(authTokens)
      .set({ consumedAt: new Date() })
      .where(eq(authTokens.id, validToken.id));

    // 2. Atualiza status de e-mail verificado do usuário
    await db
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, validToken.userId));

    // 3. Se a requisição aceita HTML ou é uma navegação direta de navegador, redireciona para login/gestão
    const acceptHeader = request.headers.get("accept") || "";
    if (acceptHeader.includes("text/html")) {
      return NextResponse.redirect(new URL("/login?verified=true", request.url));
    }

    return NextResponse.json({
      data: {
        success: true,
        message: "E-mail verificado com sucesso!",
      },
    });
  } catch (error) {
    console.error("[verify-email] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar a verificação de e-mail." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const token = body?.token;

    if (!token || typeof token !== "string" || !token.trim()) {
      return NextResponse.json({ error: "Token de verificação ausente." }, { status: 400 });
    }

    const ip = clientIp(request);
    const limit = await consumeRateLimit(`verify-email:ip:${ip}`, AUTH_RULES.login);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

    const tokenHash = sha256(token.trim());

    const [validToken] = await db
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.kind, "email_verification"),
          eq(authTokens.tokenHash, tokenHash),
          isNull(authTokens.consumedAt),
          gt(authTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!validToken) {
      return NextResponse.json(
        { error: "Código ou token inválido ou expirado." },
        { status: 400 },
      );
    }

    // 1. Marca token como consumido
    await db
      .update(authTokens)
      .set({ consumedAt: new Date() })
      .where(eq(authTokens.id, validToken.id));

    // 2. Atualiza status de e-mail verificado
    await db
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, validToken.userId));

    return NextResponse.json({
      data: {
        success: true,
        message: "E-mail confirmado com sucesso!",
      },
    });
  } catch (error) {
    console.error("[verify-email POST] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao confirmar e-mail." },
      { status: 500 },
    );
  }
}
