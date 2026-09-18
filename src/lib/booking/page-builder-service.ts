import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  bookingPages,
  bookingPageRevisions,
  companies,
  companySettings,
  users,
} from "@/db/schema";
import type {
  PageBuilderDocument,
  GlobalTokens,
  PageSection,
  PageBlock,
} from "@/components/booking/page-builder/page-builder-types";
import {
  DEFAULT_GLOBAL_TOKENS,
  TEMPLATES,
} from "@/components/booking/page-builder/page-builder-templates";
import { BookingError } from "./errors";

/**
 * Validates document structural integrity for public booking.
 * Must include essential booking blocks (service-grid and booking-summary).
 */
export function validateDocumentIntegrity(doc: PageBuilderDocument): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!doc.sections || doc.sections.length === 0) {
    errors.push("A página precisa conter pelo menos uma seção.");
  }

  let hasServiceGrid = false;
  let hasBookingSummary = false;

  function scanBlocks(blocks: PageBlock[]) {
    for (const block of blocks) {
      if (block.type === "service-grid") hasServiceGrid = true;
      if (block.type === "booking-summary") hasBookingSummary = true;
      if (block.children && block.children.length > 0) {
        scanBlocks(block.children);
      }
    }
  }

  for (const section of doc.sections || []) {
    if (section.blocks) {
      scanBlocks(section.blocks);
    }
  }

  if (!hasServiceGrid) {
    errors.push(
      "A página precisa conter a 'Grade de Serviços' para permitir que os clientes escolham o atendimento.",
    );
  }

  if (!hasBookingSummary) {
    errors.push(
      "A página precisa conter o 'Resumo do Agendamento' para permitir a confirmação do horário.",
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Synthesizes an initial PageBuilderDocument from legacy branding settings
 * ensuring existing customers never lose their colors, logo, cover or sections.
 */
export async function synthesizeMigratedDocument(
  companyId: string,
): Promise<PageBuilderDocument> {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId));

  const settingsRows = await db
    .select()
    .from(companySettings)
    .where(eq(companySettings.companyId, companyId));

  const settingsMap = Object.fromEntries(
    settingsRows.map((s) => [s.key, s.value]),
  );

  const primaryColor =
    company?.publicColor ||
    company?.primaryColor ||
    DEFAULT_GLOBAL_TOKENS.primaryColor;
  const themeMode = (settingsMap.booking_theme_mode ||
    settingsMap.bookingThemeMode ||
    "dark") as "auto" | "light" | "dark";
  const fontFamily =
    settingsMap.booking_font_family ||
    settingsMap.bookingFontFamily ||
    "Outfit";

  const globalTokens: GlobalTokens = {
    ...DEFAULT_GLOBAL_TOKENS,
    primaryColor,
    themeMode,
    fontHeading: fontFamily,
    fontBody: fontFamily === "Playfair Display" ? "Outfit" : fontFamily,
    backgroundColor: themeMode === "light" ? "#f8fafc" : "#09090b",
    surfaceColor: themeMode === "light" ? "#ffffff" : "#18181b",
    textColor: themeMode === "light" ? "#0f172a" : "#f4f4f5",
    textMutedColor: themeMode === "light" ? "#64748b" : "#a1a1aa",
    borderColor: themeMode === "light" ? "#e2e8f0" : "#27272a",
  };

  const defaultTemplate = TEMPLATES.find((t) => t.id === "classic")!;
  const baseDoc = JSON.parse(JSON.stringify(defaultTemplate.document)) as PageBuilderDocument;

  baseDoc.name = company?.name ? `Página de ${company.name}` : "Página Principal";
  baseDoc.globalTokens = globalTokens;

  return baseDoc;
}

/**
 * Retrieves the PageBuilder record for a company, migrating legacy settings if needed.
 */
