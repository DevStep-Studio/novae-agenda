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
