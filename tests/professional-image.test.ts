import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import {
  deleteClientImage,
  deleteProfessionalImage,
  saveClientImage,
  saveProfessionalImage,
} from "@/lib/storage";

const onePixelPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("professional and client image storage", () => {
  it("persists a validated professional image as a URL instead of database base64", async () => {
    const url = await saveProfessionalImage(onePixelPng);
    try {
      assert.match(url, /^\/uploads\/professionals\/[a-f0-9-]+\.png$/);
      const stored = await fs.readFile(path.join(process.cwd(), "public", url));
      assert.equal(stored[0], 0x89);
      assert.equal(stored[1], 0x50);
    } finally {
      await deleteProfessionalImage(url);
    }
  });

  it("persists a validated client image as a URL in uploads/clients folder", async () => {
    const url = await saveClientImage(onePixelPng);
    try {
      assert.match(url, /^\/uploads\/clients\/[a-f0-9-]+\.png$/);
      const stored = await fs.readFile(path.join(process.cwd(), "public", url));
      assert.equal(stored[0], 0x89);
      assert.equal(stored[1], 0x50);
    } finally {
      await deleteClientImage(url);
    }
  });

  it("rejects unsupported or forged image payloads", async () => {
    await assert.rejects(
      () => saveProfessionalImage("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="),
      /não suportado/,
    );
    await assert.rejects(
      () => saveClientImage("data:image/png;base64,bm90LWEtcG5n"),
      /PNG corrompido/,
    );
  });
});
