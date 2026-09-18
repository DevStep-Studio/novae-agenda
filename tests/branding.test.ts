import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BRAND_PRESETS,
  calculateContrastRatio,
  calculateLuminance,
  createBrandPalette,
} from "@/lib/branding";

describe("booking branding palette", () => {
  it("derives readable CTA foregrounds for representative brand colors", () => {
    const colors = [
      ...BRAND_PRESETS.map((preset) => preset.hex),
      "#ff0000",
      "#ffb000",
      "#f8f8f0",
      "#000000",
    ];

    for (const color of colors) {
      const palette = createBrandPalette(color);
      const ratio = calculateContrastRatio(
        calculateLuminance(palette.brand),
        calculateLuminance(palette.brandContrast),
      );
      assert.ok(ratio >= 4.5, `${color} produced insufficient CTA contrast: ${ratio}`);
      assert.equal(palette.cssVariables["--brand-foreground"], palette.brandContrast);
    }
  });

  it("keeps the requested brand isolated in each generated palette", () => {
    const companyA = createBrandPalette("#dcff4c", "dark");
    const companyB = createBrandPalette("#2563eb", "light");
    assert.equal(companyA.brand, "#dcff4c");
    assert.equal(companyB.brand, "#2563eb");
    assert.notEqual(companyA.cssVariables["--brand"], companyB.cssVariables["--brand"]);
  });

  it("guarantees dark text on light buttons and white/near-white brand colors (Moa Tattoo)", () => {
    // Pure white and near-white brands like Moa Tattoo (#f5f5f5, #ffffff)
    const whitePalette = createBrandPalette("#ffffff", "light");
    assert.equal(whitePalette.isLight, true);
    assert.equal(whitePalette.brandContrast, "#08110d");
    assert.equal(whitePalette.cssVariables["--accent-contrast"], "#08110d");
    assert.equal(whitePalette.cssVariables["--accent-on-light"], "#08110d");

    const moaPalette = createBrandPalette("#f5f5f5", "light");
    assert.equal(moaPalette.isLight, true);
    assert.equal(moaPalette.brandContrast, "#08110d");
    assert.equal(moaPalette.cssVariables["--accent-contrast"], "#08110d");
    assert.equal(moaPalette.cssVariables["--accent-on-light"], "#08110d");

    // Reservei lime default (#dcff4c)
    const limePalette = createBrandPalette("#dcff4c", "light");
    assert.equal(limePalette.isLight, true);
    assert.equal(limePalette.brandContrast, "#08110d");
    assert.equal(limePalette.cssVariables["--accent-contrast"], "#08110d");
    assert.equal(limePalette.cssVariables["--accent-on-light"], "#08110d");

    // Contrast ratio against dark text must exceed WCAG AAA (7:1)
    const ratio = calculateContrastRatio(
      calculateLuminance(whitePalette.brand),
      calculateLuminance(whitePalette.brandContrast),
    );
    assert.ok(ratio >= 15, `White brand contrast ratio should be >= 15:1, got: ${ratio}`);
  });
});
