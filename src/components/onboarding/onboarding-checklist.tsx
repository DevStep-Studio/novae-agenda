"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Share2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { SetupStatusResponse } from "@/app/api/company/setup-status/route";

interface OnboardingChecklistCardProps {
  onNavigate: (tab: string) => void;
  onToast?: (msg: string) => void;
}

export function OnboardingChecklistCard({
  onNavigate,
  onToast,
}: OnboardingChecklistCardProps) {
  const [data, setData] = useState<SetupStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await api<SetupStatusResponse>("/api/company/setup-status");
      setData(res);
    } catch {
      // Ignora erro silencioso no dashboard
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading || !data) return null;

  const handleCopyLink = () => {
    if (!data.publicUrl) return;
    navigator.clipboard.writeText(data.publicUrl);
    setCopied(true);
    onToast?.("Link copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2500);
  };

  // Se estiver 100% completo
  if (data.isComplete) {
    return (
      <div
        className="onboarding-complete-card"
        style={{
          background: "var(--surface, #121212)",
          border: "1px solid var(--border, #222222)",
          borderRadius: "12px",
          padding: "16px 20px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(220, 255, 76, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#dcff4c",
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 600,
                color: "#f5f5f5",
              }}
            >
              Seu perfil Reservei está pronto para receber agendamentos!
            </h4>
            <p
              style={{
                margin: "3px 0 0",
                fontSize: "12px",
                color: "var(--text-secondary)",
              }}
            >
              Divulgue seu link para seus clientes agendarem horários online.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={handleCopyLink}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              background: "#dcff4c",
              color: "#080808",
              border: "none",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {copied ? <Check size={15} /> : <Share2 size={15} />}
            <span>{copied ? "Copiado!" : "Compartilhar meu link"}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="onboarding-progress-card"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "16px 20px",
        marginBottom: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(220, 255, 76, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#dcff4c",
              fontWeight: 700,
              fontSize: "12px",
            }}
          >
            {data.percentage}%
          </div>
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 600,
                color: "#f2f7f4",
              }}
            >
              Seu Reservei está {data.percentage}% configurado
            </h4>
            <p
              style={{
                margin: "3px 0 0",
                fontSize: "12px",
                color: "var(--text-secondary)",
              }}
            >
              Conclua o checklist abaixo para liberar agendamentos públicos para seus clientes.
            </p>
          </div>
        </div>

        <button
          type="button"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "4px",
          }}
          aria-label={collapsed ? "Expandir checklist" : "Recolher checklist"}
        >
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>

      {/* Barra de Progresso */}
      <div
        style={{
          width: "100%",
          height: "6px",
          background: "var(--surface-tertiary)",
          borderRadius: "3px",
          marginTop: "14px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${data.percentage}%`,
            height: "100%",
            background: "#dcff4c",
            borderRadius: "3px",
            transition: "width 0.4s ease",
          }}
        />
      </div>

      {/* Lista de Passos */}
      {!collapsed && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "10px",
            marginTop: "16px",
            paddingTop: "14px",
            borderTop: "1px solid var(--border)",
          }}
        >
          {data.steps.map((step) => (
            <div
              key={step.id}
              onClick={() => onNavigate(step.targetTab)}
              className={`onboarding-step-card ${step.completed ? "completed" : "pending"}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                borderRadius: "8px",
                cursor: "pointer",
              }}
              title={step.completed ? "Etapa concluída" : "Clique para configurar"}
            >
              {step.completed ? (
                <CheckCircle2 size={16} style={{ color: "#dcff4c", flexShrink: 0 }} />
              ) : (
                <Circle size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              )}
              <span
                style={{
                  fontSize: "12px",
                  color: step.completed ? "#f2f7f4" : "var(--text-secondary)",
                  fontWeight: step.completed ? 600 : 400,
                  flex: 1,
                }}
              >
                {step.label}
              </span>
              <ArrowRight size={13} style={{ color: step.completed ? "#dcff4c" : "var(--text-muted)" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
