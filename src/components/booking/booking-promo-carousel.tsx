"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Sparkles, ExternalLink, Play } from "lucide-react";
import type { PromoBannersConfig, PromoBannerItem } from "@/lib/booking/customization";
import styles from "./booking-promo-carousel.module.css";

export interface BookingPromoCarouselProps {
  promoBanners?: PromoBannersConfig | null;
  className?: string;
}

export function BookingPromoCarousel({
  promoBanners,
  className = "",
}: BookingPromoCarouselProps) {
  const items = promoBanners?.items || [];
  const enabled = promoBanners?.enabled && items.length > 0;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef<number>(0);

  const totalItems = items.length;

  const handleNext = useCallback(() => {
    if (totalItems <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % totalItems);
  }, [totalItems]);

  const handlePrev = useCallback(() => {
    if (totalItems <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + totalItems) % totalItems);
  }, [totalItems]);

  // Autoplay timer
  useEffect(() => {
    if (!enabled || totalItems <= 1 || isHovered) return;

    const interval = setInterval(() => {
      handleNext();
    }, 5000);

    return () => clearInterval(interval);
  }, [enabled, totalItems, isHovered, handleNext]);

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchDeltaXRef.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current;
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null) return;
    const delta = touchDeltaXRef.current;
    if (delta > 50) {
      handlePrev();
    } else if (delta < -50) {
      handleNext();
    }
    touchStartXRef.current = null;
    touchDeltaXRef.current = 0;
  };

  if (!enabled || items.length === 0) {
    return null;
  }

  const currentItem = items[currentIndex] || items[0];

  return (
    <div
      className={`${styles.carouselContainer} ${className}`}
      aria-label="Carrossel promocional"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className={styles.slidesTrack}>
        {items.map((item, idx) => {
          const isActive = idx === currentIndex;
          return (
            <div
              key={item.id || idx}
              className={`${styles.slide} ${isActive ? styles.slideActive : styles.slideInactive}`}
              aria-hidden={!isActive}
            >
              {/* Media Content: Image or Video */}
              <div className={styles.mediaWrapper}>
                {item.type === "video" ? (
                  <video
                    src={item.url}
                    className={styles.mediaVideo}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.url}
                    alt={item.title || "Banner promocional"}
                    className={styles.mediaImage}
                    loading={idx === 0 ? "eager" : "lazy"}
                  />
                )}

                {/* Video Play Indicator Badge if video */}
                {item.type === "video" && (
                  <div className={styles.videoIndicatorBadge} title="Vídeo">
                    <Play size={10} fill="currentColor" />
                    <span>Vídeo</span>
                  </div>
                )}

                {/* Dark Gradient Scrim Overlay */}
                <div className={styles.gradientOverlay} />
              </div>

              {/* Text & Action Overlay */}
              <div className={styles.contentOverlay}>
                {item.badge && (
                  <div className={styles.badgeWrapper}>
                    <span className={styles.badgeTag}>
                      <Sparkles size={11} className={styles.badgeIcon} />
                      {item.badge}
                    </span>
                  </div>
                )}

                {item.title && <h3 className={styles.slideTitle}>{item.title}</h3>}

                {item.subtitle && <p className={styles.slideSubtitle}>{item.subtitle}</p>}

                {item.linkUrl && (
                  <div className={styles.actionWrapper}>
                    <a
                      href={item.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.actionButton}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>{item.buttonText || "Saiba mais"}</span>
                      <ExternalLink size={13} />
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows (Only if multiple items) */}
      {totalItems > 1 && (
        <>
          <button
            type="button"
            className={`${styles.navArrow} ${styles.navArrowPrev}`}
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            aria-label="Banner anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            type="button"
            className={`${styles.navArrow} ${styles.navArrowNext}`}
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            aria-label="Próximo banner"
          >
            <ChevronRight size={18} />
          </button>

          {/* Dots Indicator */}
          <div className={styles.dotsContainer}>
            {items.map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                className={`${styles.dot} ${dotIdx === currentIndex ? styles.dotActive : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(dotIdx);
                }}
                aria-label={`Ir para banner ${dotIdx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
