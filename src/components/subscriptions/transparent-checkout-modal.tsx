"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  X,
  QrCode,
  CreditCard,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/client-utils";

export interface CheckoutPlan {
  slug: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  employeeLimit: number;
  badge?: string;
}

interface TransparentCheckoutModalProps {
  plan: CheckoutPlan;
  billingInterval: "monthly" | "yearly";
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TransparentCheckoutModal({
  plan,
  billingInterval,
  isOpen,
  onClose,
  onSuccess,
}: TransparentCheckoutModalProps) {
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // PIX state
  const [pixData, setPixData] = useState<{
    invoiceId: string;
    copiaECola: string;
    qrCode: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [checkingPix, setCheckingPix] = useState(false);

  // Card state
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [installments, setInstallments] = useState(1);

  const price = billingInterval === "yearly" ? plan.annualPrice : plan.monthlyPrice;

  const handleCloseModal = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setPixData(null);
    setCopied(false);
    onClose();
  };

  // Generate PIX automatically when PIX tab is selected
  const handleGeneratePix = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api<{
        invoiceId: string;
        copiaECola: string;
        qrCode: string;
        expiresAt: string;
      }>("/api/saas/checkout/pix", {
        method: "POST",
        body: JSON.stringify({
          planSlug: plan.slug,
          billingInterval,
        }),
      });

      setPixData(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao gerar PIX. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (!pixData?.copiaECola) return;
    navigator.clipboard.writeText(pixData.copiaECola);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleCheckPixStatus = async () => {
    if (!pixData?.invoiceId) return;
    setCheckingPix(true);
    setErrorMsg(null);
    try {
      const res = await api<{ paid: boolean; status: string }>(
        `/api/saas/checkout/status?invoiceId=${pixData.invoiceId}`
      );

      if (res?.paid) {
        setSuccessMsg("Pagamento confirmado! Sua assinatura foi ativada.");
        setTimeout(() => {
          onSuccess();
          handleCloseModal();
        }, 1500);
      } else {
        setErrorMsg("Pagamento ainda não identificado. Se você já pagou, aguarde alguns instantes.");
      }
    } catch {
      setErrorMsg("Erro ao checar status do pagamento.");
    } finally {
      setCheckingPix(false);
    }
  };

  // Card submission
  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || !cardHolder || !cardExpiry || !cardCvv) {
      setErrorMsg("Preencha todos os campos do cartão.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // Clean up inputs and generate token (zero PAN/CVV stored on server)
      const cleanNumber = cardNumber.replace(/\s+/g, "");
      const mockToken = `tok_${cleanNumber.slice(-4)}_${Date.now()}`;

      const res = await api<{
        approved: boolean;
        status: string;
        message: string;
      }>("/api/saas/checkout/card", {
        method: "POST",
        body: JSON.stringify({
          planSlug: plan.slug,
          billingInterval,
          cardToken: mockToken,
          installments,
        }),
      });

      if (res?.approved) {
        setSuccessMsg(res.message || "Assinatura ativada com sucesso!");
        setTimeout(() => {
          onSuccess();
          handleCloseModal();
        }, 1500);
      } else {
        setErrorMsg(res?.message || "Pagamento recusado. Verifique os dados do cartão.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Não foi possível concluir o pagamento. Verifique os dados do cartão ou utilize outra forma.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={handleCloseModal}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 780,
          background: "var(--surface, #12141a)",
          border: "1px solid var(--border, #2a2e39)",
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border, #2a2e39)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--primary, #22c55e)",
              }}
            >
              Checkout Reservei SaaS
            </span>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "2px 0 0", color: "var(--text-primary, #ffffff)" }}>
              Assinatura — Plano {plan.name}
            </h2>
          </div>
          <button
            onClick={handleCloseModal}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary, #94a3b8)",
              cursor: "pointer",
              padding: 6,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body: Split into Payment Details & Summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
            padding: 24,
          }}
        >
          {/* Left: Payment Method & Inputs */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary, #94a3b8)", display: "block", marginBottom: 8 }}>
              Forma de Pagamento
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => {
                  setMethod("pix");
                  if (!pixData) handleGeneratePix();
                }}
                style={{
                  padding: "12px 16px",
                  background: method === "pix" ? "rgba(34, 197, 94, 0.1)" : "var(--surface-hover, #1a1d26)",
                  border: `1px solid ${method === "pix" ? "var(--primary, #22c55e)" : "var(--border, #2a2e39)"}`,
                  borderRadius: 10,
                  color: method === "pix" ? "var(--primary, #22c55e)" : "var(--text-primary, #ffffff)",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <QrCode size={18} />
                PIX
              </button>
              <button
                type="button"
                onClick={() => setMethod("card")}
                style={{
                  padding: "12px 16px",
                  background: method === "card" ? "rgba(34, 197, 94, 0.1)" : "var(--surface-hover, #1a1d26)",
                  border: `1px solid ${method === "card" ? "var(--primary, #22c55e)" : "var(--border, #2a2e39)"}`,
                  borderRadius: 10,
                  color: method === "card" ? "var(--primary, #22c55e)" : "var(--text-primary, #ffffff)",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <CreditCard size={18} />
                Cartão
              </button>
            </div>

            {errorMsg && (
              <div
                style={{
                  padding: "12px 14px",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid #ef4444",
                  borderRadius: 8,
                  color: "#fca5a5",
                  fontSize: 13,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div
                style={{
                  padding: "12px 14px",
                  background: "rgba(34, 197, 94, 0.1)",
                  border: "1px solid #22c55e",
                  borderRadius: 8,
                  color: "#86efac",
                  fontSize: 13,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Check size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* PIX Flow */}
            {method === "pix" && (
              <div>
                {!pixData && !loading && (
                  <button
                    onClick={handleGeneratePix}
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: "var(--primary, #22c55e)",
                      color: "#000",
                      fontWeight: 700,
                      borderRadius: 10,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    Gerar Código PIX
                  </button>
                )}

                {loading && (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-secondary, #94a3b8)" }}>
                    <Loader2 size={28} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                    <p style={{ fontSize: 13, margin: 0 }}>Criando cobrança PIX oficial...</p>
                  </div>
                )}

                {pixData && !loading && (
                  <div>
                    <div
                      style={{
                        background: "#ffffff",
                        padding: 16,
                        borderRadius: 12,
                        width: 180,
                        height: 180,
                        margin: "0 auto 16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid var(--border, #2a2e39)",
                      }}
                    >
                      {pixData.qrCode ? (
                        <Image
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                            pixData.copiaECola
                          )}`}
                          alt="QR Code PIX"
                          width={148}
                          height={148}
                          unoptimized
                          style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                      ) : (
                        <QrCode size={120} color="#000" />
                      )}
                    </div>

                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary, #94a3b8)", display: "block", marginBottom: 6 }}>
                      PIX Copia e Cola:
                    </label>
                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                      <input
                        type="text"
                        readOnly
                        value={pixData.copiaECola}
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          background: "var(--surface-input, #0d0f14)",
                          border: "1px solid var(--border, #2a2e39)",
                          borderRadius: 8,
                          color: "var(--text-primary, #ffffff)",
                          fontSize: 12,
                          fontFamily: "monospace",
                          outline: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleCopyPix}
                        style={{
                          padding: "8px 14px",
                          background: copied ? "#22c55e" : "var(--surface-hover, #1a1d26)",
                          border: "1px solid var(--border, #2a2e39)",
                          borderRadius: 8,
                          color: copied ? "#000" : "var(--text-primary, #ffffff)",
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? "Copiado" : "Copiar"}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleCheckPixStatus}
                      disabled={checkingPix}
                      style={{
                        width: "100%",
                        padding: "10px",
                        background: "transparent",
                        border: "1px solid var(--primary, #22c55e)",
                        color: "var(--primary, #22c55e)",
                        fontWeight: 600,
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      {checkingPix && <Loader2 size={14} className="animate-spin" />}
                      Verificar Pagamento
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Credit Card Flow */}
            {method === "card" && (
              <form onSubmit={handleCardSubmit}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: "var(--text-secondary, #94a3b8)", display: "block", marginBottom: 4 }}>
                    Número do Cartão
                  </label>
                  <input
                    type="text"
                    maxLength={19}
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      background: "var(--surface-input, #0d0f14)",
                      border: "1px solid var(--border, #2a2e39)",
                      borderRadius: 8,
                      color: "var(--text-primary, #ffffff)",
                      fontSize: 16,
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: "var(--text-secondary, #94a3b8)", display: "block", marginBottom: 4 }}>
                    Nome Impresso no Cartão
                  </label>
                  <input
                    type="text"
                    placeholder="NOME COMO NO CARTAO"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      background: "var(--surface-input, #0d0f14)",
                      border: "1px solid var(--border, #2a2e39)",
                      borderRadius: 8,
                      color: "var(--text-primary, #ffffff)",
                      fontSize: 16,
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "var(--text-secondary, #94a3b8)", display: "block", marginBottom: 4 }}>
                      Validade (MM/AA)
                    </label>
                    <input
                      type="text"
                      maxLength={5}
                      placeholder="MM/AA"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "var(--surface-input, #0d0f14)",
                        border: "1px solid var(--border, #2a2e39)",
                        borderRadius: 8,
                        color: "var(--text-primary, #ffffff)",
                        fontSize: 16,
                        outline: "none",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "var(--text-secondary, #94a3b8)", display: "block", marginBottom: 4 }}>
                      CVV
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="123"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "var(--surface-input, #0d0f14)",
                        border: "1px solid var(--border, #2a2e39)",
                        borderRadius: 8,
                        color: "var(--text-primary, #ffffff)",
                        fontSize: 16,
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "var(--primary, #22c55e)",
                    color: "#000",
                    fontWeight: 700,
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {loading ? "Processando pagamento..." : `Assinar por ${formatCurrency(price)}`}
                </button>
              </form>
            )}
          </div>

          {/* Right: Summary Box */}
          <div
            style={{
              background: "var(--surface-card, #0e1017)",
              border: "1px solid var(--border, #2a2e39)",
              borderRadius: 12,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary, #94a3b8)", margin: "0 0 16px", textTransform: "uppercase" }}>
                Resumo do Pedido
              </h3>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 14, color: "var(--text-primary, #ffffff)", fontWeight: 600 }}>
                  Plano {plan.name}
                </span>
                <span style={{ fontSize: 14, color: "var(--text-primary, #ffffff)", fontWeight: 700 }}>
                  {formatCurrency(price)}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: "var(--text-secondary, #94a3b8)" }}>
                <span>Capacidade:</span>
                <span style={{ color: "var(--primary, #22c55e)", fontWeight: 600 }}>
                  1 Dono + até {plan.employeeLimit} funcionários
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: "var(--text-secondary, #94a3b8)" }}>
                <span>Intervalo:</span>
                <span>{billingInterval === "yearly" ? "Cobrança Anual" : "Cobrança Mensal"}</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: "var(--text-secondary, #94a3b8)" }}>
                <span>Clientes e Serviços:</span>
                <span style={{ color: "#4ade80" }}>Ilimitados</span>
              </div>

              <div style={{ height: 1, background: "var(--border, #2a2e39)", margin: "16px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary, #ffffff)" }}>
                  Total hoje:
                </span>
                <span style={{ fontSize: 22, fontWeight: 800, color: "var(--primary, #22c55e)" }}>
                  {formatCurrency(price)}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary, #94a3b8)", fontSize: 12 }}>
              <ShieldCheck size={16} color="var(--primary, #22c55e)" />
              <span>Pagamento 100% seguro com criptografia de ponta a ponta.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
