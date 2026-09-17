"use client";

import { useEffect } from "react";
import { ServerCrash } from "lucide-react";
import { StateScreen } from "@/components/ui/state-screen";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <StateScreen
      icon={ServerCrash}
      title="Algo deu errado."
      description="Encontramos um erro inesperado. Você pode tentar novamente ou voltar para o início."
      actions={
        <>
          <button type="button" className="state-screen-btn" onClick={() => reset()}>
            Tentar novamente
          </button>
          <a href="/" className="state-screen-btn-secondary">
            Ir para o início
          </a>
        </>
      }
    />
  );
}
