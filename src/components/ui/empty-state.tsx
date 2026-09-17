"use client";

import type { ReactNode } from "react";
import { CalendarDays, type LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon = CalendarDays,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={22} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
