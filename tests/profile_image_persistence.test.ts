import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import path from "path";
import { saveBrandingImage } from "../src/lib/storage";

test("Profile & Branding Images — Persistence, Storage & Route Serving", async (t) => {
  const uploadsRoot = path.join(process.cwd(), "public", "uploads", "branding");
  const testFilesCreated: string[] = [];

  t.after(async () => {
    // Cleanup any test files generated during the run
    for (const fileUrl of testFilesCreated) {
      try {
        const filePath = path.join(process.cwd(), "public", fileUrl);
        await fs.unlink(filePath);
      } catch {}
    }
  });

  await t.test("1. External presets and URLs are preserved without filesystem duplication", async () => {
    const presetUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80";
    const result = await saveBrandingImage(presetUrl);
    assert.equal(result, presetUrl, "External image URL should be preserved intact");
  });

  await t.test("2. Base64 WebP image is persisted to disk and returns a valid public /uploads/ path", async () => {
    // Valid 1x1 WEBP
    const webpBase64 = "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA=";
    const result = await saveBrandingImage(webpBase64);
    testFilesCreated.push(result);

    assert.match(result, /^\/uploads\/branding\/[a-f0-9-]+\.webp$/, "Should generate safe UUID webp path");
    const fullPath = path.join(process.cwd(), "public", result);
    const stats = await fs.stat(fullPath);
    assert.ok(stats.isFile(), "Saved file must physically exist on disk");
    assert.ok(stats.size > 0, "Saved file must have nonzero size");
  });

  await t.test("3. Uploading a replacement image cleans up the previous local image file", async () => {
    const initialBase64 = "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA=";
    const firstUrl = await saveBrandingImage(initialBase64);
    testFilesCreated.push(firstUrl);

    const firstFullPath = path.join(process.cwd(), "public", firstUrl);
    assert.ok((await fs.stat(firstFullPath)).isFile(), "Initial file exists");

    const replacementBase64 = "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA=";
    const secondUrl = await saveBrandingImage(replacementBase64, firstUrl);
    testFilesCreated.push(secondUrl);

    assert.notEqual(firstUrl, secondUrl, "Replacement must generate a new filename");

    // Verify first file was safely deleted
    let firstFileExists = true;
    try {
      await fs.stat(firstFullPath);
    } catch {
      firstFileExists = false;
    }
    assert.equal(firstFileExists, false, "Previous file should be unlinked on replacement");

    // Verify second file exists
    const secondFullPath = path.join(process.cwd(), "public", secondUrl);
    assert.ok((await fs.stat(secondFullPath)).isFile(), "New file must exist on disk");
  });

  await t.test("4. Invalid image payloads or malicious extensions are rejected", async () => {
    await assert.rejects(
      async () => saveBrandingImage("data:image/exe;base64,TVqQAAMAAAAEAAAA"),
      /Formato de imagem não suportado/,
      "Non-image MIME types must be rejected",
    );

    await assert.rejects(
      async () => saveBrandingImage("data:image/webp;base64,NOT_A_VALID_WEBP_CONTENT"),
      /Arquivo WebP corrompido ou inválido/,
      "Corrupted magic byte headers must be rejected",
    );
  });
});
