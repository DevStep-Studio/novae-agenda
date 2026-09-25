"use client";

import React, { useRef, useEffect } from "react";

export interface PinInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  mask?: boolean;
  className?: string;
  error?: boolean;
  theme?: "dark" | "light" | "auto";
}

export function PinInput({
  id = "pin-input",
  value = "",
  onChange,
  length = 6,
  disabled = false,
  autoFocus = false,
  mask = true,
  className = "",
  error = false,
  theme = "auto",
}: PinInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Mantém array de caracteres normalizado até o tamanho length
  const digits = value.slice(0, length).split("");
  while (digits.length < length) {
    digits.push("");
  }

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleInputChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, "");
    if (!rawVal) {
      // Se apagou
      const next = [...digits];
      next[index] = "";
      onChange(next.join(""));
      return;
    }

    // Se o usuário digitou ou colou um ou mais dígitos
    const incomingChars = rawVal.split("");
    const next = [...digits];

    let currentIdx = index;
    for (const ch of incomingChars) {
      if (currentIdx < length) {
        next[currentIdx] = ch;
        currentIdx++;
      }
    }

    onChange(next.join(""));

    // Foca o próximo input disponível
    const nextTargetIdx = Math.min(currentIdx, length - 1);
    if (inputRefs.current[nextTargetIdx]) {
      inputRefs.current[nextTargetIdx]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        // Se já está vazio, volta para o anterior e apaga
        const next = [...digits];
        next[index - 1] = "";
        onChange(next.join(""));
        inputRefs.current[index - 1]?.focus();
        e.preventDefault();
      } else if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        onChange(next.join(""));
        e.preventDefault();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pastedData) return;

    const pastedDigits = pastedData.slice(0, length).split("");
    const next = [...digits];
    for (let i = 0; i < length; i++) {
      if (pastedDigits[i] !== undefined) {
        next[i] = pastedDigits[i];
      }
    }
    onChange(next.join(""));

    const focusIdx = Math.min(pastedDigits.length, length - 1);
    inputRefs.current[focusIdx]?.focus();
  };

  const isLight =
    theme === "light" ||
    (theme === "auto" &&
      typeof document !== "undefined" &&
      (document.documentElement.getAttribute("data-theme") === "light" ||
        document.body.classList.contains("light") ||
        document.querySelector("[data-theme='light']") !== null));
  const isDark = !isLight;
  const borderColor = error
    ? "#ef4444"
    : isDark
      ? "#27272a"
      : "#e2e8f0";
  const activeBorderColor = error
    ? "#ef4444"
    : isDark
      ? "#a3e635"
      : "#65a30d";
  const bgColor = isDark ? "#09090b" : "#ffffff";
  const textColor = isDark ? "#fafafa" : "#09090b";

  return (
    <div
      className={`pin-input-container ${className}`}
      style={{
        display: "flex",
        gap: "8px",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        maxWidth: "360px",
        margin: "0 auto",
      }}
      role="group"
      aria-label="Entrada de PIN de 6 dígitos"
    >
      {Array.from({ length }).map((_, index) => {
        const char = digits[index] || "";
        const isFilled = Boolean(char);

        return (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            id={`${id}-${index}`}
            type={mask ? "password" : "text"}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={char}
            disabled={disabled}
            onChange={(e) => handleInputChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            autoComplete="one-time-code"
            aria-label={`Dígito ${index + 1} de ${length}`}
            style={{
              width: "48px",
              height: "56px",
              borderRadius: "8px",
              border: `1.5px solid ${isFilled ? activeBorderColor : borderColor}`,
              backgroundColor: bgColor,
              color: textColor,
              fontSize: "24px",
              fontWeight: "600",
              textAlign: "center",
              outline: "none",
              transition: "border-color 0.15s ease, background-color 0.15s ease",
              boxShadow: "none",
              WebkitAppearance: "none",
              caretColor: activeBorderColor,
            }}
            onFocusCapture={(e) => {
              e.currentTarget.style.borderColor = activeBorderColor;
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.borderColor = isFilled ? activeBorderColor : borderColor;
            }}
          />
        );
      })}
    </div>
  );
}
