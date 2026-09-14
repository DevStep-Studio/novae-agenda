"use client";

import { useState, useEffect, useCallback } from "react";
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
  Lock,
  Sparkles,
  Tag,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/client-utils";

export interface CheckoutPlan {
  id?: string;
  slug: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  employeeLimit: number;
  badge?: string | null;
  sortOrder?: number;
}

interface TransparentCheckoutModalProps {
  plan: CheckoutPlan;
  billingInterval: "monthly" | "yearly";
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  availablePlans?: CheckoutPlan[];
  onSelectPlan?: (plan: CheckoutPlan) => void;
}

type CardBrand = "visa" | "mastercard" | "elo" | "amex" | "hipercard" | "generic";

function detectCardBrand(number: string): CardBrand {
  const clean = number.replace(/\D/g, "");
  if (/^4/.test(clean)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(clean)) return "mastercard";
  if (/^(4011|4389|5041|5067|5090|6277|6362|6363)/.test(clean)) return "elo";
  if (/^3[47]/.test(clean)) return "amex";
  if (/^(606282|3841)/.test(clean)) return "hipercard";
  return "generic";
}

function BrandLogo({ brand }: { brand: CardBrand }) {
  switch (brand) {
    case "visa":
      return (
        <span style={{ fontWeight: 900, fontStyle: "italic", fontSize: 16, color: "#93c5fd", letterSpacing: 1 }}>
          VISA
        </span>
      );
    case "mastercard":
      return (
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#ef4444", opacity: 0.9, display: "inline-block" }} />
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#f59e0b", opacity: 0.9, marginLeft: -6, display: "inline-block" }} />
        </div>
      );
    case "elo":
      return (
        <span style={{ fontWeight: 800, fontSize: 13, color: "#facc15", letterSpacing: "0.05em" }}>
          ELO
        </span>
      );
    case "amex":
      return (
        <span style={{ fontWeight: 900, fontSize: 13, color: "#38bdf8", letterSpacing: "0.05em" }}>
          AMEX
        </span>
      );
    case "hipercard":
      return (
        <span style={{ fontWeight: 800, fontSize: 12, color: "#f87171" }}>
          HIPER
        </span>
      );
    default:
      return <CreditCard size={18} style={{ color: "rgba(255, 255, 255, 0.5)" }} />;
  }
}

