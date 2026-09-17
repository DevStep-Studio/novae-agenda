"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-global-error]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <div className="state-screen">
          <span className="state-screen-icon" style={{ fontSize: 28 }}>
            ⚠
          </span>
          <h1>Algo deu errado.</h1>
          <p className="state-screen-desc">
            A aplicação encontrou um erro inesperado. Tente recarregar a página.
          </p>
          <div className="state-screen-actions">
            <button type="button" className="state-screen-btn" onClick={() => reset()}>
              Tentar novamente
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
