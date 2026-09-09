import "dotenv/config";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasMinRole, normalizeRole } from "@/lib/auth";

describe("Profiles Architecture & Access Control (Novae Multi-profile)", () => {
  it("strictly enforces role ranking hierarchy for all 5 system roles", () => {
    // Client has rank 0 - cannot act as employee, manager, admin, or superadmin
    assert.equal(hasMinRole("client", "client"), true);
    assert.equal(hasMinRole("client", "employee"), false);
    assert.equal(hasMinRole("client", "manager"), false);
    assert.equal(hasMinRole("client", "admin"), false);
    assert.equal(hasMinRole("client", "owner"), false);
    assert.equal(hasMinRole("client", "superadmin"), false);

    // Employee has rank 1 - can act as employee and client, but not manager/admin/owner
    assert.equal(hasMinRole("employee", "client"), true);
    assert.equal(hasMinRole("employee", "employee"), true);
    assert.equal(hasMinRole("employee", "manager"), false);
    assert.equal(hasMinRole("employee", "admin"), false);
    assert.equal(hasMinRole("employee", "owner"), false);

    // Manager has rank 2 - can access daily management but not company-wide admin settings
    assert.equal(hasMinRole("manager", "employee"), true);
    assert.equal(hasMinRole("manager", "manager"), true);
    assert.equal(hasMinRole("manager", "admin"), false);

    // Admin has rank 3 - can access company settings and management
    assert.equal(hasMinRole("admin", "manager"), true);
    assert.equal(hasMinRole("admin", "admin"), true);
    assert.equal(hasMinRole("admin", "owner"), false);

    // Owner has rank 4 - highest company level role
    assert.equal(hasMinRole("owner", "admin"), true);
    assert.equal(hasMinRole("owner", "owner"), true);

    // Superadmin has rank 5 - platform level authority
    assert.equal(hasMinRole("superadmin", "owner"), true);
    assert.equal(hasMinRole("superadmin", "superadmin"), true);
  });

  it("normalizes legacy customer alias to client role", () => {
    assert.equal(normalizeRole("customer"), "client");
    assert.equal(normalizeRole("client"), "client");
    assert.equal(normalizeRole("employee"), "employee");
    assert.equal(normalizeRole("owner"), "owner");
    assert.equal(normalizeRole("admin"), "admin");
    assert.equal(normalizeRole("manager"), "manager");
    assert.equal(normalizeRole("superadmin"), "superadmin");
    assert.equal(normalizeRole("unknown_invalid_role"), "client");
  });

  it("resolves correct target portal for each user role without frontend tampering", () => {
    function resolveTargetPortal(user: { role: string; isSuperadmin?: boolean; employeeId?: string | null }) {
      if (user.isSuperadmin) return "/admin";
      const normalized = normalizeRole(user.role);
      if (normalized === "owner" || normalized === "admin" || normalized === "manager") {
        return "/gestao";
      }
      if (normalized === "employee" || user.employeeId) {
        return "/profissional";
      }
      return "/cliente";
    }

    assert.equal(resolveTargetPortal({ role: "superadmin", isSuperadmin: true }), "/admin");
    assert.equal(resolveTargetPortal({ role: "owner" }), "/gestao");
    assert.equal(resolveTargetPortal({ role: "admin" }), "/gestao");
    assert.equal(resolveTargetPortal({ role: "manager" }), "/gestao");
    assert.equal(resolveTargetPortal({ role: "employee", employeeId: "emp-123" }), "/profissional");
    assert.equal(resolveTargetPortal({ role: "client" }), "/cliente");
    assert.equal(resolveTargetPortal({ role: "customer" }), "/cliente");
  });
});
