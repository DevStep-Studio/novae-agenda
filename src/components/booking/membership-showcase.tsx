"use client";

import { useState } from "react";
import {
  Sparkles,
  CalendarCheck,
  CalendarPlus,
  Check,
  X,
  Phone,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  Clock3,
  Star,
  AlertTriangle,
} from "lucide-react";
import { api, ApiError, formatPhoneForWhatsApp, maskPhoneInput } from "@/lib/api-client";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { money } from "./primitives";
import { PinInput } from "./pin-input";
import type { CustomerMembershipDTO, MembershipPlanDTO } from "@/shared/types";
import styles from "./membership-card.module.css";

/* ========================================================
   MEMBERSHIP PLAN CARD
   ======================================================== */
export function MembershipPlanCard({
  plan,
  onInspect,
  onSouMensalista,
}: {
  plan: MembershipPlanDTO;
  onInspect: (plan: MembershipPlanDTO) => void;
  onSouMensalista: (plan: MembershipPlanDTO) => void;
}) {
  const isWeekly = plan.frequencyType === "WEEKLY_CALENDAR_BASED";
  const frequencyLabel = isWeekly
    ? plan.weeklyFrequency === 1
      ? "Semanal (4 a 5x/mês)"
      : `${plan.weeklyFrequency}x por semana`
    : `${plan.sessionsPerPeriod} atendimentos/mês`;

  const estimatedSessions = isWeekly ? 4.3 : plan.sessionsPerPeriod || 4;
  const pricePerSession = Math.round(plan.price / estimatedSessions);

  return (
    <div className={styles.planCard}>
      <div>
        {/* Header & Badges */}
        <div className={styles.cardHeader}>
          <div className={styles.badgeRow}>
            <span
              className={styles.frequencyBadge}
              style={{
                color: plan.badgeColor || "var(--brand-primary, #818cf8)",
                background: `${plan.badgeColor || "#6366f1"}1a`,
                borderColor: `${plan.badgeColor || "#6366f1"}33`,
              }}
            >
              <Sparkles size={12} />
              {frequencyLabel}
            </span>
            <span className={styles.benefitBadge} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <Star size={11} />
              <span>Horários Fixos</span>
            </span>
          </div>

          <h3 className={styles.planTitle}>{plan.name}</h3>

          {plan.description && (
            <p className={styles.planDescription}>{plan.description}</p>
          )}
        </div>

        {/* Inclusions & Key Perks */}
        <div className={styles.inclusionsSection}>
          <span className={styles.inclusionsLabel}>Serviços Inclusos:</span>
          <div className={styles.servicesList}>
            {(plan.services || []).map((svc) => (
              <span key={svc.id} className={styles.serviceChip}>
                <Check size={13} color="#34d399" />
                {svc.name}
              </span>
            ))}
          </div>

          <ul className={styles.perksList}>
            <li className={styles.perkItem}>
              <Check size={13} className={styles.perkIcon} />
              <span>Escolha todas as datas do seu mês de uma só vez</span>
            </li>
            <li className={styles.perkItem}>
              <Check size={13} className={styles.perkIcon} />
              <span>Horários garantidos sem risco de fila</span>
            </li>
            {plan.allowReschedule && (
              <li className={styles.perkItem}>
                <Check size={13} className={styles.perkIcon} />
                <span>Remarcação permitida com até {plan.rescheduleHoursNotice}h</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Pricing & Dual CTA Buttons */}
      <div className={styles.cardFooter}>
        <div className={styles.pricingBlock}>
          <div className={styles.priceDisplay}>
            <span className={styles.priceValue}>{money(plan.price)}</span>
            <span className={styles.pricePeriod}>/mês</span>
          </div>
          {pricePerSession > 0 && (
            <span className={styles.priceEconomy}>
              ~{money(pricePerSession)}/sessão
            </span>
          )}
        </div>

        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => onSouMensalista(plan)}
            title="Já é mensalista? Clique para escolher suas datas de agendamento"
          >
            <CalendarCheck size={15} />
            <span>Sou Mensalista</span>
          </button>

          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => onInspect(plan)}
            title="Falar no WhatsApp para contratar este plano"
          >
            <WhatsAppIcon size={14} />
            <span>Falar no WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================================================
   ACTIVE MEMBERSHIP VIP BANNER
   ======================================================== */
export function ActiveMembershipBanner({
  membership,
  onScheduleMonth,
}: {
  membership: CustomerMembershipDTO;
  onScheduleMonth: () => void;
}) {
  const booked = membership.currentPeriod?.sessionsBooked || 0;
  const allowance = membership.currentPeriod?.sessionAllowance || 4;
  const remaining = membership.currentPeriod?.sessionsRemaining ?? Math.max(0, allowance - booked);
  const progress = Math.min(100, Math.round((booked / allowance) * 100));

  return (
    <div className={styles.activeBanner}>
      <div className={styles.activeHeader}>
        <div className={styles.activeTitleGroup}>
          <span className={styles.activeVipTag}>
            <Sparkles size={12} /> Seu Plano Ativo · Mensalista VIP
          </span>
          <h3 className={styles.activePlanName}>{membership.membershipPlanName}</h3>
        </div>

        <button
          type="button"
          className={styles.btnPrimary}
          onClick={onScheduleMonth}
          style={{ padding: "10px 18px", fontSize: "0.88rem" }}
        >
          <CalendarPlus size={16} />
          <span>Agendar Meu Mês</span>
        </button>
      </div>

      <div className={styles.activeProgressSection}>
        <div className={styles.activeProgressText}>
          <span>
            <strong>{booked}</strong> de <strong>{allowance}</strong> sessões agendadas neste mês
          </span>
          <strong style={{ color: remaining > 0 ? "#34d399" : "var(--text-secondary)" }}>
            {remaining} {remaining === 1 ? "disponível" : "disponíveis"}
          </strong>
        </div>
        <div className={styles.activeProgressBarBg}>
          <div
            className={styles.activeProgressBarFill}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {membership.includedServices && membership.includedServices.length > 0 && (
        <div className={styles.activeBannerActions}>
          <div className={styles.activeServicesList}>
            <span style={{ fontSize: "0.75rem", color: "var(--booking-text-muted)" }}>
              Incluso:
            </span>
            {membership.includedServices.map((s) => (
              <span key={s.id} className={styles.serviceChip} style={{ fontSize: "0.74rem", padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 3 }}>
                <Check size={11} />
                <span>{s.name}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================================================
   SOU MENSALISTA ACCESS MODAL
   ======================================================== */
export function MembershipAccessModal({
  isOpen,
  onClose,
  onSuccess,
  company,
  planName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (membership: CustomerMembershipDTO, customer: any) => void;
  company: { name: string; slug: string; phone?: string | null; whatsapp?: string | null };
  planName?: string;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [requiresPin, setRequiresPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [noMembershipFound, setNoMembershipFound] = useState(false);

  if (!isOpen) return null;

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNoMembershipFound(false);
    setLoading(true);

    try {
      if (requiresPin) {
        if (pin.length !== 6) {
          setError("Digite os 6 dígitos do seu PIN.");
          setLoading(false);
          return;
        }

        const pinRes = await api<{ customer: any }>("/api/customer-access/pin/login", {
          method: "POST",
          body: JSON.stringify({ pin, phone }),
        });

        // Load membership
        const mem = await api<CustomerMembershipDTO>(
          `/api/my/membership?companySlug=${company.slug}`,
        ).catch(() => null);

        if (mem && mem.status === "active") {
          onSuccess(mem, pinRes.customer);
          onClose();
        } else {
          setNoMembershipFound(true);
        }
        return;
      }

      // Quick Identify / Phone check
      const idRes = await api<{ customer: any | null; hasPin: boolean }>(
        "/api/customer-access/identify",
        {
          method: "POST",
          body: JSON.stringify({
            phone,
            name: name.trim() || "Cliente Mensalista",
          }),
        },
      );

      if (idRes.hasPin) {
        setRequiresPin(true);
        setLoading(false);
        return;
      }

      // Fetch active membership for current establishment
      const mem = await api<CustomerMembershipDTO>(
        `/api/my/membership?companySlug=${company.slug}`,
      ).catch(() => null);

      if (mem && mem.status === "active") {
        onSuccess(mem, idRes.customer);
        onClose();
      } else {
        setNoMembershipFound(true);
      }
    } catch (err: any) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Erro ao localizar mensalidade.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handlePhoneChange(val: string) {
    const formatted = maskPhoneInput(val);
    setPhone(formatted);
    if (noMembershipFound) setNoMembershipFound(false);
    if (error) setError("");
  }

  const targetPhone = formatPhoneForWhatsApp(company.whatsapp || company.phone || "");
  const whatsappUrl = targetPhone
    ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(
        `Olá! Sou cliente do ${company.name} e gostaria de ativar/consultar minha mensalidade.`,
      )}`
    : null;

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={styles.modalCard}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Acesso de Mensalista"
      >
        <div className={styles.modalHeader}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className={styles.modalIconBadge}>
              <CalendarCheck size={22} />
            </div>
            <div>
              <h2 className={styles.modalTitle}>Sou Mensalista</h2>
              <p className={styles.modalSubtitle}>
                {requiresPin
                  ? "Digite seu PIN de 6 dígitos para carregar suas datas."
                  : "Informe seu WhatsApp cadastrado para escolher seus horários do mês."}
              </p>
            </div>
          </div>

          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className={styles.errorBanner}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <AlertTriangle size={13} />
              <span>{error}</span>
            </span>
          </div>
        )}

        {noMembershipFound ? (
          <div className={styles.notFoundBox}>
            <p className={styles.notFoundText}>
              Não encontramos uma mensalidade ativa vinculada a <strong>{phone}</strong> em {company.name}.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.btnPrimary}
                  style={{ textDecoration: "none" }}
                >
                  <Phone size={15} />
                  <span>Falar no WhatsApp para Ativar</span>
                </a>
              )}
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  setNoMembershipFound(false);
                  setRequiresPin(false);
                  setPhone("");
                }}
              >
                Tentar outro número
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={onClose}
                style={{ fontSize: "0.78rem" }}
              >
                Continuar e agendar serviço avulso
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePhoneSubmit} className={styles.modalForm}>
            {!requiresPin ? (
              <>
                <label className={styles.fieldLabel}>
                  WhatsApp / Celular com DDD *
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(11) 99999-9999"
                    maxLength={15}
                    className={styles.fieldInput}
                  />
                </label>

                <label className={styles.fieldLabel}>
                  Seu Nome (opcional)
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome ou apelido"
                    className={styles.fieldInput}
                  />
                </label>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--booking-text-secondary)" }}>
                    Celular: <strong>{phone}</strong>
                  </span>
                </div>
                <div style={{ margin: "4px auto 8px" }}>
                  <PinInput
                    id="mensalista-auth-pin"
                    value={pin}
                    onChange={setPin}
                    length={6}
                    theme="light"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={loading || (requiresPin ? pin.length !== 6 : phone.replace(/\D/g, "").length < 10)}
              style={{ padding: "12px", fontSize: "0.9rem" }}
            >
              {loading ? (
                <>
                  <Clock3 size={16} className="animate-spin" />
                  <span>Localizando plano...</span>
                </>
              ) : (
                <>
                  <CalendarCheck size={16} />
                  <span>{requiresPin ? "Confirmar PIN e Acessar" : "Localizar Minha Mensalidade"}</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
