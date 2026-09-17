import { requireRole } from "@/lib/auth";
import {
  getOrCreateBookingPage,
  saveDraftLayout,
  publishDocumentLayout,
} from "@/lib/booking/page-builder-service";
import { publicCatalog } from "@/lib/booking/catalog";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireRole("manager");
  if (gate.response) return gate.response;

  const companyId = gate.auth.user.companyId;

  try {
    const page = await getOrCreateBookingPage(companyId);

    // Fetch real company catalog for the interactive preview
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId));

    let previewCatalog = null;
    if (company?.publicSlug) {
      try {
        previewCatalog = await publicCatalog(company.publicSlug);
      } catch {}
    }

    return Response.json({
      data: {
        id: page.id,
        status: page.status,
        draftLayout: page.draftLayout,
        publishedLayout: page.publishedLayout,
        globalTokens: page.globalTokens,
        publishedAt: page.publishedAt,
        catalog: previewCatalog,
      },
    });
  } catch (err: any) {
    return Response.json(
      { error: err.message || "Erro ao carregar layout da página." },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const gate = await requireRole("manager");
  if (gate.response) return gate.response;

  const companyId = gate.auth.user.companyId;

  try {
    const body = await req.json();
    if (!body.draftLayout) {
      return Response.json(
        { error: "draftLayout é obrigatório." },
        { status: 400 },
      );
    }

    await saveDraftLayout(companyId, body.draftLayout, gate.auth.user.userId);

    return Response.json({ success: true, message: "Rascunho salvo com sucesso." });
  } catch (err: any) {
    return Response.json(
      { error: err.message || "Erro ao salvar rascunho." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  // Publishing requires owner role or manager with full administrative privileges
  const gate = await requireRole("manager");
  if (gate.response) return gate.response;

  const companyId = gate.auth.user.companyId;

  try {
    const result = await publishDocumentLayout(companyId, gate.auth.user.userId);

    return Response.json({
      success: true,
      message: "Página publicada com sucesso!",
      versionNumber: result.versionNumber,
      publishedAt: result.publishedAt,
    });
  } catch (err: any) {
    return Response.json(
      { error: err.message || "Erro ao publicar página." },
      { status: err.status || 500 },
    );
  }
}
