"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/use-online-status";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <WifiOff size={15} />
      <span>Sem conexão com a internet. Algumas ações podem não funcionar até a conexão voltar.</span>
    </div>
  );
}
