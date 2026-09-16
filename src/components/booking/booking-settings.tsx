/* eslint-disable react-hooks/set-state-in-effect -- Synchronizes server availability, URL state and persisted booking drafts. */
"use client";

import { useEffect, useState, useRef, type FormEvent } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import {
  Copy,
  Check,
  ExternalLink,
  Plus,
  QrCode,
  Share2,
  Trash2,
  Globe,
  Building2,
  Phone,
  Clock,
  Palette,
  Sparkles,
  ShoppingBag,
  Tag,
  Download,
  Zap,
  Upload,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { api } from "@/lib/api-client";
import { prepareImageUpload } from "@/lib/image-upload-client";
import { useStore } from "@/store/store";
import { ErrorMessage, money, Skeleton } from "./primitives";
import { BrandingStudio } from "./branding-studio";
import type { companies, coupons, products } from "@/db/schema";
import styles from "./booking-settings.module.css";

type Schedule = {
  employeeId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  active: boolean;
};

type Data = {
  company: typeof companies.$inferSelect;
  schedules: Schedule[];
  products: Array<typeof products.$inferSelect>;
  coupons: Array<typeof coupons.$inferSelect>;
  funnel: Array<{ event: string; count: number }>;
};

const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export function BookingSettings() {
  const {
    employees,
    notify,
    settings,
    updateSettings,
    reloadEmployees,
    reloadSession,
  } = useStore();

  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState("");
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [interval, setIntervalValue] = useState(30);
  const [cancellation, setCancellation] = useState(24);
  const [color, setColor] = useState("#234e3d");
  const [activeTab, setActiveTab] = useState<"branding" | "link" | "schedules" | "extras">("branding");

  // State for toggles
  const [publicEnabled, setPublicEnabled] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [showInstagram, setShowInstagram] = useState(true);
  const [allowProducts, setAllowProducts] = useState(false);

  // Logo & Photos upload states
  const [logoUrl, setLogoUrl] = useState("");
  const [photosText, setPhotosText] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const result = await api<Data>("/api/booking-settings");
    setData(result);
    const initialSlug =
      result.company.publicSlug ||
      result.company.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60);

    setSlug(initialSlug);
    setColor(result.company.publicColor || "#234e3d");
    setCancellation(result.company.cancellationHours);
    setPublicEnabled(result.company.publicEnabled);
    setShowPhone(result.company.publicPhone);
    setShowInstagram(result.company.publicInstagram);
    setAllowProducts(result.company.allowProducts);
    setLogoUrl(result.company.logoUrl ?? "");
    setPhotosText((result.company.publicPhotos ?? []).join("\n"));

    if (result.company.publicSlug) {
      setUrl(`${window.location.origin}/agendar/${result.company.publicSlug}`);
    } else {
      setUrl(`${window.location.origin}/agendar/${initialSlug}`);
    }
  }

  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setIntervalValue(settings?.slotIntervalMinutes ?? 30);
  }, [settings?.slotIntervalMinutes]);

  useEffect(() => {
    if (data && employeeId) {
      setSchedule(
        data.schedules
          .filter((s) => s.employeeId === employeeId)
          .map((s) => ({
            ...s,
            startTime: s.startTime.slice(0, 5),
            endTime: s.endTime.slice(0, 5),
            breakStart: s.breakStart?.slice(0, 5) || null,
            breakEnd: s.breakEnd?.slice(0, 5) || null,
          })),
      );
    }
  }, [data, employeeId]);

  useEffect(() => {
    if (url) {
      void QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
        color: { dark: "#080808", light: "#ffffff" },
      })
        .then(setQr)
        .catch(() => setError("Não foi possível gerar o QR Code."));
    }
  }, [url]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/booking-settings", {
        method: "PUT",
        body: JSON.stringify({
          slug: slug.trim(),
          enabled: publicEnabled,
          name: f.get("name"),
          description: f.get("description"),
          category: f.get("category"),
          address: f.get("address"),
          phone: f.get("phone"),
          whatsapp: f.get("whatsapp"),
          instagram: f.get("instagram"),
          logoUrl: logoUrl.trim() || null,
          photos: photosText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          color,
          showPhone,
          showInstagram,
          cancellationHours: cancellation,
          allowProducts,
          timezone: f.get("timezone"),
        }),
      });
      await load();
      await reloadSession();
      notify("Página de agendamento atualizada com sucesso!");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveSchedule() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/employees/${employeeId}/schedules`, {
        method: "PUT",
        body: JSON.stringify({
          schedules: schedule.length
            ? schedule
            : [
                {
                  dayOfWeek: 0,
                  startTime: "08:00",
                  endTime: "18:00",
                  active: false,
                },
              ],
        }),
      });
      await updateSettings({ slotIntervalMinutes: interval });
      await load();
      await reloadEmployees();
      await reloadSession();
      notify("Disponibilidade atualizada com sucesso!");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createExtra(
    e: FormEvent<HTMLFormElement>,
    kind: "product" | "coupon",
  ) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await api("/api/booking-settings", {
        method: "POST",
        body: JSON.stringify(
          kind === "product"
            ? { kind, name: f.get("name"), price: Number(f.get("price")) }
            : {
                kind,
                code: f.get("code"),
                type: f.get("type"),
                value: Number(f.get("value")),
              },
        ),
      });
      form.reset();
      await load();
      await reloadSession();
      notify(kind === "product" ? "Produto cadastrado com sucesso." : "Cupom cadastrado com sucesso.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      notify("Link copiado para a área de transferência.");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError("Não foi possível copiar. Selecione o endereço e copie manualmente.");
    }
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: data?.company.name,
          text: `Agende seu horário com ${data?.company.name}:`,
          url,
        });
      } else {
        await copy();
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError("Não foi possível compartilhar.");
      }
    }
  }

  if (!data) {
    return (
      <div className={styles.container}>
        <ErrorMessage message={error} />
        <Skeleton label="Carregando configurações do link..." />
      </div>
    );
  }

  const c = data.company;

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.header}>
        <span className={styles.eyebrow}>Sua agenda, a um clique de distância</span>
        <h1 className={styles.title}>Link de agendamento</h1>
        <p className={styles.subtitle}>
          Receba reservas pelo Instagram, WhatsApp ou onde seus clientes estiverem.
        </p>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Navigation Tabs */}
      <nav className={styles.tabNav} aria-label="Abas de personalização e agendamento">
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "branding" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("branding")}
        >
          <Palette size={16} />
          Identidade & Branding Studio
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "link" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("link")}
        >
          <Globe size={16} />
          Link & Informações
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "schedules" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("schedules")}
        >
          <Clock size={16} />
          Horários da Equipe
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "extras" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("extras")}
        >
          <ShoppingBag size={16} />
          Produtos & Cupons
        </button>
      </nav>

      {/* Tab: Branding Studio */}
      {activeTab === "branding" && (
        <BrandingStudio onSaved={() => void load()} />
      )}

      {/* Tab: Link & Informações */}
      {activeTab === "link" && (
        <>
          {/* Hero Link Card */}
          <div className={styles.heroCard}>
        <div className={styles.heroCardHeader}>
          <div className={styles.heroCardTitle}>
            <Globe size={18} style={{ color: "var(--primary)" }} />
            <span>Seu link público</span>
          </div>
          {publicEnabled ? (
            <span className={styles.statusPillActive}>
              <span className={styles.statusDot} />
              Página ativa
            </span>
          ) : (
            <span className={styles.statusPillInactive}>
              Página desativada
            </span>
          )}
        </div>

        <div className={styles.urlBar}>
          <span className={styles.urlText}>{url || `/agendar/${slug}`}</span>
          <div className={styles.urlActions}>
            <button type="button" className={styles.btnPrimary} onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copiado!" : "Copiar link"}
            </button>

            {url && (
              <a
                className={styles.btnSecondary}
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={14} />
                Visualizar
              </a>
            )}

            <button type="button" className={styles.btnSecondary} onClick={share}>
              <Share2 size={14} />
              Compartilhar
            </button>

            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setShowQr(!showQr)}
              style={showQr ? { background: "var(--primary-soft)", color: "var(--primary)" } : {}}
            >
              <QrCode size={14} />
              QR Code
            </button>
          </div>
        </div>

        {/* QR Code Collapsible */}
        {showQr && qr && (
          <div className={styles.qrSection}>
            <div className={styles.qrImageWrap}>
              <Image src={qr} className={styles.qrImage} alt="QR Code para agendar" width={140} height={140} unoptimized />
            </div>
            <div className={styles.qrContent}>
              <h4 className={styles.qrTitle}>QR Code para balcão e impressos</h4>
              <p className={styles.qrDesc}>
                Ideal para colocar na recepção, balcão, cartões de visita ou no feed do Instagram. Seus clientes apontam a câmera e agendam na hora.
              </p>
              <div className={styles.qrActions}>
                <a
                  className={styles.btnPrimary}
                  href={qr}
                  download={`agendar-${slug}.png`}
                >
                  <Download size={14} />
                  Baixar PNG
                </a>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={async () => {
                    const svg = await QRCode.toString(url, {
                      type: "svg",
                      margin: 2,
                    });
                    const objectUrl = URL.createObjectURL(
                      new Blob([svg], { type: "image/svg+xml" }),
                    );
                    const a = document.createElement("a");
                    a.href = objectUrl;
                    a.download = `agendar-${slug}.svg`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                  }}
                >
                  <Download size={14} />
                  Baixar SVG
                </button>
                <a
                  className={`${styles.btnSecondary} whatsapp-button`}
                  href={`https://wa.me/?text=${encodeURIComponent(`Agende seu horário conosco diretamente pelo link: ${url}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <WhatsAppIcon size={14} />
                  Enviar no WhatsApp
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Funnel Analytics Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border)" }}>
          <div style={{ padding: "12px", background: "var(--surface-secondary)", borderRadius: "8px", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block" }}>Acessos ao link</span>
            <strong style={{ fontSize: "18px", color: "#f2f7f4" }}>{data.funnel.find((f) => f.event === "view" || f.event === "page_view")?.count ?? 0}</strong>
            <small style={{ display: "block", fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>visitas na página</small>
          </div>
          <div style={{ padding: "12px", background: "var(--surface-secondary)", borderRadius: "8px", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block" }}>Escolheram horário</span>
            <strong style={{ fontSize: "18px", color: "#f2f7f4" }}>{data.funnel.find((f) => f.event === "slot_selection" || f.event === "service_selected")?.count ?? 0}</strong>
            <small style={{ display: "block", fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>etapa intermediária</small>
          </div>
          <div style={{ padding: "12px", background: "var(--surface-secondary)", borderRadius: "8px", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block" }}>Agendamentos</span>
            <strong style={{ fontSize: "18px", color: "var(--primary)" }}>{data.funnel.find((f) => f.event === "booking_completed" || f.event === "booking_created")?.count ?? 0}</strong>
            <small style={{ display: "block", fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>reservas confirmadas</small>
          </div>
          <div style={{ padding: "12px", background: "var(--primary-soft)", borderRadius: "8px", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block" }}>Conversão estimada</span>
            <strong style={{ fontSize: "18px", color: "var(--primary)" }}>
              {(() => {
                const v = data.funnel.find((f) => f.event === "view" || f.event === "page_view")?.count ?? 0;
                const b = data.funnel.find((f) => f.event === "booking_completed" || f.event === "booking_created")?.count ?? 0;
                return v > 0 ? ((b / v) * 100).toFixed(1) : "0.0";
              })()}%
            </strong>
            <small style={{ display: "block", fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>visitantes convertidos</small>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Card: Identificação da Página */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>
                <Building2 size={18} style={{ color: "var(--primary)" }} />
                Identificação do Estabelecimento
              </h2>
              <p className={styles.cardSubtitle}>
                Defina como sua empresa será exibida para os clientes que acessam o link.
              </p>
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Endereço do link público</label>
              <div className={styles.inputSlugGroup}>
                <span className={styles.slugPrefix}>/agendar/</span>
                <input
                  className={styles.slugInput}
                  value={slug}
                  onChange={(e) => {
                    const val = e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, "-")
                      .replace(/[^a-z0-9-]/g, "");
                    setSlug(val);
                    setUrl(`${window.location.origin}/agendar/${val}`);
                  }}
                  required
                  minLength={3}
                  maxLength={60}
                  placeholder="seu-negocio"
                />
              </div>
              <span className={styles.helperText}>Letras minúsculas, números e hífens.</span>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Nome público</label>
              <input
                className={styles.input}
                name="name"
                defaultValue={c.name}
                required
                minLength={2}
                placeholder="Ex: Studio Prime"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Profissão ou Categoria</label>
              <input
                className={styles.input}
                name="category"
                defaultValue={c.businessType ?? ""}
                placeholder="Ex: Barbearia, Estética, Salão"
              />
            </div>

            <div className={styles.field}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                <label className={styles.fieldLabel} style={{ margin: 0 }}>Logo ou Foto de Perfil</label>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setUploadingLogo(true);
                        const dataUrl = await prepareImageUpload(file, { maxDimension: 512, square: true });
                        setLogoUrl(dataUrl);
                        notify("Logo carregada do dispositivo!");
                      } catch (err) {
                        notify((err as Error).message || "Erro ao carregar imagem", "error");
                      } finally {
                        setUploadingLogo(false);
                        e.target.value = "";
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--surface-secondary)",
                      color: "var(--text-primary)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: uploadingLogo ? "not-allowed" : "pointer",
                      opacity: uploadingLogo ? 0.7 : 1,
                    }}
                  >
                    <Upload size={13} />
                    <span>{uploadingLogo ? "Carregando..." : "Subir foto (celular / PC)"}</span>
                  </button>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl("")}
                      style={{
                        padding: "5px 8px",
                        borderRadius: 6,
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        background: "rgba(239, 68, 68, 0.1)",
                        color: "#ef4444",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                      title="Remover logo"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {logoUrl ? (
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: "1px solid var(--border)",
                      flexShrink: 0,
                      background: "#111",
                    }}
                  >
                    <img
                      src={logoUrl}
                      alt="Logo preview"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                ) : null}
                <input
                  className={styles.input}
                  name="logoUrl"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://... ou suba do dispositivo acima"
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Apresentação / Bio</label>
            <textarea
              className={styles.textarea}
              name="description"
              defaultValue={c.publicDescription ?? ""}
              maxLength={2000}
              placeholder="Conte um pouco sobre sua experiência, diferenciais e espaço..."
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Endereço completo da unidade</label>
            <input
              className={styles.input}
              name="address"
              defaultValue={c.address ?? ""}
              placeholder="Rua, número, bairro, cidade - UF"
            />
          </div>
        </section>

        {/* Card: Contato e Redes */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>
                <Phone size={18} style={{ color: "var(--primary)" }} />
                Contato e Redes Sociais
              </h2>
              <p className={styles.cardSubtitle}>
                Canais de comunicação exibidos na página pública para tirar dúvidas.
              </p>
            </div>
          </div>

          <div className={styles.grid3}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Telefone comercial</label>
              <input
                className={styles.input}
                name="phone"
                defaultValue={c.phone ?? ""}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>WhatsApp</label>
              <input
                className={styles.input}
                name="whatsapp"
                defaultValue={c.whatsapp ?? ""}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Instagram</label>
              <input
                className={styles.input}
                name="instagram"
                defaultValue={c.instagram ?? ""}
                placeholder="@seunegocio"
              />
            </div>
          </div>

          <div className={styles.grid2}>
            <div
              className={styles.checkRow}
              onClick={() => setShowPhone(!showPhone)}
            >
              <div className={styles.checkInfo}>
                <span className={styles.checkTitle}>Mostrar Telefone e WhatsApp</span>
                <span className={styles.checkDesc}>Permite que clientes entrem em contato diretamente.</span>
              </div>
              <div className={`${styles.switch} ${showPhone ? styles.switchActive : ""}`}>
                <div className={`${styles.switchKnob} ${showPhone ? styles.switchKnobActive : ""}`} />
              </div>
            </div>

            <div
              className={styles.checkRow}
              onClick={() => setShowInstagram(!showInstagram)}
            >
              <div className={styles.checkInfo}>
                <span className={styles.checkTitle}>Mostrar Instagram</span>
                <span className={styles.checkDesc}>Exibe link direto para o perfil do Instagram.</span>
              </div>
              <div className={`${styles.switch} ${showInstagram ? styles.switchActive : ""}`}>
                <div className={`${styles.switchKnob} ${showInstagram ? styles.switchKnobActive : ""}`} />
              </div>
            </div>
          </div>
        </section>

        {/* Card: Personalização Visual & Regras */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>
                <Palette size={18} style={{ color: "var(--primary)" }} />
                Identidade Visual e Políticas
              </h2>
              <p className={styles.cardSubtitle}>
                Cores do agendamento, fotos e políticas de cancelamento.
              </p>
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Cor de destaque da página</label>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{
                    width: 44,
                    height: 40,
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "transparent",
                    cursor: "pointer",
                  }}
                />
                <input
                  className={styles.input}
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{ fontFamily: "monospace", textTransform: "uppercase" }}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Prévia do botão do cliente</label>
              <div
                style={{
                  background: color,
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 13,
                  padding: "11px 18px",
                  borderRadius: 8,
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Sparkles size={14} />
                Confirmar agendamento
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Prazo para cancelamento / remarcação</label>
              <select
                className={styles.select}
                value={cancellation}
                onChange={(e) => setCancellation(Number(e.target.value))}
              >
                {[-1, 0, 2, 6, 12, 24, 48, 72].map((h) => (
                  <option value={h} key={h}>
                    {h < 0
                      ? "Somente pelo estabelecimento"
                      : h === 0
                        ? "Até o início do atendimento"
                        : `Até ${h} horas antes do horário`}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Fuso horário oficial</label>
              <input
                className={styles.input}
                name="timezone"
                defaultValue={c.timezone}
                required
                placeholder="America/Sao_Paulo"
              />
            </div>
          </div>

          <div className={styles.field}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
              <label className={styles.fieldLabel} style={{ margin: 0 }}>
                Fotos da galeria do espaço (uma URL por linha ou do aparelho)
              </label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  ref={photosInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;
                    try {
                      setUploadingPhotos(true);
                      const uploadedUrls: string[] = [];
                      for (let i = 0; i < files.length; i++) {
                        const dataUrl = await prepareImageUpload(files[i], { maxDimension: 1200, square: false });
                        uploadedUrls.push(dataUrl);
                      }
                      setPhotosText((prev) => {
                        const trimmed = prev.trim();
                        return trimmed ? `${trimmed}\n${uploadedUrls.join("\n")}` : uploadedUrls.join("\n");
                      });
                      notify(`${files.length} foto(s) carregada(s) do dispositivo!`);
                    } catch (err) {
                      notify((err as Error).message || "Erro ao carregar fotos", "error");
                    } finally {
                      setUploadingPhotos(false);
                      e.target.value = "";
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => photosInputRef.current?.click()}
                  disabled={uploadingPhotos}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--surface-secondary)",
                    color: "var(--text-primary)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: uploadingPhotos ? "not-allowed" : "pointer",
                    opacity: uploadingPhotos ? 0.7 : 1,
                  }}
                >
                  <Upload size={13} />
                  <span>{uploadingPhotos ? "Carregando..." : "Subir fotos (celular / PC)"}</span>
                </button>
              </div>
            </div>

            <textarea
              className={styles.textarea}
              name="photos"
              value={photosText}
              onChange={(e) => setPhotosText(e.target.value)}
              placeholder="https://exemplo.com/foto1.jpg&#10;https://exemplo.com/foto2.jpg ou suba do dispositivo"
              rows={3}
            />

            {photosText.trim() && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {photosText
                  .split("\n")
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .map((photo, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: "relative",
                        width: 60,
                        height: 60,
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid var(--border)",
                        background: "#111",
                      }}
                    >
                      <img
                        src={photo}
                        alt={`Foto ${idx + 1}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const list = photosText.split("\n").map((s) => s.trim()).filter(Boolean);
                          list.splice(idx, 1);
                          setPhotosText(list.join("\n"));
                        }}
                        style={{
                          position: "absolute",
                          top: 2,
                          right: 2,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: "rgba(0,0,0,0.7)",
                          color: "#ef4444",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          padding: 0,
                        }}
                        title="Remover foto"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className={styles.grid2}>
            <div
              className={styles.checkRow}
              onClick={() => setPublicEnabled(!publicEnabled)}
            >
              <div className={styles.checkInfo}>
                <span className={styles.checkTitle}>Ativar agendamentos pelo link público</span>
                <span className={styles.checkDesc}>Quando desativado, o link exibirá aviso de manutenção.</span>
              </div>
              <div className={`${styles.switch} ${publicEnabled ? styles.switchActive : ""}`}>
                <div className={`${styles.switchKnob} ${publicEnabled ? styles.switchKnobActive : ""}`} />
              </div>
            </div>

            <div
              className={styles.checkRow}
              onClick={() => setAllowProducts(!allowProducts)}
            >
              <div className={styles.checkInfo}>
                <span className={styles.checkTitle}>Produtos complementares</span>
                <span className={styles.checkDesc}>Permite oferecer itens adicionais durante o agendamento.</span>
              </div>
              <div className={`${styles.switch} ${allowProducts ? styles.switchActive : ""}`}>
                <div className={`${styles.switchKnob} ${allowProducts ? styles.switchKnobActive : ""}`} />
              </div>
            </div>
          </div>
        </section>

          {/* Save Bar */}
          <div className={styles.saveBar}>
            <span className={styles.saveBarText}>
              Revise as informações antes de salvar sua página pública.
            </span>
            <button type="submit" className={styles.btnPrimary} disabled={busy}>
              {busy ? "Salvando..." : "Salvar página e gerar link"}
            </button>
          </div>
        </form>
        </>
      )}

      {/* Tab: Horários da Equipe */}
      {activeTab === "schedules" && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>
                <Clock size={18} style={{ color: "var(--primary)" }} />
                Jornada e Horários da Equipe
              </h2>
              <p className={styles.cardSubtitle}>
                Configure os períodos de atendimento de cada profissional para o motor de disponibilidade.
              </p>
            </div>
          </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Selecione o profissional</label>
          <select
            className={styles.select}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">Selecione um profissional da equipe</option>
            {employees
              .filter((e) => e.active)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
        </div>

        {employeeId && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className={styles.quickPresetsContainer}>
              <span className={styles.quickPresetsHeader}>
                <Sparkles size={13} style={{ color: "var(--primary)" }} />
                Modelos rápidos:
              </span>
              <div className={styles.quickPresetsGrid}>
                <button
                  type="button"
                  className={styles.quickPresetBtn}
                  onClick={() => {
                    const days = [1, 2, 3, 4, 5].map((d) => ({
                      employeeId,
                      dayOfWeek: d,
                      startTime: "08:00",
                      endTime: "18:00",
                      breakStart: "12:00",
                      breakEnd: "13:00",
                      active: true,
                    }));
                    setSchedule(days);
                  }}
                >
                  Seg a Sex (08:00 às 18:00)
                </button>
                <button
                  type="button"
                  className={styles.quickPresetBtn}
                  onClick={() => {
                    const days = [1, 2, 3, 4, 5, 6].map((d) => ({
                      employeeId,
                      dayOfWeek: d,
                      startTime: "08:00",
                      endTime: d === 6 ? "14:00" : "18:00",
                      breakStart: d <= 5 ? "12:00" : null,
                      breakEnd: d <= 5 ? "13:00" : null,
                      active: true,
                    }));
                    setSchedule(days);
                  }}
                >
                  Seg a Sáb (08:00 às 18:00)
                </button>
                <button
                  type="button"
                  className={`${styles.quickPresetBtn} ${styles.quickPresetBtnHighlight}`}
                  onClick={() => {
                    const existing = schedule.find((s) => s.dayOfWeek === 4);
                    if (existing) {
                      setSchedule(schedule.map((s) => s.dayOfWeek === 4 ? { ...s, active: true, startTime: "08:00", endTime: "12:00", breakStart: null, breakEnd: null } : s));
                    } else {
                      setSchedule([...schedule, { employeeId, dayOfWeek: 4, startTime: "08:00", endTime: "12:00", breakStart: null, breakEnd: null, active: true }]);
                    }
                  }}
                  title="Define Quinta-feira com saída às 12:00"
                >
                  <Zap size={13} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4 }} />
                  Quinta só até 12:00
                </button>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className={styles.scheduleDesktopWrap}>
              <div className={styles.tableResponsiveWrap}>
                <table className={styles.scheduleTable}>
                  <thead>
                    <tr>
                      <th style={{ width: 50, minWidth: 50, textAlign: "center" }}>Ativo</th>
                      <th style={{ width: 170, minWidth: 170 }}>Dia da Semana</th>
                      <th style={{ width: 130, minWidth: 130 }}>Horário Entrada</th>
                      <th style={{ width: 130, minWidth: 130 }}>Horário Saída</th>
                      <th style={{ minWidth: 230 }}>Almoço / Intervalo</th>
                      <th style={{ width: 44, minWidth: 44 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((s, i) => (
                      <tr key={i}>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={s.active}
                            onChange={(e) =>
                              setSchedule(
                                schedule.map((r, n) =>
                                  n === i ? { ...r, active: e.target.checked } : r,
                                ),
                              )
                            }
                            style={{ width: 18, height: 18, accentColor: "var(--primary)", cursor: "pointer" }}
                          />
                        </td>
                        <td>
                          <select
                            className={styles.select}
                            value={s.dayOfWeek}
                            style={{ padding: "6px 28px 6px 10px", fontSize: "13px", width: "100%", minWidth: 140, height: 38 }}
                            onChange={(e) =>
                              setSchedule(
                                schedule.map((r, n) =>
                                  n === i
                                    ? { ...r, dayOfWeek: Number(e.target.value) }
                                    : r,
                                ),
                              )
                            }
                          >
                            {WEEKDAYS.map((d, n) => (
                              <option key={d} value={n}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="time"
                            className={styles.input}
                            value={s.startTime}
                            style={{ padding: "6px 10px", width: 110, height: 38, fontSize: "13px" }}
                            onChange={(e) =>
                              setSchedule(
                                schedule.map((r, n) =>
                                  n === i ? { ...r, startTime: e.target.value } : r,
                                ),
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="time"
                            className={styles.input}
                            value={s.endTime}
                            style={{ padding: "6px 10px", width: 110, height: 38, fontSize: "13px" }}
                            onChange={(e) =>
                              setSchedule(
                                schedule.map((r, n) =>
                                  n === i ? { ...r, endTime: e.target.value } : r,
                                ),
                              )
                            }
                          />
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <input
                              type="time"
                              className={styles.input}
                              placeholder="Início"
                              value={s.breakStart ?? ""}
                              style={{ padding: "6px 10px", width: 100, height: 38, fontSize: "13px" }}
                              onChange={(e) =>
                                setSchedule(
                                  schedule.map((r, n) =>
                                    n === i
                                      ? { ...r, breakStart: e.target.value || null }
                                      : r,
                                  ),
                                )
                              }
                            />
                            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>até</span>
                            <input
                              type="time"
                              className={styles.input}
                              placeholder="Fim"
                              value={s.breakEnd ?? ""}
                              style={{ padding: "6px 10px", width: 100, height: 38, fontSize: "13px" }}
                              onChange={(e) =>
                                setSchedule(
                                  schedule.map((r, n) =>
                                    n === i
                                      ? { ...r, breakEnd: e.target.value || null }
                                      : r,
                                  ),
                                )
                              }
                            />
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.btnIcon}
                            onClick={() =>
                              setSchedule(schedule.filter((_, n) => n !== i))
                            }
                            title="Remover período"
                          >
                            <Trash2 size={15} style={{ color: "#f87171" }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards View */}
            <div className={styles.scheduleMobileWrap}>
              {schedule.map((s, i) => (
                <div
                  key={i}
                  className={`${styles.mobileScheduleCard} ${s.active ? styles.mobileScheduleCardActive : ""}`}
                >
                  <div className={styles.mobileCardHeader}>
                    <label className={styles.mobileActiveToggle}>
                      <input
                        type="checkbox"
                        checked={s.active}
                        onChange={(e) =>
                          setSchedule(
                            schedule.map((r, n) =>
                              n === i ? { ...r, active: e.target.checked } : r,
                            ),
                          )
                        }
                      />
                      <span className={styles.mobileActiveLabel}>
                        {s.active ? "Atendimento ativo" : "Dia inativo / Folga"}
                      </span>
                    </label>

                    <button
                      type="button"
                      className={styles.btnIcon}
                      onClick={() =>
                        setSchedule(schedule.filter((_, n) => n !== i))
                      }
                      title="Remover período"
                    >
                      <Trash2 size={16} style={{ color: "#f87171" }} />
                    </button>
                  </div>

                  <div className={styles.mobileFieldGroup}>
                    <label className={styles.mobileFieldLabel}>Dia da semana</label>
                    <select
                      className={styles.select}
                      value={s.dayOfWeek}
                      style={{ height: 42, fontSize: "14px", width: "100%" }}
                      onChange={(e) =>
                        setSchedule(
                          schedule.map((r, n) =>
                            n === i
                              ? { ...r, dayOfWeek: Number(e.target.value) }
                              : r,
                          ),
                        )
                      }
                    >
                      {WEEKDAYS.map((d, n) => (
                        <option key={d} value={n}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.mobileTimeGrid}>
                    <div className={styles.mobileFieldGroup}>
                      <label className={styles.mobileFieldLabel}>Entrada</label>
                      <input
                        type="time"
                        className={styles.input}
                        value={s.startTime}
                        style={{ height: 42, fontSize: "14px", width: "100%" }}
                        onChange={(e) =>
                          setSchedule(
                            schedule.map((r, n) =>
                              n === i ? { ...r, startTime: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className={styles.mobileFieldGroup}>
                      <label className={styles.mobileFieldLabel}>Saída</label>
                      <input
                        type="time"
                        className={styles.input}
                        value={s.endTime}
                        style={{ height: 42, fontSize: "14px", width: "100%" }}
                        onChange={(e) =>
                          setSchedule(
                            schedule.map((r, n) =>
                              n === i ? { ...r, endTime: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className={styles.mobileTimeGrid}>
                    <div className={styles.mobileFieldGroup}>
                      <label className={styles.mobileFieldLabel}>Almoço início</label>
                      <input
                        type="time"
                        className={styles.input}
                        placeholder="Início"
                        value={s.breakStart ?? ""}
                        style={{ height: 42, fontSize: "14px", width: "100%" }}
                        onChange={(e) =>
                          setSchedule(
                            schedule.map((r, n) =>
                              n === i
                                ? { ...r, breakStart: e.target.value || null }
                                : r,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className={styles.mobileFieldGroup}>
                      <label className={styles.mobileFieldLabel}>Almoço fim</label>
                      <input
                        type="time"
                        className={styles.input}
                        placeholder="Fim"
                        value={s.breakEnd ?? ""}
                        style={{ height: 42, fontSize: "14px", width: "100%" }}
                        onChange={(e) =>
                          setSchedule(
                            schedule.map((r, n) =>
                              n === i
                                ? { ...r, breakEnd: e.target.value || null }
                                : r,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.scheduleActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() =>
                  setSchedule([
                    ...schedule,
                    {
                      employeeId,
                      dayOfWeek: 1,
                      startTime: "09:00",
                      endTime: "18:00",
                      breakStart: null,
                      breakEnd: null,
                      active: true,
                    },
                  ])
                }
              >
                <Plus size={16} />
                <span>Adicionar período</span>
              </button>

              <button
                type="button"
                className={styles.btnPrimary}
                disabled={busy}
                onClick={saveSchedule}
              >
                <Check size={16} />
                <span>Salvar disponibilidade do profissional</span>
              </button>
            </div>
          </div>
        )}
      </section>
      )}

      {/* Tab: Produtos & Cupons */}
      {activeTab === "extras" && (
        <>
          {/* Card: Produtos Complementares */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>
                  <ShoppingBag size={18} style={{ color: "var(--primary)" }} />
                  Produtos Complementares
                </h2>
                <p className={styles.cardSubtitle}>
                  Itens que o cliente pode adicionar ao carrinho durante o agendamento (pomadas, cremes, etc.).
                </p>
              </div>
            </div>

        {data.products.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {data.products.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "var(--surface-secondary)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <div>
                  <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{p.name}</strong>
                  <span style={{ marginLeft: 12, color: "var(--primary)", fontWeight: 600 }}>{money(p.price)}</span>
                </div>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await api("/api/booking-settings", {
                        method: "POST",
                        body: JSON.stringify({
                          kind: "product",
                          ...p,
                          price: Number(p.price),
                          active: !p.active,
                        }),
                      });
                      await load();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  {p.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={(e) => createExtra(e, "product")} className={styles.grid3} style={{ alignItems: "flex-end" }}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Nome do produto</label>
            <input className={styles.input} name="name" required minLength={2} placeholder="Ex: Pomada Modeladora" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Preço (R$)</label>
            <input className={styles.input} name="price" type="number" required min={0} step="0.01" placeholder="45.00" />
          </div>
          <button type="submit" className={styles.btnSecondary} disabled={busy} style={{ height: 42 }}>
            <Plus size={15} />
            Adicionar produto
          </button>
        </form>
      </section>

      {/* Card: Cupons Promocionais */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>
              <Tag size={18} style={{ color: "var(--primary)" }} />
              Cupons de Desconto
            </h2>
            <p className={styles.cardSubtitle}>
              Crie códigos de desconto promocionais para atrair clientes.
            </p>
          </div>
        </div>

        {data.coupons.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {data.coupons.map((coupon) => (
              <div
                key={coupon.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "var(--surface-secondary)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <div>
                  <code style={{ fontSize: 13, background: "var(--primary-soft)", color: "var(--primary)", padding: "3px 8px", borderRadius: 4 }}>
                    {coupon.code}
                  </code>
                  <span style={{ marginLeft: 12, color: "var(--text-secondary)", fontSize: 13 }}>
                    Desconto: <b>{coupon.type === "percentage" ? `${coupon.value}%` : money(coupon.value)}</b>
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await api("/api/booking-settings", {
                        method: "POST",
                        body: JSON.stringify({
                          kind: "coupon",
                          ...coupon,
                          value: Number(coupon.value),
                          active: !coupon.active,
                        }),
                      });
                      await load();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  {coupon.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={(e) => createExtra(e, "coupon")} className={styles.grid3} style={{ alignItems: "flex-end" }}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Código do cupom</label>
            <input className={styles.input} name="code" required minLength={2} placeholder="Ex: PRIMEIRA10" style={{ textTransform: "uppercase" }} />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Desconto</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select name="type" className={styles.select} style={{ width: 90 }}>
                <option value="percentage">%</option>
                <option value="fixed">R$</option>
              </select>
              <input className={styles.input} name="value" type="number" required min={1} placeholder="10" />
            </div>
          </div>
          <button type="submit" className={styles.btnSecondary} disabled={busy} style={{ height: 42 }}>
            <Plus size={15} />
            Criar cupom
          </button>
        </form>
      </section>
      </>
      )}
    </div>
  );
}
