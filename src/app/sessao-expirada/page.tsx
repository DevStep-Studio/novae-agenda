"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { StateScreen } from "@/components/ui/state-screen";

export default function SessaoExpiradaPage() {
  const [loginHref, setLoginHref] = useState("/login");

  useEffect(() => {
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      setLoginHref(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, []);

  return (
    <StateScreen
      icon={Clock}
      title="Sua sessão expirou."
      description="Por segurança, você precisa entrar novamente para continuar de onde parou."
      actions={
        <a href={loginHref} className="state-screen-btn">
          Entrar novamente
        </a>
      }
    />
  );
}
