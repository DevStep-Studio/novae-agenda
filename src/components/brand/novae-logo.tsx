"use client";

import React from "react";

interface NovaeLogoProps {
  variant?: "full" | "symbol" | "wordmark";
  size?: "sm" | "md" | "lg" | "xl" | number;
  className?: string;
  useImage?: boolean;
}

/**
 * Novae Star Symbol SVG (Exact origami geometry vectorized from original asset).
 * ViewBox: 0 0 142 144
 */
export function NovaeStarIcon({
  className = "",
  size = 24,
  fill = "currentColor",
}: {
  className?: string;
  size?: number;
  fill?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 142 144"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path
        d="M 96,0 L 74,31 L 74,35 L 89,43 L 0,71 L 34,87 L 42,95 L 45,102 L 45,143 L 68,111 L 54,99 L 141,72 L 107,56 L 100,49 L 96,39 Z"
        fill={fill}
      />
    </svg>
  );
}

/**
 * Novae Brand Logo Component
 * Supports 'full' (wordmark + star), 'symbol' (star icon only), and 'wordmark' (novae text).
 */
export function NovaeLogo({
  variant = "full",
  size = "md",
  className = "",
}: NovaeLogoProps) {
  const height =
    typeof size === "number"
      ? size
      : size === "sm"
      ? 20
      : size === "md"
      ? 28
      : size === "lg"
      ? 38
      : 52;

  if (variant === "symbol") {
    return <NovaeStarIcon size={height} className={className} fill="#dcff4c" />;
  }

  if (variant === "wordmark") {
    return (
      <span
        className={`novae-brand-wordmark ${className}`}
        style={{
          fontSize: `${Math.round(height * 0.78)}px`,
          fontWeight: 800,
          color: "#ffffff",
          letterSpacing: "-0.8px",
          display: "inline-flex",
          alignItems: "center",
          fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        Nova<span style={{ color: "#dcff4c" }}>(e)</span>
      </span>
    );
  }

  // Full lockup
  return (
    <div
      className={`novae-brand-lockup ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        height: `${height}px`,
      }}
    >
      <NovaeStarIcon size={height} fill="#dcff4c" />
      <span
        style={{
          fontSize: `${Math.round(height * 0.78)}px`,
          fontWeight: 800,
          color: "#ffffff",
          letterSpacing: "-0.8px",
          fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
          lineHeight: 1,
        }}
      >
        Nova<span style={{ color: "#dcff4c" }}>(e)</span>
      </span>
    </div>
  );
}

export const ReserveiLogo = NovaeLogo;

