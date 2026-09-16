import "dotenv/config";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  serviceCategories,
  services,
  users,
} from "@/db/schema";
import { hasMinRole, normalizeRole, type Role } from "@/lib/auth";

describe("Service Categories Management & Integrity", () => {
  let companyAId: string;
  let companyBId: string;
  let categoryAId: string;
  let categoryBId: string;
  let serviceA1Id: string;
  let serviceA2Id: string;

  before(async () => {
    companyAId = crypto.randomUUID();
    companyBId = crypto.randomUUID();

    await db.insert(companies).values([
      { id: companyAId, name: "Studio A" },
      { id: companyBId, name: "Studio B" },
    ]);
  });

  after(async () => {
    // Cleanup test data
    await db.delete(services).where(eq(services.companyId, companyAId));
    await db.delete(services).where(eq(services.companyId, companyBId));
    await db.delete(serviceCategories).where(eq(serviceCategories.companyId, companyAId));
    await db.delete(serviceCategories).where(eq(serviceCategories.companyId, companyBId));
    await db.delete(companies).where(eq(companies.id, companyAId));
    await db.delete(companies).where(eq(companies.id, companyBId));
  });

  it("1. Creates a category tied to the company", async () => {
    categoryAId = crypto.randomUUID();
    await db.insert(serviceCategories).values({
      id: categoryAId,
      companyId: companyAId,
      name: "FlahsArt", // Intentional typo
    });

    const [cat] = await db
      .select()
      .from(serviceCategories)
      .where(and(eq(serviceCategories.id, categoryAId), eq(serviceCategories.companyId, companyAId)));

    assert.ok(cat, "Category should be created");
    assert.equal(cat.name, "FlahsArt");
    assert.equal(cat.companyId, companyAId);
  });

  it("2. Edits/renames the category safely", async () => {
    const updatedName = "FlashArt"; // Corrected typo

    await db
      .update(serviceCategories)
      .set({ name: updatedName })
      .where(and(eq(serviceCategories.id, categoryAId), eq(serviceCategories.companyId, companyAId)));

    const [cat] = await db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.id, categoryAId));

    assert.ok(cat);
    assert.equal(cat.name, "FlashArt", "Category name should be updated to FlashArt");
  });

  it("3. Linking services and deleting category sets services.categoryId to null (unlinks)", async () => {
    serviceA1Id = crypto.randomUUID();
    serviceA2Id = crypto.randomUUID();

    await db.insert(services).values([
      {
        id: serviceA1Id,
        companyId: companyAId,
        name: "Tatuagem Flash Pequena",
        categoryId: categoryAId,
        price: "150.00",
        durationMinutes: 45,
      },
      {
        id: serviceA2Id,
        companyId: companyAId,
        name: "Tatuagem Flash Média",
        categoryId: categoryAId,
        price: "250.00",
        durationMinutes: 90,
      },
    ]);

    // Verify services have the category
    const linkedServices = await db
      .select()
      .from(services)
      .where(eq(services.categoryId, categoryAId));
    assert.equal(linkedServices.length, 2);

    // Simulate DELETE category logic:
    // First unlink services to null
    await db
      .update(services)
      .set({ categoryId: null })
      .where(and(eq(services.categoryId, categoryAId), eq(services.companyId, companyAId)));

    // Delete category
    await db
      .delete(serviceCategories)
      .where(and(eq(serviceCategories.id, categoryAId), eq(serviceCategories.companyId, companyAId)));

    // Verify category is deleted
    const [deletedCat] = await db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.id, categoryAId));
    assert.equal(deletedCat, undefined, "Category row must be deleted");

    // Verify services still exist but categoryId is null
    const [s1] = await db.select().from(services).where(eq(services.id, serviceA1Id));
    const [s2] = await db.select().from(services).where(eq(services.id, serviceA2Id));
    assert.ok(s1, "Service 1 must still exist");
    assert.ok(s2, "Service 2 must still exist");
    assert.equal(s1.categoryId, null, "Service 1 categoryId must be null");
    assert.equal(s2.categoryId, null, "Service 2 categoryId must be null");
  });

  it("4. Multitenant isolation: Company A cannot edit or delete Company B's category", async () => {
    categoryBId = crypto.randomUUID();
    await db.insert(serviceCategories).values({
      id: categoryBId,
      companyId: companyBId,
      name: "Piercing",
    });

    // Attempt update using companyAId as tenant filter
    const updateResult = await db
      .update(serviceCategories)
      .set({ name: "Piercing Modificado" })
      .where(and(eq(serviceCategories.id, categoryBId), eq(serviceCategories.companyId, companyAId)));

    // Category in Company B must be unchanged
    const [catB] = await db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.id, categoryBId));
    assert.equal(catB.name, "Piercing", "Company B category must not be changed by Company A");

    // Attempt delete using companyAId as tenant filter
    await db
      .delete(serviceCategories)
      .where(and(eq(serviceCategories.id, categoryBId), eq(serviceCategories.companyId, companyAId)));

    const [stillExists] = await db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.id, categoryBId));
    assert.ok(stillExists, "Company B category must not be deleted by Company A");
  });

  it("5. Role hierarchy: only employee or higher can manage categories", () => {
    const roles: Role[] = ["client", "employee", "manager", "admin", "owner", "superadmin"];
    const allowed = roles.filter((r) => hasMinRole(r, "employee"));

    assert.deepEqual(allowed, ["employee", "manager", "admin", "owner", "superadmin"]);
    assert.equal(hasMinRole(normalizeRole("client"), "employee"), false);
    assert.equal(hasMinRole(normalizeRole("customer"), "employee"), false);
  });
});
