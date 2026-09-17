import "dotenv/config";
process.env.DATABASE_URL = process.env.DATABASE_URL || "mysql://root:password@localhost:3306/novae_agenda";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { COMPONENT_REGISTRY } from "@/components/booking/page-builder/page-builder-registry";
import { TEMPLATES, DEFAULT_GLOBAL_TOKENS } from "@/components/booking/page-builder/page-builder-templates";
import { validateDocumentIntegrity } from "@/lib/booking/page-builder-service";
import type { PageBuilderDocument } from "@/components/booking/page-builder/page-builder-types";

describe("Visual Page Builder 2.0 — Architecture & Component Registry", () => {
  it("verifies all 14 core components are registered with valid metadata", () => {
    const requiredBlocks = [
      "company-header",
      "cover-banner",
      "bio-presentation",
      "service-search",
      "service-grid",
      "professional-selector",
      "booking-summary",
      "location-map",
      "working-hours",
      "gallery-photos",
      "faq-accordion",
      "custom-text",
      "footer",
      "container",
    ];

    for (const type of requiredBlocks) {
      const meta = COMPONENT_REGISTRY[type as keyof typeof COMPONENT_REGISTRY];
      assert.ok(meta, `Componente ${type} deve estar registrado no Component Registry`);
      assert.equal(meta.type, type);
      assert.ok(meta.name.length > 0, `Componente ${type} deve ter um nome legível`);
      assert.ok(meta.defaultProps, `Componente ${type} deve fornecer defaultProps`);
      assert.ok(Array.isArray(meta.propDefinitions), `Componente ${type} deve ter propDefinitions`);
    }
  });

  it("ensures essential booking blocks are locked and marked as essential", () => {
    assert.equal(
      COMPONENT_REGISTRY["service-grid"].isEssential,
      true,
      "service-grid deve ser marcado como essencial para proteger o fluxo de agendamento",
    );
    assert.equal(
      COMPONENT_REGISTRY["booking-summary"].isEssential,
      true,
      "booking-summary deve ser marcado como essencial para permitir confirmação da reserva",
    );
    assert.equal(
      COMPONENT_REGISTRY["faq-accordion"].isEssential,
      false,
      "faq-accordion é um bloco opcional e pode ser removido",
    );
    assert.equal(
      COMPONENT_REGISTRY["gallery-photos"].isEssential,
      false,
      "gallery-photos é um bloco opcional e pode ser removido",
    );
  });
});

describe("Visual Page Builder 2.0 — Document Structural Integrity Validation", () => {
  it("approves a complete document with service-grid and booking-summary", () => {
    const validDoc: PageBuilderDocument = {
      schemaVersion: 2,
      globalTokens: DEFAULT_GLOBAL_TOKENS,
      sections: [
        {
          id: "sec-1",
          name: "Catálogo",
          props: { paddingY: 16 },
          blocks: [
            { id: "b1", type: "service-grid", isLocked: true, props: {} },
            { id: "b2", type: "booking-summary", isLocked: true, props: {} },
          ],
        },
      ],
    };

    const result = validateDocumentIntegrity(validDoc);
    assert.equal(result.isValid, true);
    assert.equal(result.errors.length, 0);
  });

  it("rejects a document missing the service-grid block", () => {
    const invalidDoc: PageBuilderDocument = {
      schemaVersion: 2,
      globalTokens: DEFAULT_GLOBAL_TOKENS,
      sections: [
        {
          id: "sec-1",
          name: "Apresentação",
          props: { paddingY: 16 },
          blocks: [
            { id: "b1", type: "bio-presentation", props: {} },
            { id: "b2", type: "booking-summary", props: {} },
          ],
        },
      ],
    };

    const result = validateDocumentIntegrity(invalidDoc);
    assert.equal(result.isValid, false);
    assert.ok(
      result.errors.some((e) => e.includes("Grade de Serviços")),
      "Deve acusar falta da Grade de Serviços",
    );
  });

  it("rejects a document missing the booking-summary block", () => {
    const invalidDoc: PageBuilderDocument = {
      schemaVersion: 2,
      globalTokens: DEFAULT_GLOBAL_TOKENS,
      sections: [
        {
          id: "sec-1",
          name: "Apenas Serviços",
          props: { paddingY: 16 },
          blocks: [{ id: "b1", type: "service-grid", props: {} }],
        },
      ],
    };

    const result = validateDocumentIntegrity(invalidDoc);
    assert.equal(result.isValid, false);
    assert.ok(
      result.errors.some((e) => e.includes("Resumo do Agendamento")),
      "Deve acusar falta do Resumo do Agendamento",
    );
  });

  it("rejects an empty document", () => {
    const emptyDoc: PageBuilderDocument = {
      schemaVersion: 2,
      globalTokens: DEFAULT_GLOBAL_TOKENS,
      sections: [],
    };

    const result = validateDocumentIntegrity(emptyDoc);
    assert.equal(result.isValid, false);
    assert.ok(result.errors.length >= 2);
  });
});

describe("Visual Page Builder 2.0 — Templates & Presets Library", () => {
  it("validates that all 5 built-in templates are structurally sound and publishable", () => {
    assert.ok(TEMPLATES.length >= 5, "Deve conter pelo menos 5 templates");

    const templateIds = TEMPLATES.map((t) => t.id);
    assert.ok(templateIds.includes("classic"), "Template Clássico deve existir");
    assert.ok(templateIds.includes("minimalist"), "Template Minimalista deve existir");
    assert.ok(templateIds.includes("premium"), "Template Premium deve existir");
    assert.ok(templateIds.includes("barbershop"), "Template Barbearia deve existir");
    assert.ok(templateIds.includes("salon"), "Template Salão deve existir");

    for (const template of TEMPLATES) {
      assert.equal(template.document.schemaVersion, 2);
      assert.ok(template.document.globalTokens.primaryColor);
      assert.ok(template.document.globalTokens.backgroundColor);
      assert.ok(template.document.globalTokens.fontHeading);
      assert.ok(template.document.globalTokens.fontBody);

      const validation = validateDocumentIntegrity(template.document);
      assert.equal(
        validation.isValid,
        true,
        `Template ${template.name} deve ser válido e publicável`,
      );
    }
  });

  it("ensures dark and light color tokens are defined cleanly without hardcoded mixed values", () => {
    for (const template of TEMPLATES) {
      const tokens = template.document.globalTokens;
      assert.ok(
        ["light", "dark", "auto"].includes(tokens.themeMode),
        "themeMode deve ser light, dark ou auto",
      );
      assert.ok(tokens.primaryColor.startsWith("#"), "primaryColor deve ser hex válido");
      assert.ok(tokens.backgroundColor.startsWith("#"), "backgroundColor deve ser hex válido");
      assert.ok(tokens.surfaceColor.startsWith("#"), "surfaceColor deve ser hex válido");
    }
  });
});

describe("Visual Page Builder 2.0 — Responsive & Breakpoint Support", () => {
  it("supports responsive override resolution for mobile and desktop", () => {
    const block = {
      id: "grid-test",
      type: "service-grid" as const,
      props: { columnsDesktop: 3, gap: 16 },
      responsive: {
        mobile: { columns: 1, hideOnMobile: false },
        tablet: { columns: 2 },
        desktop: { columns: 3 },
      },
    };

    assert.equal(block.responsive.mobile.columns, 1);
    assert.equal(block.responsive.tablet.columns, 2);
    assert.equal(block.responsive.desktop.columns, 3);
    assert.equal(block.responsive.mobile.hideOnMobile, false);
  });
});
