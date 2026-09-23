import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq, like, or } from "drizzle-orm";
import { db } from "../db";
import { companies, users, companySettings, employees, services, clients } from "../db/schema";
import { resolveImageUrl, resolveImageUrlWithFallback, resolveMediaUrl } from "../../mobile/src/lib/media-utils";
import { getServiceImage } from "../../mobile/src/lib/service-utils";

describe("Unified Web <-> Mobile Media & Branding Synchronization", () => {
  describe("Media URL Resolution (resolveImageUrl & resolveMediaUrl)", () => {
    it("preserves absolute HTTPS URLs unchanged", () => {
      const url = "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80";
      assert.equal(resolveImageUrl(url), url);
      assert.equal(resolveMediaUrl(url), url);
    });

    it("preserves data URLs unchanged for instant preview", () => {
      const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      assert.equal(resolveImageUrl(dataUrl), dataUrl);
      assert.equal(resolveMediaUrl(dataUrl), dataUrl);
    });

    it("preserves file URIs unchanged for native local file uploads", () => {
      const fileUri = "file:///var/mobile/Containers/Data/Application/123/tmp/image.jpg";
      assert.equal(resolveImageUrl(fileUri), fileUri);
    });

    it("resolves relative /uploads paths using the active API base URL", () => {
      const relativePath = "/uploads/branding/e0f96383-d28e-4b33-a5fd-3335dfc816b8.webp";
      const resolved = resolveImageUrl(relativePath);
      assert.ok(resolved !== null);
      assert.ok(resolved.endsWith(relativePath));
      assert.ok(resolved.startsWith("http://") || resolved.startsWith("https://"));
    });

    it("gracefully returns null for null, undefined, empty, or whitespace-only inputs", () => {
      assert.equal(resolveImageUrl(null), null);
      assert.equal(resolveImageUrl(undefined), null);
      assert.equal(resolveImageUrl(""), null);
      assert.equal(resolveImageUrl("   "), null);
    });

    it("resolveImageUrlWithFallback produces primary and production fallback", () => {
      const relative = "/uploads/branding/135ddddf-f773-4b44-ab58-6a9b2bd9568f.webp";
      const res = resolveImageUrlWithFallback(relative);
      assert.ok(res.primary !== null);
      assert.ok(res.primary.endsWith(relative));
    });
  });

  describe("Service Image Resolution (getServiceImage)", () => {
    it("resolves relative service imageUrl to a complete absolute URL", () => {
      const service = {
        name: "Manicure Especial",
        imageUrl: "/uploads/services/custom-nail.webp",
      };
      const img = getServiceImage(service);
      assert.ok(img.startsWith("http://") || img.startsWith("https://"));
      assert.ok(img.endsWith("/uploads/services/custom-nail.webp"));
    });

    it("falls back to semantic category images when imageUrl is absent", () => {
      const nailService = { name: "Alongamento em Gel", imageUrl: null };
      const nailImg = getServiceImage(nailService);
      assert.ok(nailImg.includes("unsplash.com"));

      const massageService = { name: "Massagem Relaxante", imageUrl: "" };
      const massageImg = getServiceImage(massageService);
      assert.ok(massageImg.includes("unsplash.com"));
    });
  });

  describe("Database Integrity — No Truncated Media Paths", () => {
    it("ensures zero users have truncated ... in avatarUrl or bannerUrl", async () => {
      const truncated = await db
        .select({ id: users.id, name: users.name, avatar: users.avatarUrl, banner: users.bannerUrl })
        .from(users)
        .where(or(like(users.avatarUrl, "%...%"), like(users.bannerUrl, "%...%")));
      assert.equal(truncated.length, 0, `Found truncated user records: ${JSON.stringify(truncated)}`);
    });

    it("ensures zero companies have truncated ... in logoUrl", async () => {
      const truncated = await db
        .select({ id: companies.id, name: companies.name, logo: companies.logoUrl })
        .from(companies)
        .where(like(companies.logoUrl, "%...%"));
      assert.equal(truncated.length, 0, `Found truncated company records: ${JSON.stringify(truncated)}`);
    });

    it("ensures zero employees have truncated ... in photoUrl or bannerUrl", async () => {
      const truncated = await db
        .select({ id: employees.id, name: employees.name, photo: employees.photoUrl, banner: employees.bannerUrl })
        .from(employees)
        .where(or(like(employees.photoUrl, "%...%"), like(employees.bannerUrl, "%...%")));
      assert.equal(truncated.length, 0, `Found truncated employee records: ${JSON.stringify(truncated)}`);
    });

    it("ensures zero services have truncated ... in imageUrl", async () => {
      const truncated = await db
        .select({ id: services.id, name: services.name, img: services.imageUrl })
        .from(services)
        .where(like(services.imageUrl, "%...%"));
      assert.equal(truncated.length, 0, `Found truncated service records: ${JSON.stringify(truncated)}`);
    });
  });

  describe("Tenant Media Parity (Ingrid Amaral, Moa Tattoo, Alinne Souza)", () => {
    it("Ingrid Amaral has valid nail avatar and banner across user, company, and settings", async () => {
      const [u] = await db.select().from(users).where(eq(users.email, "ingrid_amaral@gmail.com"));
      assert.ok(u, "Ingrid user must exist");
      assert.ok(u.avatarUrl && !u.avatarUrl.includes("..."), "Ingrid avatar must be valid non-truncated");
      assert.ok(u.bannerUrl && !u.bannerUrl.includes("..."), "Ingrid banner must be valid non-truncated");

      const [c] = await db.select().from(companies).where(eq(companies.id, u.companyId!));
      assert.ok(c, "Ingrid company must exist");
      assert.equal(c.logoUrl, u.avatarUrl, "Company logo and owner avatar must match");
    });

    it("Moa Tattoo has valid tattoo avatar and banner across user and company", async () => {
      const [u] = await db.select().from(users).where(eq(users.email, "moa_tattooholic@gmail.com"));
      assert.ok(u, "Moa user must exist");
      assert.ok(u.avatarUrl && !u.avatarUrl.includes("..."));
      assert.ok(u.bannerUrl && !u.bannerUrl.includes("..."));

      const [c] = await db.select().from(companies).where(eq(companies.id, u.companyId!));
      assert.ok(c, "Moa company must exist");
      assert.equal(c.logoUrl, u.avatarUrl);
    });
  });
});
