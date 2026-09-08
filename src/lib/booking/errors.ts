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
  const cause = error as { code?: string; cause?: { code?: string } };
  const code = cause?.code ?? cause?.cause?.code;
  if (["23P01", "40001", "40P01"].includes(code ?? ""))
    return Response.json(
      { error: "Este horário acabou de ser reservado. Escolha outro horário." },
      { status: 409 },
    );
  if (code === "23505")
    return Response.json(
      {
        error: "Este registro já existe. Atualize a página e tente novamente.",
      },
      { status: 409 },
    );
  console.error("[booking]", error);
  return Response.json(
    { error: "Não foi possível concluir. Tente novamente." },
    { status: 500 },
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (
    origin &&
    origin !== new URL(request.url).origin &&
    origin !== process.env.APP_URL?.replace(/\/$/, "")
  )
    throw new BookingError("Origem da solicitação inválida.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new BookingError("Origem da solicitação inválida.", 403);
}
