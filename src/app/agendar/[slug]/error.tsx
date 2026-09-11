"use client";

import { useEffect } from "react";
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

  return (
    <PublicFrame>
      <main className={b.main}>
        <h1 className={b.title}>Não foi possível carregar esta página.</h1>
        <p className={b.subtitle}>
          Ocorreu um problema ao carregar o agendamento. Tente novamente em instantes.
        </p>
        <button type="button" className={b.button} onClick={() => reset()}>
          Tentar novamente
        </button>
      </main>
    </PublicFrame>
  );
}
