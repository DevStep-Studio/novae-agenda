import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { UserRound } from "lucide-react";
import { createBrandPalette } from "@/lib/branding";
import styles from "./booking.module.css";
export { styles as b };

export function friendlyTimezone(tz?: string): string {
  if (
    !tz ||
    tz === "America/Sao_Paulo" ||
    tz === "America/Fortaleza" ||
    tz === "America/Recife" ||
    tz === "America/Bahia"
  ) {
    return "Horários no fuso de Brasília";
  }
  if (tz === "America/Manaus" || tz === "America/Boa_Vista")
    return "Horários no fuso do Amazonas (GMT-4)";
  if (tz === "America/Cuiaba" || tz === "America/Campo_Grande")
    return "Horários no fuso do MS/MT (GMT-4)";
  if (tz === "America/Rio_Branco") return "Horários no fuso do Acre (GMT-5)";
  if (tz === "America/Noronha")
    return "Horários no fuso de F. de Noronha (GMT-2)";
  return `Horários no fuso ${tz.replace("_", " ")}`;
}

export function PublicFrame({
  children,
  color,
  coverUrl,
  themeMode = "dark",
  company,
}: {
  children: ReactNode;
  color?: string;
  coverUrl?: string | null;
  themeMode?: "auto" | "light" | "dark";
  company?: {
    name: string;
    category?: string | null;
    logoUrl?: string | null;
    avatarUrl?: string | null;
    slug?: string;
    address?: string | null;
  };
}) {
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
    themeMode === "light" ? "light" : "dark",
  );

  useEffect(() => {
    if (themeMode === "auto") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setResolvedTheme(isDark ? "dark" : "light");

      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        setResolvedTheme(e.matches ? "dark" : "light");
      };
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    } else {
      setResolvedTheme(themeMode);
    }
  }, [themeMode]);

  const palette = createBrandPalette(color, resolvedTheme);

  return (
    <div
      className={`${styles.page} ${
        resolvedTheme === "light" ? styles.pageLight : styles.pageDark
      }`}
      style={palette.cssVariables as React.CSSProperties}
      data-theme={resolvedTheme}
    >
      {/* Optional Cover Header */}
      {coverUrl && (
        <div className={styles.coverBannerWrap}>
          <img
            src={coverUrl}
            alt=""
            className={styles.coverBannerImg}
            loading="eager"
          />
          <div className={styles.coverBannerOverlay} />
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerBrandGroup}>
            <Link className={styles.brand} href="/" title="Novae Agenda">
              Nova<span>(e)</span>
            </Link>
            {company && (
              <>
                <span className={styles.headerDivider}>/</span>
                <div className={styles.headerCompany}>
                  {company.logoUrl ? (
                    <img
                      src={company.logoUrl}
                      alt=""
                      className={styles.headerCompanyLogo}
                    />
                  ) : (
                    <span className={styles.headerCompanyAvatar}>
                      {company.name.slice(0, 1)}
                    </span>
                  )}
                  <div className={styles.headerCompanyText}>
                    <span className={styles.headerCompanyName}>
                      {company.name}
                    </span>
                    {company.category && (
                      <span className={styles.headerCompanyCategory}>
                        {company.category}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <a
            href="/meus-agendamentos"
            className={styles.headerLink}
            title="Acessar meus agendamentos"
          >
            <UserRound size={16} />
            <span className={styles.headerLinkText}>Meus agendamentos</span>
          </a>
        </div>
      </header>

      {children}

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>
            Agendamento online seguro com <strong>Nova(e)</strong>
          </span>
          <span className={styles.footerDot}>·</span>
          <span>Seu tempo bem cuidado</span>
        </div>
      </footer>
    </div>
  );
}

export const money = (amount: number | string) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(amount));

export const duration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}min`;
  if (h) return `${h}h`;
  return `${m}min`;
};

export const dateLabel = (date: string) => {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(`${date}T12:00:00Z`));
  } catch {
    return date;
  }
};

export const dateLabelShort = (date: string) => {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${date}T12:00:00Z`));
  } catch {
    return date;
  }
};

export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <div className={styles.error} role="alert">
      {message}
    </div>
  ) : null;
}

export function Skeleton({ label = "Carregando…" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className={styles.skeletonWrap}>
      <div className={styles.loadingLine} />
      <div className={styles.loadingGrid}>
        <div className={styles.loadingSlot} />
        <div className={styles.loadingSlot} />
        <div className={styles.loadingSlot} />
        <div className={styles.loadingSlot} />
      </div>
      <span className={styles.muted}>{label}</span>
    </div>
  );
}
