import { ZodError } from "zod";
export class BookingError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function bookingError(error: unknown): Response {
  if (error instanceof BookingError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError)
    return Response.json({ error: "Solicitação inválida." }, { status: 400 });
  if (error instanceof ZodError)
    return Response.json(
      { error: error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  const cause = error as { code?: string; errno?: number; cause?: { code?: string; errno?: number } };
  const code = cause?.code ?? cause?.cause?.code;
  const errno = cause?.errno ?? cause?.cause?.errno;
  if (["23P01", "40001", "40P01", "ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(code ?? "") || errno === 1213 || errno === 1205)
    return Response.json(
      { error: "Este horário acabou de ser reservado. Escolha outro horário." },
      { status: 409 },
    );
  if (code === "23505" || code === "ER_DUP_ENTRY" || errno === 1062)
    return Response.json(
      {
        error: "Este registro já existe. Atualize a página e tente novamente.",
      },
      { status: 409 },
    );
  console.error("[booking]", error);
  const userMessage =
    error instanceof Error &&
    error.message &&
    !error.message.includes("sql") &&
    !error.message.includes("SELECT") &&
    !error.message.includes("INSERT") &&
    !error.message.includes("UPDATE") &&
    !error.message.includes("DELETE")
      ? error.message
      : "Não foi possível concluir. Tente novamente.";
  return Response.json(
    { error: userMessage },
    { status: 500 },
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  try {
    const reqUrl = new URL(request.url);
    if (origin === reqUrl.origin) return;

    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (host) {
      const proto = request.headers.get("x-forwarded-proto") || reqUrl.protocol.replace(":", "");
      if (origin === `${proto}://${host}`) return;
    }

    const originUrl = new URL(origin);
    const isLocalOrigin = originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1";
    const isLocalReq = reqUrl.hostname === "localhost" || reqUrl.hostname === "127.0.0.1" || reqUrl.hostname === "0.0.0.0";
    if (isLocalOrigin && isLocalReq && originUrl.port === reqUrl.port) return;

    const appUrl = process.env.APP_URL?.replace(/\/$/, "");
    if (appUrl && origin === appUrl) return;

    if (request.headers.get("sec-fetch-site") === "cross-site") {
      throw new BookingError("Origem da solicitação inválida.", 403);
    }
  } catch (e) {
    if (e instanceof BookingError) throw e;
  }
}