export async function getOrCreateBookingPage(companyId: string) {
  const [existing] = await db
    .select()
    .from(bookingPages)
    .where(eq(bookingPages.companyId, companyId));

  if (existing) {
    return {
      id: existing.id,
      companyId: existing.companyId,
      status: existing.status as "draft" | "published",
      draftLayout: existing.draftLayout as PageBuilderDocument,
      publishedLayout: existing.publishedLayout as PageBuilderDocument | null,
      globalTokens: (existing.globalTokens ||
        DEFAULT_GLOBAL_TOKENS) as GlobalTokens,
      publishedAt: existing.publishedAt?.toISOString() || null,
      publishedBy: existing.publishedBy,
      lastEditedBy: existing.lastEditedBy,
      createdAt: existing.createdAt.toISOString(),
      updatedAt: existing.updatedAt.toISOString(),
    };
  }

  // Create initial migrated draft record
  const initialDoc = await synthesizeMigratedDocument(companyId);
  const newId = crypto.randomUUID();

  await db.insert(bookingPages).values({
    id: newId,
    companyId,
    schemaVersion: 2,
    draftLayout: initialDoc,
    publishedLayout: null,
    globalTokens: initialDoc.globalTokens,
    status: "draft",
    publishedAt: null,
  });

  // Record version 1
  await db.insert(bookingPageRevisions).values({
    id: crypto.randomUUID(),
    pageId: newId,
    companyId,
    versionNumber: 1,
    name: "Migração Automática do Branding Studio",
    layout: initialDoc,
    globalTokens: initialDoc.globalTokens,
    createdAt: new Date(),
  });

  return {
    id: newId,
    companyId,
    status: "draft" as const,
    draftLayout: initialDoc,
    publishedLayout: null,
    globalTokens: initialDoc.globalTokens,
    publishedAt: null,
    publishedBy: null,
    lastEditedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Saves a draft document and records revision.
 */
export async function saveDraftLayout(
  companyId: string,
  doc: PageBuilderDocument,
  userId?: string,
) {
  const page = await getOrCreateBookingPage(companyId);

  // Update draft
  await db
    .update(bookingPages)
    .set({
      draftLayout: doc,
      globalTokens: doc.globalTokens,
      status: "draft",
      lastEditedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(bookingPages.id, page.id));

  return { success: true, pageId: page.id };
}

/**
 * Publishes the draft document after validating booking integrity.
 */
export async function publishDocumentLayout(
  companyId: string,
  userId?: string,
) {
  const page = await getOrCreateBookingPage(companyId);
  const doc = page.draftLayout;

  const { isValid, errors } = validateDocumentIntegrity(doc);
  if (!isValid) {
    throw new BookingError(
      `Não é possível publicar: ${errors.join(" ")}`,
      400,
    );
  }

  // Get current max version number for revisions
  const [latestRevision] = await db
    .select({ versionNumber: bookingPageRevisions.versionNumber })
    .from(bookingPageRevisions)
    .where(eq(bookingPageRevisions.pageId, page.id))
    .orderBy(desc(bookingPageRevisions.versionNumber))
    .limit(1);

  const nextVersion = (latestRevision?.versionNumber ?? 0) + 1;

  // Update published layout
  const now = new Date();
  await db
    .update(bookingPages)
    .set({
      publishedLayout: doc,
      globalTokens: doc.globalTokens,
      status: "published",
      publishedAt: now,
      publishedBy: userId,
      lastEditedBy: userId,
      updatedAt: now,
    })
    .where(eq(bookingPages.id, page.id));

  // Record revision
  await db.insert(bookingPageRevisions).values({
    id: crypto.randomUUID(),
    pageId: page.id,
    companyId,
    versionNumber: nextVersion,
    name: `Versão ${nextVersion} (Publicada)`,
    layout: doc,
    globalTokens: doc.globalTokens,
    createdBy: userId,
    createdAt: now,
  });

  return {
    success: true,
    versionNumber: nextVersion,
    publishedAt: now.toISOString(),
  };
}

/**
 * Lists history of revisions for a company's booking page.
 */
export async function getBookingPageRevisions(companyId: string) {
  const page = await getOrCreateBookingPage(companyId);

  const revisions = await db
    .select({
      id: bookingPageRevisions.id,
      versionNumber: bookingPageRevisions.versionNumber,
      name: bookingPageRevisions.name,
      createdAt: bookingPageRevisions.createdAt,
      createdBy: bookingPageRevisions.createdBy,
      layout: bookingPageRevisions.layout,
      globalTokens: bookingPageRevisions.globalTokens,
      authorName: users.name,
    })
    .from(bookingPageRevisions)
    .leftJoin(users, eq(bookingPageRevisions.createdBy, users.id))
    .where(eq(bookingPageRevisions.pageId, page.id))
    .orderBy(desc(bookingPageRevisions.versionNumber));

  return revisions.map((r) => ({
    id: r.id,
    versionNumber: r.versionNumber,
    name: r.name,
    createdAt: r.createdAt.toISOString(),
    createdBy: r.createdBy,
    authorName: r.authorName || "Administrador",
    layout: r.layout as PageBuilderDocument,
    globalTokens: (r.globalTokens || DEFAULT_GLOBAL_TOKENS) as GlobalTokens,
  }));
}

/**
 * Restores a specific revision into the draft.
 */
export async function restoreBookingPageRevision(
  companyId: string,
  revisionId: string,
  userId?: string,
) {
  const page = await getOrCreateBookingPage(companyId);

  const [revision] = await db
    .select()
    .from(bookingPageRevisions)
    .where(
      and(
        eq(bookingPageRevisions.id, revisionId),
        eq(bookingPageRevisions.companyId, companyId),
      ),
    );

  if (!revision) {
    throw new BookingError("Versão não encontrada.", 404);
  }

  const restoredDoc = revision.layout as PageBuilderDocument;

  await db
    .update(bookingPages)
    .set({
      draftLayout: restoredDoc,
      globalTokens: restoredDoc.globalTokens,
      status: "draft",
      lastEditedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(bookingPages.id, page.id));

  return {
    success: true,
    restoredDoc,
    versionNumber: revision.versionNumber,
  };
}
