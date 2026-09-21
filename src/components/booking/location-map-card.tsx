"use client";

import React, { useState } from "react";
import { Navigation, MapPin, Check, Copy, ExternalLink, Compass } from "lucide-react";
import styles from "./location-map-card.module.css";

export interface LocationMapCardProps {
  address?: string | null;
  companyName: string;
  companyLogo?: string | null;
  className?: string;
  compact?: boolean;
}

export function LocationMapCard({
  address,
  companyName,
  companyLogo,
  className = "",
  compact = false,
}: LocationMapCardProps) {
  const [copied, setCopied] = useState(false);

  if (!address || !address.trim()) {
    return null;
  }

  const cleanAddress = address.trim();
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddress)}`;
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(cleanAddress)}`;

  function handleCopyAddress(e: React.MouseEvent) {
    e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(cleanAddress);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenMaps(e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    window.open(googleMapsUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className={`${styles.mapContainer} ${compact ? styles.compact : ""} ${className}`}
      aria-label={`Localização de ${companyName}`}
      onClick={handleOpenMaps}
      role="region"
    >
      {/* Dynamic Vector Map Texture Background */}
      <div className={styles.vectorMapCanvas}>
        <svg
          className={styles.mapGridSvg}
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
          viewBox="0 0 800 400"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <pattern id="grid-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.08" />
              <circle cx="30" cy="30" r="1.5" fill="currentColor" fillOpacity="0.15" />
            </pattern>
            <linearGradient id="road-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.18" />
              <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="radar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Base Grid */}
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />

          {/* Stylized Street Blocks */}
          <rect x="60" y="40" width="140" height="90" rx="8" fill="currentColor" fillOpacity="0.03" />
          <rect x="220" y="40" width="180" height="80" rx="8" fill="currentColor" fillOpacity="0.04" />
          <rect x="420" y="50" width="150" height="70" rx="8" fill="currentColor" fillOpacity="0.03" />
          <rect x="590" y="30" width="160" height="100" rx="8" fill="currentColor" fillOpacity="0.04" />

          <rect x="40" y="150" width="160" height="110" rx="8" fill="currentColor" fillOpacity="0.04" />
          <rect x="220" y="140" width="200" height="120" rx="8" fill="currentColor" fillOpacity="0.05" />
          <rect x="440" y="140" width="170" height="110" rx="8" fill="currentColor" fillOpacity="0.04" />
          <rect x="630" y="150" width="140" height="120" rx="8" fill="currentColor" fillOpacity="0.03" />

          {/* Secondary Roads */}
          <path d="M 0 80 Q 250 60 400 110 T 800 90" fill="none" stroke="currentColor" strokeWidth="6" strokeOpacity="0.1" strokeLinecap="round" />
          <path d="M 120 0 Q 140 200 180 400" fill="none" stroke="currentColor" strokeWidth="7" strokeOpacity="0.12" strokeLinecap="round" />
          <path d="M 620 0 Q 600 180 640 400" fill="none" stroke="currentColor" strokeWidth="7" strokeOpacity="0.12" strokeLinecap="round" />
          <path d="M 0 280 Q 300 290 500 260 T 800 290" fill="none" stroke="currentColor" strokeWidth="6" strokeOpacity="0.08" strokeLinecap="round" />

          {/* Main Arterial Road (Highway) leading to Center */}
          <path d="M 0 200 C 200 200, 320 180, 400 160 C 480 140, 600 210, 800 210" fill="none" stroke="url(#road-grad-1)" strokeWidth="10" strokeLinecap="round" />
          <path d="M 0 200 C 200 200, 320 180, 400 160 C 480 140, 600 210, 800 210" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.25" strokeDasharray="8 6" />

          <path d="M 400 0 C 400 80, 390 120, 400 160 C 410 200, 400 300, 400 400" fill="none" stroke="url(#road-grad-1)" strokeWidth="10" strokeLinecap="round" />
          <path d="M 400 0 C 400 80, 390 120, 400 160 C 410 200, 400 300, 400 400" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.25" strokeDasharray="8 6" />

          {/* Target Location Radar Ring */}
          <circle cx="400" cy="160" r="70" fill="url(#radar-grad)" />
          <circle cx="400" cy="160" r="50" fill="none" stroke="#ec4899" strokeWidth="1" strokeOpacity="0.35" strokeDasharray="4 4" />
          <circle cx="400" cy="160" r="28" fill="none" stroke="#ec4899" strokeWidth="1.5" strokeOpacity="0.5" />
        </svg>

        {/* Ambient Glows */}
        <div className={styles.ambientGlowPink} />
        <div className={styles.ambientGlowBlue} />
      </div>

      {/* Interactive Map Controls / Hint Badge */}
      <div className={styles.mapControlsBadge}>
        <Compass size={12} className={styles.compassIcon} />
        <span>Toque para navegar no GPS</span>
      </div>

      {/* Central stylized location pin matching native map design */}
      <div className={styles.pinOverlay}>
        <div className={styles.pinPulseRing} />
        <div className={styles.pinPulseRingSecondary} />
        <div className={styles.pinBadge}>
          <MapPin size={18} strokeWidth={2.5} />
        </div>
        <div className={styles.pinShadow} />
      </div>

      {/* Floating Bottom Card */}
      <div className={styles.floatingCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.cardMain} onClick={handleOpenMaps} role="button" tabIndex={0}>
          {companyLogo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={companyLogo}
              alt={companyName}
              className={styles.avatar}
              loading="lazy"
            />
          ) : (
            <div className={styles.avatarFallback}>
              {(companyName || "E").slice(0, 1).toUpperCase()}
            </div>
          )}

          <div className={styles.cardText}>
            <h4 className={styles.companyTitle} title={companyName}>
              {companyName}
            </h4>
            <p className={styles.companyAddress} title={cleanAddress}>
              {cleanAddress}
            </p>
          </div>
        </div>

        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.navButton}
            onClick={handleCopyAddress}
            title={copied ? "Endereço copiado!" : "Copiar endereço"}
            aria-label="Copiar endereço"
          >
            {copied ? <Check size={16} color="#22c55e" /> : <Copy size={16} />}
          </button>

          <div className={styles.divider} />

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.navButton} ${styles.navButtonPrimary}`}
            title="Abrir rota no Google Maps / GPS"
            aria-label="Abrir rota no GPS"
          >
            <Navigation className={styles.navButtonIcon} />
            <span className={styles.navButtonLabel}>Como chegar</span>
          </a>
        </div>
      </div>
    </div>
  );
}
