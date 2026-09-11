"use client";

import { Monitor, Moon, Smartphone, Sun } from "lucide-react";
import styles from "./branding-studio.module.css";

export function PreviewToolbar({
  theme,
  viewport,
  onTheme,
  onViewport,
}: {
  theme: "dark" | "light";
  viewport: "desktop" | "mobile";
  onTheme: (theme: "dark" | "light") => void;
  onViewport: (viewport: "desktop" | "mobile") => void;
}) {
  return (
    <div className={styles.previewToolbar} aria-label="Controles da prévia">
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
