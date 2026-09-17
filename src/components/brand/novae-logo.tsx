"use client";

import React from "react";
import Image from "next/image";

export interface ReserveiLogoProps {
  variant?: "full" | "symbol" | "wordmark";
  size?: "sm" | "md" | "lg" | "xl" | number;
  color?: "lime" | "white" | "black" | "auto";
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  alt?: string;
}

export type NovaeLogoProps = ReserveiLogoProps;

/**
 * Reservei Origami Star Symbol SVG.
 * ViewBox: 0 0 142 144
 */
export function ReserveiStarIcon({
  className = "",
  size = 24,
  fill = "var(--primary, #3b82f6)",
  style,
}: {
  className?: string;
  size?: number;
  fill?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 142 144"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    >
      <path
        d="M 96,0 L 74,31 L 74,35 L 89,43 L 0,71 L 34,87 L 42,95 L 45,102 L 45,143 L 68,111 L 54,99 L 141,72 L 107,56 L 100,49 L 96,39 Z"
        fill={fill}
      />
    </svg>
  );
}

/**
 * Reservei Brand Logo Component
 * Uses the official visual identity assets from /public (logo.png, symbol.png, etc.)
 */
export function ReserveiLogo({
  variant = "full",
  size = "md",
  color = "auto",
  className = "",
  style,
  priority = false,
  alt = "Reservei",
}: ReserveiLogoProps) {
  const height =
    typeof size === "number"
      ? size
    : size === "sm"
    ? 22
    : size === "md"
    ? 28
    : size === "lg"
    ? 36
    : 48;

  if (variant === "symbol") {
    if (color === "auto") {
      return (
        <span
          className={`reservei-symbol-wrap ${className}`}
          style={{ display: "inline-flex", alignItems: "center", ...style }}
        >
          <Image
            src="/symbol.png"
            alt={alt}
            width={height}
            height={height}
            unoptimized
            className="reservei-symbol-img reservei-logo-dark"
            style={{
              height: `${height}px`,
              width: `${height}px`,
              objectFit: "contain",
              display: "inline-block",
              verticalAlign: "middle",
              flexShrink: 0,
            }}
            loading={priority ? "eager" : "lazy"}
          />
          <Image
            src="/symbol-black.png"
            alt={alt}
            width={height}
            height={height}
            unoptimized
            className="reservei-symbol-img reservei-logo-light"
            style={{
              height: `${height}px`,
              width: `${height}px`,
              objectFit: "contain",
              display: "none",
              verticalAlign: "middle",
              flexShrink: 0,
            }}
            loading={priority ? "eager" : "lazy"}
          />
        </span>
      );
    }

    const symbolSrc =
      color === "white"
        ? "/symbol-white.png"
        : color === "black"
        ? "/symbol-black.png"
        : "/symbol.png";

    return (
      <Image
        src={symbolSrc}
        alt={alt}
        width={height}
        height={height}
        unoptimized
        className={`reservei-symbol-img ${className}`}
        style={{
          height: `${height}px`,
          width: `${height}px`,
          objectFit: "contain",
          display: "inline-block",
          verticalAlign: "middle",
          flexShrink: 0,
          ...style,
        }}
        loading={priority ? "eager" : "lazy"}
      />
    );
  }

  // Full Logo (or Wordmark) - uses official /logo.png (aspect ratio ~ 2.3686)
  const width = Math.round(height * (1947 / 822));

  if (color === "auto") {
    return (
      <span
        className={`reservei-logo-wrap ${className}`}
        style={{ display: "inline-flex", alignItems: "center", ...style }}
      >
        <Image
          src="/logo.png"
          alt={alt}
          width={width}
          height={height}
          unoptimized
          className="reservei-logo-img reservei-logo-dark"
          style={{
            height: `${height}px`,
            width: "auto",
            maxWidth: "100%",
            objectFit: "contain",
            display: "inline-block",
            verticalAlign: "middle",
            flexShrink: 0,
          }}
          loading={priority ? "eager" : "lazy"}
        />
        <Image
          src="/logo-black.png"
          alt={alt}
          width={width}
          height={height}
          unoptimized
          className="reservei-logo-img reservei-logo-light"
          style={{
            height: `${height}px`,
            width: "auto",
            maxWidth: "100%",
            objectFit: "contain",
            display: "none",
            verticalAlign: "middle",
            flexShrink: 0,
          }}
          loading={priority ? "eager" : "lazy"}
        />
      </span>
    );
  }

  const logoSrc =
    color === "white"
      ? "/logo-white.png"
      : color === "black"
      ? "/logo-black.png"
      : "/logo.png";

  return (
    <Image
      src={logoSrc}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      className={`reservei-logo-img ${className}`}
      style={{
        height: `${height}px`,
        width: "auto",
        maxWidth: "100%",
        objectFit: "contain",
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        ...style,
      }}
      loading={priority ? "eager" : "lazy"}
    />
  );
}

