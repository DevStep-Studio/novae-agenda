import { requireRole } from "@/lib/auth";
import {
  getBookingPageRevisions,
  restoreBookingPageRevision,
} from "@/lib/booking/page-builder-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireRole("manager");
  if (gate.response) return gate.response;

  const companyId = gate.auth.user.companyId;

  try {
    const revisions = await getBookingPageRevisions(companyId);
    return Response.json({ data: revisions });
  } catch (err: any) {
    return Response.json(
      { error: err.message || "Erro ao carregar histórico de versões." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const gate = await requireRole("manager");
  if (gate.response) return gate.response;

  const companyId = gate.auth.user.companyId;

  try {
    const { revisionId } = await req.json();
    if (!revisionId) {
      return Response.json(
        { error: "revisionId é obrigatório." },
        { status: 400 },
      );
    }

    const result = await restoreBookingPageRevision(
      companyId,
      revisionId,
      gate.auth.user.userId,
    );

    return Response.json({
      success: true,
      message: `Versão ${result.versionNumber} restaurada com sucesso.`,
      data: result,
    });
  } catch (err: any) {
    return Response.json(
      { error: err.message || "Erro ao restaurar versão." },
      { status: err.status || 500 },
    );
  }
}
