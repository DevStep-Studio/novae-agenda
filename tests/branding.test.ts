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
});
