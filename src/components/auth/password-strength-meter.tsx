"use client";

import React from "react";
import { Check } from "lucide-react";

interface PasswordStrengthMeterProps {
  password?: string;
  className?: string;
}

export interface PasswordAnalysis {
  score: number;
  label: string;
  color: string;
  hasMinLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  missing: string[];
}

export function analyzePassword(password: string = ""): PasswordAnalysis {
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const missing: string[] = [];
  if (!hasMinLength) missing.push("8+ caracteres");
  if (!hasUpper) missing.push("1 maiúscula");
  if (!hasLower) missing.push("1 minúscula");
  if (!hasNumber) missing.push("1 número");
  if (!hasSpecial) missing.push("1 caractere especial");

  let score = 0;
  if (password.length > 0) {
    if (hasMinLength) score++;
    if (hasUpper) score++;
    if (hasLower) score++;
    if (hasNumber) score++;
    if (hasSpecial) score++;
  }

  let label = "";
  let color = "#ef4444";

  switch (score) {
    case 0:
    case 1:
      label = "Muito fraca";
      color = "#ef4444";
      break;
    case 2:
      label = "Fraca";
      color = "#f97316";
      break;
    case 3:
      label = "Média";
      color = "#eab308";
      break;
    case 4:
      label = "Forte";
      color = "#10b981";
      break;
    case 5:
      label = "Excelente";
      color = "#22c55e";
      break;
    default:
      label = "Muito fraca";
      color = "#ef4444";
  }

  return {
    score,
    label,
    color,
    hasMinLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    missing,
  };
}

export function PasswordStrengthMeter({
  password = "",
  className = "",
}: PasswordStrengthMeterProps) {
  if (!password) return null;

  const analysis = analyzePassword(password);
  const { score, label, color, missing } = analysis;

  return (
    <div className={`password-strength-container ${className}`}>
      {/* Barra segmentada em 5 partes + Label à direita */}
      <div className="password-strength-row">
        <div className="password-strength-bars">
          {[1, 2, 3, 4, 5].map((index) => {
            const isActive = index <= Math.max(score, 1);
            return (
              <span
                key={index}
                className="password-strength-bar"
                style={{
                  backgroundColor: isActive ? color : undefined,
                }}
              />
            );
          })}
        </div>
        <span
          className="password-strength-label"
          style={{ color }}
          aria-live="polite"
        >
          {label}
        </span>
      </div>

      {/* Requisitos faltantes ou mensagem de sucesso */}
      <div className="password-strength-hint">
        {missing.length > 0 ? (
          <span>
            <strong className="password-strength-missing-tag">Falta:</strong>{" "}
            {missing.join(", ")}
          </span>
        ) : (
          <span className="password-strength-success">
            <Check size={12} strokeWidth={3} />
            Senha segura e protegida
          </span>
        )}
      </div>
    </div>
  );
}
