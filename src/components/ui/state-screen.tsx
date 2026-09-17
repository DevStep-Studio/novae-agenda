import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ReserveiLogo } from "@/components/brand/novae-logo";

export function StateScreen({
  icon: Icon,
  title,
  description,
  actions,
  showLogo = true,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
  showLogo?: boolean;
}) {
  return (
    <div className="state-screen">
      {showLogo && <ReserveiLogo size={32} />}
      <span className="state-screen-icon">
        <Icon size={28} />
      </span>
      <h1>{title}</h1>
      <p className="state-screen-desc">{description}</p>
      {actions && <div className="state-screen-actions">{actions}</div>}
    </div>
  );
}
