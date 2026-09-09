/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Palette,
  Upload,
  Trash2,
  Sparkles,
  Smartphone,
  Monitor,
  Check,
  RotateCcw,
  Sun,
  Moon,
  ShieldCheck,
  AlertTriangle,
  Clock3,
  MapPin,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useStore } from "@/store/store";
import {
  BRAND_PRESETS,
  DEFAULT_BRAND_COLOR,
  createBrandPalette,
  isValidHexColor,
  type BookingThemeMode,
} from "@/lib/branding";
import styles from "./branding-studio.module.css";

type BrandingData = {
  name: string;
  slug?: string;
  logoUrl: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  coverPosition: string;
  primaryColor: string;
  bookingThemeMode: BookingThemeMode;
  businessType?: string | null;
  publicDescription?: string | null;
};

export function BrandingStudio({ onSaved }: { onSaved?: () => void } = {}) {
  const { notify } = useStore();
  const [initialData, setInitialData] = useState<BrandingData | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverPosition, setCoverPosition] = useState<string>("center");
  const [primaryColor, setPrimaryColor] = useState<string>(DEFAULT_BRAND_COLOR);
  const [bookingThemeMode, setBookingThemeMode] = useState<BookingThemeMode>("auto");

  // Studio Preview States
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewTheme, setPreviewTheme] = useState<"dark" | "light">("dark");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("1");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Load initial branding from API
  async function loadBranding() {
    try {
      const res = await api<BrandingData>("/api/business/branding");
      setInitialData(res);
      setName(res.name);
      setSlug(res.slug || "");
      setLogoUrl(res.logoUrl || null);
      setAvatarUrl(res.avatarUrl || null);
      setCoverUrl(res.coverUrl || null);
      setCoverPosition(res.coverPosition || "center");
      setPrimaryColor(res.primaryColor || DEFAULT_BRAND_COLOR);
      setBookingThemeMode(res.bookingThemeMode || "auto");

      // Set initial preview theme
      if (res.bookingThemeMode === "light") {
        setPreviewTheme("light");
      } else {
        setPreviewTheme("dark");
      }
    } catch {
      // Fallback
    }
  }

  useEffect(() => {
    void loadBranding();
  }, []);

  // Check for unsaved changes
  const hasChanges =
    initialData !== null &&
    (logoUrl !== initialData.logoUrl ||
      avatarUrl !== initialData.avatarUrl ||
      coverUrl !== initialData.coverUrl ||
      coverPosition !== initialData.coverPosition ||
      primaryColor !== initialData.primaryColor ||
      bookingThemeMode !== initialData.bookingThemeMode);

  // Derived Palette
  const palette = createBrandPalette(primaryColor, previewTheme);

  // Handle client-side image compression
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "logo" | "cover" | "avatar",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      notify("A imagem deve ter no máximo 5MB.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDimension = target === "cover" ? 1400 : 800;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/webp", 0.88);
        if (target === "logo") setLogoUrl(dataUrl);
        if (target === "cover") setCoverUrl(dataUrl);
        if (target === "avatar") setAvatarUrl(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Save Branding to Server
  const handleSave = async () => {
    if (!isValidHexColor(primaryColor)) {
      notify("Por favor, insira uma cor hexadecimal válida (ex: #DCFF4C).", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await api<{
        ok: boolean;
        logoUrl: string | null;
        avatarUrl: string | null;
        coverUrl: string | null;
        primaryColor: string;
        bookingThemeMode: BookingThemeMode;
      }>("/api/business/branding", {
        method: "PUT",
        body: JSON.stringify({
          logoUrl,
          avatarUrl,
          coverUrl,
          coverPosition,
          primaryColor,
          bookingThemeMode,
        }),
      });

      const updated = {
        name,
        slug,
        logoUrl: res?.logoUrl !== undefined ? res.logoUrl : logoUrl,
        avatarUrl: res?.avatarUrl !== undefined ? res.avatarUrl : avatarUrl,
        coverUrl: res?.coverUrl !== undefined ? res.coverUrl : coverUrl,
        coverPosition,
        primaryColor,
        bookingThemeMode,
      };

      setInitialData(updated);
      if (res?.logoUrl) setLogoUrl(res.logoUrl);
      if (res?.avatarUrl) setAvatarUrl(res.avatarUrl);
      if (res?.coverUrl) setCoverUrl(res.coverUrl);

      setSaveSuccess(true);
      notify("Identidade visual atualizada com sucesso!");
      onSaved?.();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      notify((e as Error).message || "Erro ao salvar personalização.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Restore Defaults
  const handleRestoreDefaults = () => {
    if (confirm("Deseja restaurar as cores e identidade visual padrão do Nova(e)?")) {
      setPrimaryColor(DEFAULT_BRAND_COLOR);
      setBookingThemeMode("auto");
      setCoverUrl(null);
      setCoverPosition("center");
      setPreviewTheme("dark");
      notify("Identidade padrão restaurada. Clique em 'Salvar alterações' para confirmar.");
    }
  };

  return (
    <div className={styles.container}>
      {/* Header with quick save action */}
      <div className={styles.studioHeader}>
        <div className={styles.studioHeaderLeft}>
          <p className={styles.eyebrow}>Branding Studio</p>
          <h1 className={styles.title}>Identidade da sua página</h1>
          <p className={styles.subtitle}>
            Personalize como seus clientes veem seu espaço ao agendar pelo seu link público.
          </p>
        </div>
        <div className={styles.studioHeaderActions}>
          {hasChanges && (
            <span className={styles.unsavedBadge}>
              <AlertTriangle size={13} /> Alterações não salvas
            </span>
          )}
          <button
            type="button"
            className={styles.btnSaveTop}
            disabled={!hasChanges || saving}
            onClick={handleSave}
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 size={16} /> Salvo!
              </>
            ) : saving ? (
              "Salvando..."
            ) : (
              <>
                <Check size={16} /> Salvar alterações
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className={styles.studioLayout}>
        {/* Left Column: Customization Controls */}
        <div className={styles.controlsCol}>
          {/* Card: Logo da Empresa */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                <ImageIcon size={16} /> Logo da Empresa
              </h3>
            </div>

            <div className={styles.uploadRow}>
              <div className={styles.logoBox}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className={styles.logoImg} />
                ) : (
                  <span className={styles.logoFallback}>{name.slice(0, 1) || "N"}</span>
                )}
              </div>

              <div className={styles.uploadActions}>
                <input
                  type="file"
                  ref={logoInputRef}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className={styles.fileInput}
                  onChange={(e) => handleImageUpload(e, "logo")}
                />
                <button
                  type="button"
                  className={styles.btnUpload}
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload size={14} /> {logoUrl ? "Alterar logo" : "Enviar logo"}
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    className={styles.btnRemove}
                    onClick={() => setLogoUrl(null)}
                  >
                    <Trash2 size={13} /> Remover
                  </button>
                )}
              </div>
            </div>
            <span className={styles.fieldHint}>
              PNG, JPG, WEBP ou SVG (máx. 5MB). Aparece no cabeçalho da página de agendamento.
            </span>
          </section>

          {/* Card: Imagem de Capa (Cover) */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                <ImageIcon size={16} /> Imagem de Capa
              </h3>
            </div>

            <div className={styles.field}>
              {coverUrl ? (
                <div className={styles.coverBox}>
                  <img src={coverUrl} alt="Capa" className={styles.coverImg} />
                </div>
              ) : (
                <div className={styles.coverBox} style={{ color: "#8eb3a2", fontSize: 12 }}>
                  <span>Nenhuma imagem de capa selecionada</span>
                </div>
              )}

              <div className={styles.uploadActions} style={{ marginTop: 8 }}>
                <input
                  type="file"
                  ref={coverInputRef}
                  accept="image/png,image/jpeg,image/webp"
                  className={styles.fileInput}
                  onChange={(e) => handleImageUpload(e, "cover")}
                />
                <button
                  type="button"
                  className={styles.btnUpload}
                  onClick={() => coverInputRef.current?.click()}
                >
                  <Upload size={14} /> {coverUrl ? "Alterar capa" : "Enviar imagem de capa"}
                </button>
                {coverUrl && (
                  <button
                    type="button"
                    className={styles.btnRemove}
                    onClick={() => setCoverUrl(null)}
                  >
                    <Trash2 size={13} /> Remover
                  </button>
                )}
              </div>
              <span className={styles.fieldHint}>
                Aparece no topo do link de agendamento. Recomendado: proporção 16:5 ou 1200x380.
              </span>
            </div>
          </section>

          {/* Card: Cor da Marca */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                <Palette size={16} /> Cor da Marca
              </h3>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Cor de destaque</label>
              <div className={styles.colorPickerWrap}>
                <div
                  className={styles.colorInputWrap}
                  style={{ background: palette.brand }}
                >
                  <input
                    type="color"
                    value={palette.brand}
                    className={styles.nativeColorInput}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                  />
                </div>
                <input
                  type="text"
                  value={primaryColor}
                  className={styles.hexInput}
                  onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
                  maxLength={7}
                  placeholder="#DCFF4C"
                />
              </div>

              {/* Quick Preset Colors */}
              <div style={{ marginTop: 8 }}>
                <span className={styles.fieldHint} style={{ display: "block", marginBottom: 6 }}>
                  Cores sugeridas:
                </span>
                <div className={styles.colorPresets}>
                  {BRAND_PRESETS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      title={preset.name}
                      className={`${styles.presetDot} ${
                        primaryColor.toLowerCase() === preset.hex.toLowerCase()
                          ? styles.presetDotActive
                          : ""
                      }`}
                      style={{ background: preset.hex }}
                      onClick={() => setPrimaryColor(preset.hex)}
                    />
                  ))}
                </div>
              </div>

              {/* Live Accessibility Feedback */}
              <div className={styles.contrastFeedback} style={{ marginTop: 10 }}>
                {palette.isLight ? (
                  <>
                    <ShieldCheck size={14} style={{ color: "#34d399" }} />
                    <span>
                      Cor clara: o sistema usará <strong>texto escuro</strong> nos botões para garantir 100% de leitura.
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} style={{ color: "#34d399" }} />
                    <span>
                      Cor escura: o sistema usará <strong>texto branco</strong> nos botões com contraste ideal.
                    </span>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Card: Aparência da Página Pública */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                <Sun size={16} /> Aparência da Página Pública
              </h3>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Modo de visualização padrão</label>
              <div className={styles.themeSegmentGrid}>
                <button
                  type="button"
                  className={`${styles.themeSegmentBtn} ${
                    bookingThemeMode === "auto" ? styles.themeSegmentBtnActive : ""
                  }`}
                  onClick={() => {
                    setBookingThemeMode("auto");
                    setPreviewTheme("dark");
                  }}
                >
                  <Sparkles size={14} />
                  <span>Automático</span>
                </button>

                <button
                  type="button"
                  className={`${styles.themeSegmentBtn} ${
                    bookingThemeMode === "light" ? styles.themeSegmentBtnActive : ""
                  }`}
                  onClick={() => {
                    setBookingThemeMode("light");
                    setPreviewTheme("light");
                  }}
                >
                  <Sun size={14} />
                  <span>Claro</span>
                </button>

                <button
                  type="button"
                  className={`${styles.themeSegmentBtn} ${
                    bookingThemeMode === "dark" ? styles.themeSegmentBtnActive : ""
                  }`}
                  onClick={() => {
                    setBookingThemeMode("dark");
                    setPreviewTheme("dark");
                  }}
                >
                  <Moon size={14} />
                  <span>Escuro</span>
                </button>
              </div>
              <span className={styles.fieldHint} style={{ marginTop: 4 }}>
                &quot;Automático&quot; adapta-se às preferências de tema do celular/computador do visitante.
              </span>
            </div>
          </section>

          {/* Action Bar */}
          <div className={styles.actionBar}>
            <button
              type="button"
              className={styles.btnReset}
              onClick={handleRestoreDefaults}
            >
              <RotateCcw size={14} /> Restaurar padrão
            </button>

            <button
              type="button"
              className={styles.btnSave}
              disabled={!hasChanges || saving}
              onClick={handleSave}
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 size={16} /> Salvo!
                </>
              ) : saving ? (
                "Salvando..."
              ) : (
                <>
                  <Check size={16} /> Salvar alterações
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Live Real-Time Interactive Preview */}
        <div className={styles.previewCol}>
          <div className={styles.previewHeader}>
            <h3 className={styles.previewTitle}>
              <Sparkles size={16} style={{ color: palette.brand }} />
              Prévia em tempo real
            </h3>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Theme toggle for preview */}
              <button
                type="button"
                className={styles.btnUpload}
                style={{ minHeight: 30, padding: "4px 8px", fontSize: 11 }}
                onClick={() => setPreviewTheme(previewTheme === "dark" ? "light" : "dark")}
                title="Alternar tema da prévia"
              >
                {previewTheme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
                <span>{previewTheme === "dark" ? "Ver claro" : "Ver escuro"}</span>
              </button>

              {/* Viewport switcher */}
              <div className={styles.viewportToggle}>
                <button
                  type="button"
                  className={`${styles.viewportBtn} ${
                    viewport === "desktop" ? styles.viewportBtnActive : ""
                  }`}
                  onClick={() => setViewport("desktop")}
                >
                  <Monitor size={13} /> Desktop
                </button>
                <button
                  type="button"
                  className={`${styles.viewportBtn} ${
                    viewport === "mobile" ? styles.viewportBtnActive : ""
                  }`}
                  onClick={() => setViewport("mobile")}
                >
                  <Smartphone size={13} /> Mobile
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Mock Frame */}
          <div
            className={`${styles.previewFrameWrap} ${
              viewport === "mobile"
                ? styles.previewFrameMobile
                : styles.previewFrameDesktop
            }`}
          >
            {/* Window Topbar */}
            <div className={styles.previewWindowHead}>
              <div className={styles.windowDots}>
                <div className={styles.windowDot} />
                <div className={styles.windowDot} />
                <div className={styles.windowDot} />
              </div>
              <span className={styles.windowUrl}>
                novae.app/agendar/{slug || "studio-prime"}
              </span>
              <span style={{ fontSize: 10, color: "#8eb3a2" }}>
                {previewTheme.toUpperCase()}
              </span>
            </div>

            {/* Live Container Injected with Dynamic Palette */}
            <div
              className={`${styles.livePreviewContainer} ${
                previewTheme === "dark" ? styles.previewDark : styles.previewLight
              }`}
              style={palette.cssVariables as React.CSSProperties}
            >
              {/* Optional Cover Banner */}
              {coverUrl && (
                <img src={coverUrl} alt="Capa" className={styles.previewCover} />
              )}

              {/* Business Hero */}
              <div className={styles.previewHero}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className={styles.previewLogo} />
                ) : (
                  <div className={styles.previewLogoFallback}>
                    {name.slice(0, 1) || "S"}
                  </div>
                )}
                <div>
                  <h4>{name || "Studio Prime"}</h4>
                  <span>Barbearia & Estética · São Paulo, SP</span>
                </div>
              </div>

              {/* Step Title */}
              <div>
                <span
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    fontWeight: 700,
                    color: palette.brand,
                    display: "block",
                  }}
                >
                  Escolha seu serviço
                </span>
                <strong style={{ fontSize: 16 }}>O que vamos agendar hoje?</strong>
              </div>

              {/* Service Cards Mock */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  className={`${styles.previewService} ${
                    selectedServiceId === "1" ? styles.previewServiceSelected : ""
                  }`}
                  onClick={() => setSelectedServiceId("1")}
                >
                  <div className={styles.previewServiceInfo}>
                    <h5>Corte & Acabamento</h5>
                    <span>30 min · Corte tradicional com lavagem</span>
                  </div>
                  <div className={styles.previewServiceAction}>
                    <strong className={styles.previewPrice}>R$ 45,00</strong>
                    <button
                      type="button"
                      className={`${styles.previewBtn} ${
                        selectedServiceId === "1"
                          ? styles.previewBtnBrand
                          : styles.previewBtnOutline
                      }`}
                    >
                      {selectedServiceId === "1" ? (
                        <>
                          <Check size={12} /> Selecionado
                        </>
                      ) : (
                        "Selecionar"
                      )}
                    </button>
                  </div>
                </div>

                <div
                  className={`${styles.previewService} ${
                    selectedServiceId === "2" ? styles.previewServiceSelected : ""
                  }`}
                  onClick={() => setSelectedServiceId("2")}
                >
                  <div className={styles.previewServiceInfo}>
                    <h5>Barba & Toalha Quente</h5>
                    <span>30 min · Design e alinhamento</span>
                  </div>
                  <div className={styles.previewServiceAction}>
                    <strong className={styles.previewPrice}>R$ 35,00</strong>
                    <button
                      type="button"
                      className={`${styles.previewBtn} ${
                        selectedServiceId === "2"
                          ? styles.previewBtnBrand
                          : styles.previewBtnOutline
                      }`}
                    >
                      {selectedServiceId === "2" ? (
                        <>
                          <Check size={12} /> Selecionado
                        </>
                      ) : (
                        "Selecionar"
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom CTA Mock */}
              <button type="button" className={styles.previewCtaBtn}>
                Continuar para Data e Horário →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
