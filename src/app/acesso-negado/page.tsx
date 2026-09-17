"use client";

import { ShieldOff } from "lucide-react";
import { StoreProvider, useStore } from "@/store/store";
import { StateScreen } from "@/components/ui/state-screen";

function destinationFor(session: ReturnType<typeof useStore>["session"]) {
  if (!session) return { href: "/login", label: "Ir para o login" };
  if (session.primaryRole === "superadmin" || session.targetPortal === "/admin") {
    return { href: "/admin", label: "Voltar para o painel" };
  }
  if (session.primaryRole === "employee" || session.targetPortal === "/profissional") {
    return { href: "/profissional", label: "Voltar para sua agenda" };
  }
  if (session.primaryRole === "client" || session.targetPortal === "/minhas-reservas" || session.targetPortal === "/cliente") {
    return { href: "/minhas-reservas", label: "Voltar para minhas reservas" };
  }
  return { href: "/gestao", label: "Voltar para o painel" };
}

function AccessDeniedContent() {
  const { session, loading } = useStore();

  if (loading) {
    return (
      <div className="boot-screen">
        <span className="boot-spinner" />
      </div>
    );
  }

  const destination = destinationFor(session);

  return (
    <StateScreen
      icon={ShieldOff}
      title="Acesso negado."
      description="Você não tem permissão para acessar esta página com a conta atual."
      actions={
        <a href={destination.href} className="state-screen-btn">
          {destination.label}
        </a>
      }
    />
  );
}

export default function AcessoNegadoPage() {
  return (
    <StoreProvider>
      <AccessDeniedContent />
    </StoreProvider>
  );
}
