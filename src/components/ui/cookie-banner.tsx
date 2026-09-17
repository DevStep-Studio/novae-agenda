"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "agenda-cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [lifted, setLifted] = useState(false);

  useEffect(() => {
    const checkConsent = () => {
      try {
        if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
      } catch {
        setVisible(true);
      }
    };
    checkConsent();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const checkBottomNav = () => {
      const nav = document.querySelector(".mobile-bottom-nav");
      const rect = nav?.getBoundingClientRect();
      setLifted(Boolean(rect && rect.height > 0));
    };
    checkBottomNav();
    window.addEventListener("resize", checkBottomNav);
    return () => window.removeEventListener("resize", checkBottomNav);
  }, [visible]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className={`cookie-banner ${lifted ? "cookie-banner-lifted" : ""}`} role="dialog" aria-label="Aviso de cookies">
      <p className="cookie-banner-text">
        Usamos cookies essenciais para manter sua sessão e preferências. Veja a{" "}
        <a href="/privacidade#cookies">Política de Cookies</a>.
      </p>
      <div className="cookie-banner-actions">
        <a href="/privacidade#cookies" className="state-screen-btn-secondary">
          Gerenciar
        </a>
        <button type="button" className="state-screen-btn" onClick={dismiss}>
          Aceitar
        </button>
      </div>
    </div>
  );
}
