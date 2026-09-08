import Link from "next/link";
import type { ReactNode } from "react";
import { UserRound } from "lucide-react";
import styles from "./booking.module.css";
export { styles as b };
export function PublicFrame({
  children,
  color,
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <div
      className={styles.page}
      style={color ? ({ "--accent": color } as React.CSSProperties) : undefined}
    >
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/">
            Nova<span>(e)</span>
          </Link>
          <a href="/meus-agendamentos" className={styles.headerLink}>
            <UserRound size={16} /> Meus agendamentos
          </a>
        </div>
      </header>
      {children}
      <footer className={styles.footer}>
        Agendamento online com Novae · Seu tempo bem cuidado.
      </footer>
    </div>
  );
}
export const money = (amount: number | string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(amount),
  );
export const duration = (minutes: number) =>
  `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h` : ""}${minutes % 60 ? ` ${minutes % 60}min` : ""}`.trim();
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <div className={styles.error} role="alert">
      {message}
    </div>
  ) : null;
}
export function Skeleton({ label = "Carregando…" }: { label?: string }) {
  return (
    <div role="status" aria-label={label}>
      <div className={styles.loadingLine} />
      <div className={styles.loading} />
      <span className={styles.muted}>{label}</span>
    </div>
  );
}
