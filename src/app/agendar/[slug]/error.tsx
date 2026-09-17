"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
import { b, PublicFrame } from "@/components/booking/primitives";

export default function AgendarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep the raw error in the server/browser console for debugging —
    // never shown to the visitor (brief item #72).
    console.error("Erro na página de agendamento:", error);
  }, [error]);

  const isNotFound =
    error?.digest === "NEXT_NOT_FOUND" ||
    error?.message?.includes("NEXT_NOT_FOUND") ||
    error?.message?.includes("não está disponível") ||
    error?.message?.includes("não encontrada");

  if (isNotFound) {
    return (
      <PublicFrame>
        <main className={b.main} style={{ textAlign: "center", padding: "64px 20px" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(220, 255, 76, 0.1)",
              border: "1px solid rgba(220, 255, 76, 0.2)",
              color: "var(--booking-primary, #dcff4c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <Search size={24} />
          </div>
          <h1 className={b.title} style={{ fontSize: "24px", marginBottom: "8px" }}>
            Estabelecimento não encontrado
          </h1>
          <p className={b.subtitle} style={{ maxWidth: 440, margin: "0 auto 24px", fontSize: "15px", color: "var(--booking-text-muted, #9db8ac)" }}>
            Não encontramos nenhuma página de agendamento neste endereço. Verifique se o link foi digitado corretamente.
          </p>
          <Link
            href="/"
            className={b.button}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              maxWidth: 240,
              margin: "0 auto",
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={16} /> Voltar ao início
          </Link>
        </main>
      </PublicFrame>
    );
  }

  return (
    <PublicFrame>
      <main className={b.main} style={{ textAlign: "center", padding: "64px 20px" }}>
        <h1 className={b.title} style={{ fontSize: "24px", marginBottom: "8px" }}>
          Não foi possível carregar esta página.
        </h1>
        <p className={b.subtitle} style={{ maxWidth: 440, margin: "0 auto 24px", fontSize: "15px", color: "var(--booking-text-muted, #9db8ac)" }}>
          Ocorreu um problema ao carregar o agendamento. Tente novamente em instantes.
        </p>
        <button
          type="button"
          className={b.button}
          onClick={() => reset()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            maxWidth: 220,
            margin: "0 auto",
          }}
        >
          <RefreshCw size={16} /> Tentar novamente
        </button>
      </main>
    </PublicFrame>
  );
}
