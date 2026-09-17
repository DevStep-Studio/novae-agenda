"use client";

import React, { useState } from "react";
import { Navigation, MapPin, Check, Copy } from "lucide-react";
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
  const mapsEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(cleanAddress)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cleanAddress)}`;

  function handleCopyAddress(e: React.MouseEvent) {
    e.stopPropagation();
    void navigator.clipboard.writeText(cleanAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={`${styles.mapContainer} ${compact ? styles.compact : ""} ${className}`}
      aria-label={`Mapa com localização de ${companyName}`}
    >
      {/* Map iframe */}
      <iframe
        title={`Localização de ${companyName}`}
        src={mapsEmbedUrl}
        className={styles.mapIframe}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen={false}
      />

      {/* Central stylized location pin matching native map design */}
      <div className={styles.pinOverlay}>
        <div className={styles.pinPulse} />
        <div className={styles.pinBadge}>
          <MapPin size={18} strokeWidth={2.5} />
        </div>
      </div>

      {/* Floating Bottom Card */}
      <div className={styles.floatingCard}>
        <div className={styles.cardMain}>
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
              {companyName.slice(0, 1).toUpperCase()}
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
            style={{ width: 44, height: 44, minWidth: 44, minHeight: 44 }}
          >
            {copied ? <Check size={16} color="#22c55e" /> : <Copy size={16} />}
          </button>

          <div className={styles.divider} />

          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.navButton}
            title="Abrir rota no GPS / Mapas"
          >
            <Navigation className={styles.navButtonIcon} />
          </a>
        </div>
      </div>
    </div>
  );
}
