"use client";

import { ExternalLink, Monitor, Moon, Smartphone, Sun } from "lucide-react";
import styles from "./branding-studio.module.css";

export function PreviewToolbar({
  theme,
  viewport,
  slug,
  onTheme,
  onViewport,
}: {
  theme: "dark" | "light";
  viewport: "desktop" | "mobile";
  slug?: string;
  onTheme: (theme: "dark" | "light") => void;
  onViewport: (viewport: "desktop" | "mobile") => void;
}) {
  return (
    <div className={styles.previewToolbar} aria-label="Controles da prévia">
      {slug && (
        <a
          href={`/agendar/${slug}`}
          target="_blank"
          rel="noreferrer"
          className={styles.themeToggleBtn}
          title="Abrir página pública em nova aba"
        >
          <ExternalLink size={13} />
          <span>Ver link</span>
        </a>
      )}
      <button
        type="button"
        className={styles.themeToggleBtn}
        onClick={() => onTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
        <span>{theme === "dark" ? "Ver claro" : "Ver escuro"}</span>
      </button>
      <div className={styles.viewportToggle}>
        <button
          type="button"
          className={`${styles.viewportBtn} ${viewport === "desktop" ? styles.viewportBtnActive : ""}`}
          aria-pressed={viewport === "desktop"}
          onClick={() => onViewport("desktop")}
        >
          <Monitor size={13} /> Desktop
        </button>
        <button
          type="button"
          className={`${styles.viewportBtn} ${viewport === "mobile" ? styles.viewportBtnActive : ""}`}
          aria-pressed={viewport === "mobile"}
          onClick={() => onViewport("mobile")}
        >
          <Smartphone size={13} /> Mobile
        </button>
      </div>
    </div>
  );
}
