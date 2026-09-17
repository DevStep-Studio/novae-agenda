import assert from "node:assert/strict";
import test from "node:test";
import {
  isManagementView,
  managementPath,
  managementViewFromRoute,
} from "../src/lib/management-routes";

test("management routes preserve every dashboard section on reload", () => {
  const views = [
    "agenda",
    "clientes",
    "servicos",
    "equipe",
    "financeiro",
    "relatorios",
    "assinatura",
    "configuracoes",
    "notificacoes",
    "perfil",
    "link-agendamento",
  ] as const;

  for (const view of views) {
    assert.equal(isManagementView(view), true);
    assert.equal(managementViewFromRoute(view), view);
    assert.equal(managementPath(view), `/gestao/${view}`);
  }
});

test("management routes use a canonical dashboard path and reject unknown views", () => {
  assert.equal(managementPath("dashboard"), "/gestao");
  assert.equal(managementViewFromRoute(undefined), "dashboard");
  assert.equal(managementViewFromRoute("rota-inexistente"), "dashboard");
  assert.equal(isManagementView("rota-inexistente"), false);
});

test("middleware redirects unauthenticated users from /gestao/* to /login with returnTo", async () => {
  const { NextRequest } = await import("next/server");
  const { middleware } = await import("../src/middleware");
  const req = new NextRequest("http://localhost:3000/gestao/perfil");
  const res = middleware(req);
  assert.equal(res.status, 307);
  assert.equal(res.headers.get("location"), "http://localhost:3000/login?returnTo=%2Fgestao%2Fperfil");
});

test("middleware allows authenticated users with agenda_session cookie to access /gestao/*", async () => {
  const { NextRequest } = await import("next/server");
  const { middleware } = await import("../src/middleware");
  const req = new NextRequest("http://localhost:3000/gestao/perfil", {
    headers: {
      cookie: "agenda_session=valid_jwt_cookie",
    },
  });
  const res = middleware(req);
  assert.equal(res.status, 200);
});

