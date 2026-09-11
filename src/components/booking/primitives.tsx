"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { UserRound } from "lucide-react";
import { createBrandPalette } from "@/lib/branding";
import { resolveCopy, type CopyOverrides } from "@/lib/booking/customization";
import { resolveFontPack } from "./font-packs";
import styles from "./booking.module.css";
export { styles as b };

const darkSchemeQuery = "(prefers-color-scheme: dark)";

function subscribeToColorScheme(onChange: () => void) {
  const mediaQuery = window.matchMedia(darkSchemeQuery);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function prefersDarkScheme() {
  return window.matchMedia(darkSchemeQuery).matches;
}

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
  coverPosition = "center",
  preview = false,
  themeMode = "auto",
  fontFamily,
  copyOverrides,
  company,
}: {
  children: ReactNode;
  color?: string;
  coverUrl?: string | null;
  coverPosition?: "center" | "top" | "bottom" | string;
  preview?: boolean | "desktop" | "mobile";
  themeMode?: "auto" | "light" | "dark";
  fontFamily?: string;
  copyOverrides?: CopyOverrides;
  company?: {
    name: string;
    category?: string | null;
    logoUrl?: string | null;
    avatarUrl?: string | null;
    slug?: string;
    address?: string | null;
  };
}) {
  const prefersDark = useSyncExternalStore(
    subscribeToColorScheme,
    prefersDarkScheme,
    () => true,
  );
  const resolvedTheme = themeMode === "auto" ? (prefersDark ? "dark" : "light") : themeMode;

  const palette = createBrandPalette(color, resolvedTheme);
  const fontPack = resolveFontPack(fontFamily);

  return (
    <div
      className={`${styles.page} ${preview ? styles.previewPage : ""} ${preview === "mobile" ? styles.previewMobile : ""} ${
        resolvedTheme === "light" ? styles.pageLight : styles.pageDark
      }`}
      style={
        {
          ...palette.cssVariables,
          "--booking-font-heading": fontPack.heading,
          "--booking-font-body": fontPack.body,
        } as React.CSSProperties
      }
      data-theme={resolvedTheme}
    >
      {/* Optional Cover Header */}
      {coverUrl && (
        <div className={styles.coverBannerWrap}>
          <img
            src={coverUrl}
            alt=""
            className={styles.coverBannerImg}
            style={{ objectPosition: `center ${coverPosition}` }}
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
            href={preview ? undefined : "/meus-agendamentos"}
            aria-disabled={Boolean(preview) || undefined}
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
          <span>{resolveCopy(copyOverrides, "footerLine1")}</span>
          <span className={styles.footerDot}>·</span>
          <span>{resolveCopy(copyOverrides, "footerLine2")}</span>
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

export function Price({ amount, className = "" }: { amount: number | string; className?: string }) {
  return <span className={`${styles.priceValue} ${className}`}>{money(amount)}</span>;
}

export function BookingAvatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const fallback = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span className={`${styles.bookingAvatar} ${styles[`bookingAvatar${size.toUpperCase()}`]}`} aria-hidden="true">
      {src && failedSrc !== src ? <img src={src} alt="" onError={() => setFailedSrc(src)} /> : fallback || "?"}
    </span>
  );
}

export function TimeSlotButton({
  label,
  selected = false,
  disabled = false,
  compact = false,
  onClick,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${compact ? styles.quickNextSlotChip : styles.slotChip} ${selected ? compact ? styles.quickNextSlotChipActive : styles.slotChipSelected : ""}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

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
