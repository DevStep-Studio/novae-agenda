import test from "node:test";
import assert from "node:assert/strict";

import { Role } from "../src/shared/types";

test("Mobile Authentication & Session Integrity Suite", async (t) => {
  await t.test("1. Cookie parsing and multi-cookie header merging logic", () => {
    const RELEVANT_COOKIE_NAMES = ["agenda_session", "active_company_id"];
    
    function mergeCookies(existing: string | null, setCookieHeader: string): string {
      const current = new Map<string, string>();
      for (const part of (existing ?? "").split(";")) {
        const [name, ...rest] = part.trim().split("=");
        if (name && rest.length) current.set(name, rest.join("="));
      }

      const cookieStrings = setCookieHeader.split(/,(?=\s*[^;=\s]+=)/);
      for (const cookieString of cookieStrings) {
        const firstPair = cookieString.trim().split(";")[0];
        const [name, ...rest] = firstPair.split("=");
        if (name && RELEVANT_COOKIE_NAMES.includes(name.trim())) {
          current.set(name.trim(), rest.join("="));
        }
      }

      return Array.from(current.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");
    }

    // Single session cookie set
    const single = mergeCookies(null, "agenda_session=jwt_token_123; Path=/; HttpOnly; SameSite=Lax");
    assert.equal(single, "agenda_session=jwt_token_123");

    // Multiple cookies in one header
    const combined = mergeCookies(
      single,
      "active_company_id=comp_456; Path=/; HttpOnly, tracking_id=ignore_me; Path=/"
    );
    assert.equal(combined, "agenda_session=jwt_token_123; active_company_id=comp_456");

    // Cookie update
    const updated = mergeCookies(combined, "agenda_session=jwt_token_999; Path=/; HttpOnly");
    assert.equal(updated, "agenda_session=jwt_token_999; active_company_id=comp_456");
  });

  await t.test("2. API response unwrapping compatibility ({ data: T } vs direct T)", () => {
    function unwrapApiResponse<T>(body: any): T {
      if (body !== null && typeof body === "object" && "data" in body) {
        return body.data as T;
      }
      return body as T;
    }

    // Standard wrapped payload
    const wrapped = { ok: true, data: { userId: "user_1", role: "owner" } };
    assert.deepEqual(unwrapApiResponse(wrapped), { userId: "user_1", role: "owner" });

    // Direct object payload
    const direct = { userId: "user_2", role: "employee" };
    assert.deepEqual(unwrapApiResponse(direct), { userId: "user_2", role: "employee" });

    // Status boolean payload
    const statusPayload = { ok: true };
    assert.deepEqual(unwrapApiResponse(statusPayload), { ok: true });
  });

  await t.test("3. Profile-based role routing gate logic", () => {
    function resolveRouteForRole(role: Role): string {
      switch (role) {
        case "owner":
        case "admin":
        case "manager":
          return "/(owner)";
        case "employee":
          return "/(employee)";
        case "client":
          return "/(customer)";
        default:
          return "/(customer)";
      }
    }

    assert.equal(resolveRouteForRole("owner"), "/(owner)");
    assert.equal(resolveRouteForRole("admin"), "/(owner)");
    assert.equal(resolveRouteForRole("manager"), "/(owner)");
    assert.equal(resolveRouteForRole("employee"), "/(employee)");
    assert.equal(resolveRouteForRole("client"), "/(customer)");
    assert.equal(resolveRouteForRole("superadmin" as any), "/(customer)");
  });

  await t.test("4. Password strength validator", () => {
    const getPasswordStrength = (pass: string) => {
      let score = 0;
      if (pass.length >= 8) score++;
      if (/[A-Z]/.test(pass)) score++;
      if (/[0-9]/.test(pass)) score++;
      if (/[^A-Za-z0-9]/.test(pass)) score++;
      return score;
    };

    assert.equal(getPasswordStrength(""), 0);
    assert.equal(getPasswordStrength("short"), 0);
    assert.equal(getPasswordStrength("password123"), 2); // >=8 + number
    assert.equal(getPasswordStrength("Password123"), 3); // >=8 + number + uppercase
    assert.equal(getPasswordStrength("Password123!"), 4); // >=8 + number + uppercase + symbol
  });

  await t.test("5. Dynamic Metro API Base URL Resolution", () => {
    function resolveApiUrl(devHostUri?: string, envVar?: string): string {
      if (devHostUri) {
        const host = devHostUri.split(":")[0];
        if (host && host !== "localhost" && host !== "127.0.0.1") {
          return `http://${host}:3000`;
        }
      }
      if (envVar) {
        return envVar.replace(/\/$/, "");
      }
      return "http://localhost:3000";
    }

    // Metro on physical Wi-Fi
    assert.equal(resolveApiUrl("192.168.1.5:8081"), "http://192.168.1.5:3000");

    // Static ENV fallback when no dynamic host
    assert.equal(resolveApiUrl(undefined, "http://10.0.0.50:3000/"), "http://10.0.0.50:3000");

    // Localhost fallback
    assert.equal(resolveApiUrl("localhost:8081"), "http://localhost:3000");
  });
});