export function TransparentCheckoutModal({
  plan,
  billingInterval: initialBillingInterval,
  isOpen,
  onClose,
  onSuccess,
  availablePlans,
  onSelectPlan,
}: TransparentCheckoutModalProps) {
  const [selectedInterval, setSelectedInterval] = useState<"monthly" | "yearly">(initialBillingInterval);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSuccessCompleted, setIsSuccessCompleted] = useState(false);

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

  // Coupon state
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    finalPrice: number;
    isZeroTotal: boolean;
    name?: string;
  } | null>(null);

  const rawBasePrice = selectedInterval === "yearly" ? plan.annualPrice : plan.monthlyPrice;
  const finalPrice = appliedCoupon ? appliedCoupon.finalPrice : rawBasePrice;
  const isFreePlan = appliedCoupon?.isZeroTotal;

  // Reset state on close
  const handleClose = useCallback(() => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSuccessCompleted(false);
    setPixData(null);
    setCopied(false);
    setCardNumber("");
    setCardHolder("");
    setCardExpiry("");
    setCardCvv("");
    setAppliedCoupon(null);
    setCouponCode("");
    onClose();
  }, [onClose]);

  // Card input formatters
  const handleCardNumberChange = (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 16);
    const parts = raw.match(/[\s\S]{1,4}/g) || [];
    setCardNumber(parts.join(" "));
  };

  const handleExpiryChange = (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 4);
    if (raw.length >= 3) {
      setCardExpiry(`${raw.slice(0, 2)}/${raw.slice(2, 4)}`);
    } else {
      setCardExpiry(raw);
    }
  };

  const handleCvvChange = (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 4);
    setCardCvv(raw);
  };

  // Generate PIX
  const handleGeneratePix = async (customInterval?: "monthly" | "yearly") => {
    const intervalToUse = customInterval || selectedInterval;
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
          billingInterval: intervalToUse,
          couponCode: appliedCoupon?.code || undefined,
        }),
      });

      setPixData(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Não foi possível gerar a cobrança PIX. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Handle switching interval
  const handleIntervalChange = (newInterval: "monthly" | "yearly") => {
    setSelectedInterval(newInterval);
    setPixData(null);
    if (method === "pix") {
      void handleGeneratePix(newInterval);
    }
  };

  // Handle method change
  const handleMethodChange = (newMethod: "pix" | "card") => {
    setMethod(newMethod);
    if (newMethod === "pix" && !pixData) {
      void handleGeneratePix();
    }
  };

  // Automated Real-Time Polling for PIX status
  useEffect(() => {
    if (!isOpen || method !== "pix" || !pixData?.invoiceId || isSuccessCompleted) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const res = await api<{ paid: boolean; status: string }>(
          `/api/saas/checkout/status?invoiceId=${pixData.invoiceId}`
        );

        if (res?.paid) {
          setIsSuccessCompleted(true);
          setSuccessMsg("Pagamento confirmado via PIX com sucesso!");
          setTimeout(() => {
            onSuccess();
            handleClose();
          }, 2400);
        }
      } catch {
        // Silently continue polling
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [isOpen, method, pixData?.invoiceId, isSuccessCompleted, onSuccess, handleClose]);

  // Manual check button
  const handleCheckPixManual = async () => {
    if (!pixData?.invoiceId) return;
    setCheckingPix(true);
    setErrorMsg(null);
    try {
      const res = await api<{ paid: boolean; status: string }>(
        `/api/saas/checkout/status?invoiceId=${pixData.invoiceId}`
      );

      if (res?.paid) {
        setIsSuccessCompleted(true);
        setSuccessMsg("Pagamento confirmado via PIX com sucesso!");
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2200);
      } else {
        setErrorMsg("Pagamento ainda em processamento. Assim que seu banco confirmar, a tela atualizará automaticamente.");
      }
    } catch {
      setErrorMsg("Erro ao verificar status. Tente novamente em alguns segundos.");
    } finally {
      setCheckingPix(false);
    }
  };

  const handleCopyPix = () => {
    if (!pixData?.copiaECola) return;
    void navigator.clipboard.writeText(pixData.copiaECola);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Validate coupon
  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!couponCode.trim()) return;

    setCouponApplying(true);
    setErrorMsg(null);
    try {
      const res = await api<{
        valid: boolean;
        originalPrice: number;
        discountAmount: number;
        finalPrice: number;
        isZeroTotal: boolean;
        coupon: { name: string; code: string };
      }>("/api/saas/coupons/validate", {
        method: "POST",
        body: JSON.stringify({
          couponCode: couponCode.trim(),
          planSlug: plan.slug,
          billingInterval: selectedInterval,
        }),
      });

      if (res?.valid) {
        setAppliedCoupon({
          code: couponCode.trim().toUpperCase(),
          discountAmount: res.discountAmount,
          finalPrice: res.finalPrice,
          isZeroTotal: res.isZeroTotal,
          name: res.coupon?.name,
        });
        setErrorMsg(null);
        if (pixData) setPixData(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Cupom inválido ou expirado.");
    } finally {
      setCouponApplying(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    if (pixData) setPixData(null);
  };

  // Card submission
  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFreePlan) {
      const cleanNum = cardNumber.replace(/\s+/g, "");
      if (cleanNum.length < 13 || !cardHolder.trim() || cardExpiry.length < 5 || cardCvv.length < 3) {
        setErrorMsg("Por favor, preencha todos os dados do cartão corretamente.");
        return;
      }
    }

    setLoading(true);
    setErrorMsg(null);

    try {
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
          billingInterval: selectedInterval,
          cardToken: isFreePlan ? undefined : mockToken,
          installments: isFreePlan ? 1 : installments,
          couponCode: appliedCoupon?.code || undefined,
        }),
      });

      if (res?.approved) {
        setIsSuccessCompleted(true);
        setSuccessMsg(res.message || "Assinatura ativada com sucesso!");
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2200);
      } else {
        setErrorMsg(res?.message || "Pagamento recusado. Verifique os dados ou utilize o PIX.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Não foi possível concluir o pagamento. Verifique os dados do cartão.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const detectedBrand = detectCardBrand(cardNumber);
  const cardDisplayNumber = cardNumber
    ? cardNumber.padEnd(19, "•").replace(/(\d{4}|\w{4})/g, "$1 ")
    : "•••• •••• •••• ••••";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(5, 7, 13, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
        overflowY: "auto",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 880,
          background: "var(--surface, #11131a)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 20,
          boxShadow: "0 24px 70px -10px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.04)",
          overflow: "hidden",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Ambient Radial Glow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "70%",
            height: 140,
            background: "radial-gradient(ellipse at top, rgba(34, 197, 94, 0.12), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Modal Header */}
        <div
          style={{
            padding: "20px 26px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary, #22c55e)",
              }}
            >
              <Zap size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--primary, #22c55e)",
                  }}
                >
                  Checkout Seguro Reservei
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    background: "rgba(255, 255, 255, 0.06)",
                    color: "rgba(255, 255, 255, 0.7)",
                    padding: "2px 8px",
                    borderRadius: 12,
                  }}
                >
                  <Lock size={10} /> 256-bit SSL
                </span>
              </div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  margin: "2px 0 0",
                  color: "var(--text-primary, #ffffff)",
                  letterSpacing: "-0.02em",
                }}
              >
                Assinar Plano {plan.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar checkout"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              color: "var(--text-secondary, #94a3b8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Success Confirmation Screen */}
        {isSuccessCompleted ? (
          <div
            style={{
              padding: "60px 32px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(34, 197, 94, 0.15)",
                border: "2px solid var(--primary, #22c55e)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary, #22c55e)",
                marginBottom: 20,
                boxShadow: "0 0 30px rgba(34, 197, 94, 0.3)",
              }}
            >
              <CheckCircle2 size={42} />
            </div>

            <h3 style={{ fontSize: 24, fontWeight: 900, color: "#ffffff", margin: "0 0 8px" }}>
              Assinatura Confirmada!
            </h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary, #94a3b8)", maxWidth: 440, margin: "0 0 24px" }}>
              {successMsg || `Seu Plano ${plan.name} foi ativado com sucesso para todo o seu estabelecimento.`}
            </p>

            <div
              style={{
                padding: "12px 20px",
                background: "rgba(34, 197, 94, 0.08)",
                border: "1px solid rgba(34, 197, 94, 0.2)",
                borderRadius: 12,
                fontSize: 13,
                color: "var(--primary, #22c55e)",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Sparkles size={16} /> Liberando acesso imediato à sua equipe...
            </div>
          </div>
        ) : (
          /* Main Checkout Body: Grid Layout */
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: 0,
            }}
          >
            {/* Left Column: Payment Methods & Inputs */}
            <div
              style={{
                padding: "24px 28px",
                borderRight: "1px solid rgba(255, 255, 255, 0.06)",
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {/* Payment Method Switcher Tabs */}
              <div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--text-secondary, #94a3b8)",
                    display: "block",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Forma de Pagamento
                </span>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    background: "rgba(0, 0, 0, 0.3)",
                    padding: 4,
                    borderRadius: 12,
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleMethodChange("pix")}
                    style={{
                      padding: "10px 14px",
                      background: method === "pix" ? "rgba(34, 197, 94, 0.15)" : "transparent",
                      border: method === "pix" ? "1px solid var(--primary, #22c55e)" : "1px solid transparent",
                      borderRadius: 9,
                      color: method === "pix" ? "var(--primary, #22c55e)" : "var(--text-secondary, #94a3b8)",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <QrCode size={16} />
                    <span>PIX Instantâneo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMethodChange("card")}
                    style={{
                      padding: "10px 14px",
                      background: method === "card" ? "rgba(34, 197, 94, 0.15)" : "transparent",
                      border: method === "card" ? "1px solid var(--primary, #22c55e)" : "1px solid transparent",
                      borderRadius: 9,
                      color: method === "card" ? "var(--primary, #22c55e)" : "var(--text-secondary, #94a3b8)",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <CreditCard size={16} />
                    <span>Cartão de Crédito</span>
                  </button>
                </div>
              </div>

              {/* Alert Feedback Messages */}
              {errorMsg && (
                <div
                  style={{
                    padding: "12px 14px",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: 10,
                    color: "#fca5a5",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    lineHeight: 1.4,
                  }}
                >
                  <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 2, color: "#ef4444" }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* PIX Flow */}
              {method === "pix" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {loading && !pixData && (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary, #94a3b8)" }}>
                      <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 12px", color: "var(--primary, #22c55e)" }} />
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Gerando cobrança PIX oficial do Reservei...</p>
                    </div>
                  )}

                  {pixData && !loading && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {/* Stylized QR Container */}
                      <div
                        style={{
                          background: "#ffffff",
                          padding: 16,
                          borderRadius: 16,
                          width: 200,
                          height: 200,
                          margin: "0 auto",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
                          position: "relative",
                        }}
                      >
                        {pixData.qrCode ? (
                          <Image
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(
                              pixData.copiaECola
                            )}`}
                            alt="QR Code PIX Reservei"
                            width={168}
                            height={168}
                            unoptimized
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                        ) : (
                          <QrCode size={130} color="#000" />
                        )}
                      </div>

                      {/* Live Polling Status Indicator */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          fontSize: 12,
                          color: "var(--primary, #22c55e)",
                          background: "rgba(34, 197, 94, 0.08)",
                          padding: "8px 12px",
                          borderRadius: 20,
                          border: "1px solid rgba(34, 197, 94, 0.15)",
                          margin: "0 auto",
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "var(--primary, #22c55e)",
                            boxShadow: "0 0 8px var(--primary, #22c55e)",
                          }}
                        />
                        <span style={{ fontWeight: 600 }}>Aguardando pagamento • Confirmação instantânea</span>
                      </div>

                      {/* Copia e Cola Input */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary, #94a3b8)", textTransform: "uppercase" }}>
                            PIX Copia e Cola
                          </label>
                          <span style={{ fontSize: 11, color: "var(--text-secondary, #94a3b8)" }}>
                            Validade de 15 min
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            type="text"
                            readOnly
                            value={pixData.copiaECola}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            style={{
                              flex: 1,
                              padding: "10px 14px",
                              background: "rgba(0, 0, 0, 0.4)",
                              border: "1px solid rgba(255, 255, 255, 0.08)",
                              borderRadius: 10,
                              color: "#ffffff",
                              fontSize: 12,
                              fontFamily: "monospace",
                              outline: "none",
                              textOverflow: "ellipsis",
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleCopyPix}
                            style={{
                              padding: "10px 16px",
                              background: copied ? "var(--primary, #22c55e)" : "rgba(255, 255, 255, 0.08)",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              borderRadius: 10,
                              color: copied ? "#000000" : "#ffffff",
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              transition: "all 0.15s ease",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            {copied ? "Copiado!" : "Copiar"}
                          </button>
                        </div>
                      </div>

                      {/* Fallback Check Button */}
                      <button
                        type="button"
                        onClick={handleCheckPixManual}
                        disabled={checkingPix}
                        style={{
                          width: "100%",
                          padding: "11px",
                          background: "transparent",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          color: "var(--text-secondary, #94a3b8)",
                          fontWeight: 600,
                          borderRadius: 10,
                          cursor: "pointer",
                          fontSize: 13,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          transition: "all 0.15s ease",
                        }}
                      >
                        {checkingPix ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                        {checkingPix ? "Checando pagamento..." : "Já realizei o pagamento (Verificar)"}
                      </button>
                    </div>
                  )}

                  {!pixData && !loading && (
                    <button
                      type="button"
                      onClick={() => handleGeneratePix()}
                      style={{
                        width: "100%",
                        padding: "14px",
                        background: "var(--primary, #22c55e)",
                        color: "#000000",
                        fontWeight: 800,
                        borderRadius: 12,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 14,
                        transition: "all 0.15s ease",
                      }}
                    >
                      Gerar Código PIX
                    </button>
                  )}
                </div>
              )}

              {/* Credit Card Flow */}
              {method === "card" && (
                <form onSubmit={handleCardSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Interactive Virtual Card Preview */}
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 360,
                      margin: "0 auto 4px",
                      aspectRatio: "1.586",
                      borderRadius: 14,
                      background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      boxShadow: "0 12px 28px -6px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
                      padding: "18px 20px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* Glass Sheen */}
                    <div
                      style={{
                        position: "absolute",
                        top: -50,
                        right: -50,
                        width: 140,
                        height: 140,
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(255, 255, 255, 0.08), transparent 70%)",
                        pointerEvents: "none",
                      }}
                    />

                    {/* Card Top Row: Chip & Brand */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div
                        style={{
                          width: 34,
                          height: 24,
                          borderRadius: 5,
                          background: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)",
                          border: "1px solid rgba(0, 0, 0, 0.2)",
                          boxShadow: "inset 0 1px 2px rgba(255, 255, 255, 0.4)",
                        }}
                      />
                      <BrandLogo brand={detectedBrand} />
                    </div>

                    {/* Card Middle: Number */}
                    <div>
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: 16,
                          fontWeight: 700,
                          letterSpacing: 2,
                          color: "#ffffff",
                          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                        }}
                      >
                        {cardDisplayNumber}
                      </div>
                    </div>

                    {/* Card Bottom: Holder & Expiry */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div>
                        <div style={{ fontSize: 8, color: "rgba(255, 255, 255, 0.5)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Titular do Cartão
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#ffffff",
                            textTransform: "uppercase",
                            letterSpacing: 1,
                            maxWidth: 180,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {cardHolder || "NOME DO TITULAR"}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 8, color: "rgba(255, 255, 255, 0.5)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Validade
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: "monospace",
                            color: "#ffffff",
                          }}
                        >
                          {cardExpiry || "MM/AA"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Form Inputs */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary, #94a3b8)", display: "block", marginBottom: 5, textTransform: "uppercase" }}>
                      Número do Cartão
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        maxLength={19}
                        placeholder="0000 0000 0000 0000"
                        value={cardNumber}
                        onChange={(e) => handleCardNumberChange(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          paddingRight: 40,
                          background: "rgba(0, 0, 0, 0.3)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: 10,
                          color: "#ffffff",
                          fontSize: 14,
                          fontFamily: "monospace",
                          outline: "none",
                        }}
                      />
                      <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
                        <BrandLogo brand={detectedBrand} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary, #94a3b8)", display: "block", marginBottom: 5, textTransform: "uppercase" }}>
                      Nome Impresso no Cartão
                    </label>
                    <input
                      type="text"
                      placeholder="COMO IMPRESSO NO CARTÃO"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "rgba(0, 0, 0, 0.3)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 10,
                        color: "#ffffff",
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary, #94a3b8)", display: "block", marginBottom: 5, textTransform: "uppercase" }}>
                        Validade (MM/AA)
                      </label>
                      <input
                        type="text"
                        maxLength={5}
                        placeholder="12/28"
                        value={cardExpiry}
                        onChange={(e) => handleExpiryChange(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          background: "rgba(0, 0, 0, 0.3)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: 10,
                          color: "#ffffff",
                          fontSize: 13,
                          fontFamily: "monospace",
                          outline: "none",
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary, #94a3b8)", display: "block", marginBottom: 5, textTransform: "uppercase" }}>
                        CVV
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="•••"
                        value={cardCvv}
                        onChange={(e) => handleCvvChange(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          background: "rgba(0, 0, 0, 0.3)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: 10,
                          color: "#ffffff",
                          fontSize: 13,
                          fontFamily: "monospace",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary, #94a3b8)", display: "block", marginBottom: 5, textTransform: "uppercase" }}>
                      Parcelamento
                    </label>
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "rgba(0, 0, 0, 0.3)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 10,
                        color: "#ffffff",
                        fontSize: 13,
                        outline: "none",
                      }}
                    >
                      <option value={1}>1x de {formatCurrency(finalPrice)} (sem juros)</option>
                      {finalPrice >= 60 && (
                        <option value={2}>2x de {formatCurrency(finalPrice / 2)} (sem juros)</option>
                      )}
                      {finalPrice >= 90 && (
                        <option value={3}>3x de {formatCurrency(finalPrice / 3)} (sem juros)</option>
                      )}
                      {finalPrice >= 180 && (
                        <option value={6}>6x de {formatCurrency(finalPrice / 6)} (sem juros)</option>
                      )}
                      {finalPrice >= 360 && (
                        <option value={12}>12x de {formatCurrency(finalPrice / 12)} (sem juros)</option>
                      )}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: "13px",
                      background: "var(--primary, #22c55e)",
                      color: "#000000",
                      fontWeight: 800,
                      borderRadius: 12,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      marginTop: 4,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {loading
                      ? "Processando pagamento..."
                      : isFreePlan
                      ? "Ativar Assinatura Gratuita (100% OFF)"
                      : `Pagar e Assinar — ${formatCurrency(finalPrice)}`}
                  </button>
                </form>
              )}

              {/* Coupon Accordion */}
              <div
                style={{
                  borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                  paddingTop: 14,
                }}
              >
                {!appliedCoupon ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowCouponInput(!showCouponInput)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--text-secondary, #94a3b8)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: 0,
                      }}
                    >
                      <Tag size={13} color="var(--primary, #22c55e)" />
                      <span>Possui um cupom de desconto?</span>
                      {showCouponInput ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    {showCouponInput && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <input
                          type="text"
                          placeholder="Ex: RESERVEI10"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            background: "rgba(0, 0, 0, 0.3)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: 8,
                            color: "#ffffff",
                            fontSize: 12,
                            textTransform: "uppercase",
                            fontFamily: "monospace",
                            outline: "none",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleApplyCoupon()}
                          disabled={couponApplying || !couponCode.trim()}
                          style={{
                            padding: "8px 14px",
                            background: "rgba(255, 255, 255, 0.1)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: 8,
                            color: "#ffffff",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {couponApplying ? "Aplicando..." : "Aplicar"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "rgba(34, 197, 94, 0.08)",
                      border: "1px solid rgba(34, 197, 94, 0.2)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--primary, #22c55e)", fontWeight: 700 }}>
                      <Tag size={13} />
                      <span>Cupom {appliedCoupon.code} aplicado (-{formatCurrency(appliedCoupon.discountAmount)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "rgba(255, 255, 255, 0.5)",
                        cursor: "pointer",
                        fontSize: 11,
                        textDecoration: "underline",
                      }}
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Order Summary & Trust Guarantees */}
            <div
              style={{
                background: "rgba(0, 0, 0, 0.2)",
                padding: "24px 28px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 24,
              }}
            >
              <div>
                {/* Billing Interval Toggle Inside Summary */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary, #94a3b8)", textTransform: "uppercase" }}>
                      Ciclo de Cobrança
                    </span>
                    {selectedInterval === "yearly" && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          background: "var(--primary, #22c55e)",
                          color: "#000000",
                          padding: "2px 6px",
                          borderRadius: 8,
                        }}
                      >
                        2 MESES GRÁTIS
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 6,
                      background: "rgba(0, 0, 0, 0.3)",
                      padding: 4,
                      borderRadius: 10,
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleIntervalChange("monthly")}
                      style={{
                        padding: "7px 10px",
                        borderRadius: 7,
                        border: "none",
                        background: selectedInterval === "monthly" ? "rgba(255, 255, 255, 0.12)" : "transparent",
                        color: selectedInterval === "monthly" ? "#ffffff" : "var(--text-secondary, #94a3b8)",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      Mensal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleIntervalChange("yearly")}
                      style={{
                        padding: "7px 10px",
                        borderRadius: 7,
                        border: "none",
                        background: selectedInterval === "yearly" ? "rgba(255, 255, 255, 0.12)" : "transparent",
                        color: selectedInterval === "yearly" ? "#ffffff" : "var(--text-secondary, #94a3b8)",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      Anual (Desconto)
                    </button>
                  </div>
                </div>

                {/* Plan Highlights Box */}
                <div
                  style={{
                    padding: "16px",
                    borderRadius: 12,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#ffffff" }}>
                      Plano {plan.name}
                    </span>
                    {plan.badge && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          background: "var(--primary, #22c55e)",
                          color: "#000000",
                          padding: "2px 7px",
                          borderRadius: 10,
                        }}
                      >
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12, color: "var(--text-secondary, #94a3b8)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Check size={14} color="var(--primary, #22c55e)" />
                      <span>1 Proprietário incluso</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Check size={14} color="var(--primary, #22c55e)" />
                      <strong style={{ color: "#ffffff" }}>Até {plan.employeeLimit} profissionais da equipe</strong>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Check size={14} color="var(--primary, #22c55e)" />
                      <span>Agendamentos & Clientes ilimitados</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Check size={14} color="var(--primary, #22c55e)" />
                      <span>Página pública & Notificações</span>
                    </div>
                  </div>
                </div>

                {/* Price Breakdown */}
                <div>
                  <h4 style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary, #94a3b8)", textTransform: "uppercase", margin: "0 0 12px" }}>
                    Resumo de Valores
                  </h4>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8, color: "var(--text-secondary, #94a3b8)" }}>
                    <span>Valor base ({selectedInterval === "yearly" ? "Anual" : "Mensal"}):</span>
                    <span>{formatCurrency(rawBasePrice)}</span>
                  </div>

                  {selectedInterval === "yearly" && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8, color: "var(--primary, #22c55e)" }}>
                      <span>Economia (2 meses grátis):</span>
                      <span>- {formatCurrency(plan.monthlyPrice * 12 - plan.annualPrice)}</span>
                    </div>
                  )}

                  {appliedCoupon && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8, color: "var(--primary, #22c55e)" }}>
                      <span>Desconto Cupom ({appliedCoupon.code}):</span>
                      <span>- {formatCurrency(appliedCoupon.discountAmount)}</span>
                    </div>
                  )}

                  <div style={{ height: 1, background: "rgba(255, 255, 255, 0.08)", margin: "14px 0" }} />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", display: "block" }}>
                        Total a pagar:
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-secondary, #94a3b8)" }}>
                        {selectedInterval === "yearly" ? "cobrado anualmente" : "cobrado mensalmente"}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 26,
                        fontWeight: 900,
                        color: isFreePlan ? "#4ade80" : "var(--primary, #22c55e)",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {formatCurrency(finalPrice)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trust Footer */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  paddingTop: 16,
                  borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                  fontSize: 11,
                  color: "rgba(255, 255, 255, 0.5)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <ShieldCheck size={14} color="var(--primary, #22c55e)" />
                  <span>Ativação instantânea do seu plano após confirmação.</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Lock size={14} color="var(--primary, #22c55e)" />
                  <span>Dados protegidos e processados de forma 100% segura.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
