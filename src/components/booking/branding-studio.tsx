/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect -- Loads the saved branding into the editor on mount. */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Palette,
  Upload,
  Trash2,
  Sparkles,
  Check,
  RotateCcw,
  Sun,
  Moon,
  ShieldCheck,
  AlertTriangle,
  Image as ImageIcon,
  CheckCircle2,
  Type,
  AlignLeft,
  ListOrdered,
  ArrowUp,
  ArrowDown,
  Search,
  ArrowRight,
  ArrowLeft,
  Clock3,
  MapPin,
  Calendar,
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
import {
  COPY_OVERRIDE_DEFAULTS,
  COPY_OVERRIDE_KEYS,
  COPY_OVERRIDE_LABELS,
  DEFAULT_SECTIONS_CONFIG,
  isSectionVisible,
  resolveCopy,
  SECTION_LABELS,
  type CopyOverrides,
  type SectionConfig,
} from "@/lib/booking/customization";
import {
  DEFAULT_FONT_PACK,
  FONT_PACKS,
  FONT_PACK_IDS,
  isFontPackId,
  type FontPackId,
} from "./font-packs";
import { prepareImageUpload } from "@/lib/image-upload-client";
import { b, Price, PublicFrame } from "./primitives";
import { PreviewToolbar } from "./preview-toolbar";
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
  bookingFontFamily: string;
  bookingCopyOverrides: CopyOverrides;
  bookingSectionsConfig: SectionConfig[];
  businessType?: string | null;
  publicDescription?: string | null;
  address?: string | null;
};

export function BrandingStudio({ onSaved }: { onSaved?: () => void } = {}) {
  const { notify, services: storeServices } = useStore();
  const [initialData, setInitialData] = useState<BrandingData | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverPosition, setCoverPosition] = useState<string>("center");
  const [primaryColor, setPrimaryColor] = useState<string>(DEFAULT_BRAND_COLOR);
  const [bookingThemeMode, setBookingThemeMode] = useState<BookingThemeMode>("auto");
  const [fontFamily, setFontFamily] = useState<FontPackId>(DEFAULT_FONT_PACK);
  const [copyOverrides, setCopyOverrides] = useState<CopyOverrides>({});
  const [sectionsConfig, setSectionsConfig] = useState<SectionConfig[]>(DEFAULT_SECTIONS_CONFIG);

  // Studio Preview States
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewTheme, setPreviewTheme] = useState<"dark" | "light">("dark");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [previewStep, setPreviewStep] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

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
      setFontFamily(isFontPackId(res.bookingFontFamily) ? res.bookingFontFamily : DEFAULT_FONT_PACK);
      setCopyOverrides(res.bookingCopyOverrides || {});
      setSectionsConfig(res.bookingSectionsConfig?.length ? res.bookingSectionsConfig : DEFAULT_SECTIONS_CONFIG);

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
      bookingThemeMode !== initialData.bookingThemeMode ||
      fontFamily !== initialData.bookingFontFamily ||
      JSON.stringify(copyOverrides) !== JSON.stringify(initialData.bookingCopyOverrides) ||
      JSON.stringify(sectionsConfig) !== JSON.stringify(initialData.bookingSectionsConfig));

  // Derived Palette
  const palette = createBrandPalette(primaryColor, previewTheme);

  // Derived Preview Services (use business's actual services if available, else clean category-aware defaults)
  const previewServices = useMemo(() => {
    const activeFromStore = (storeServices || []).filter((s) => s.active !== false);
    if (activeFromStore.length > 0) {
      return activeFromStore.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.categoryName || "Serviços",
        description: s.description || "",
        price: Number(s.price || 0),
        durationMinutes: Number(s.durationMinutes || 30),
        imageUrl: s.imageUrl || null,
      }));
    }

    const isBeautyOrAesthetics =
      (initialData?.businessType || "").toLowerCase().includes("estétic") ||
      (initialData?.businessType || "").toLowerCase().includes("beleza") ||
      (name || "").toLowerCase().includes("designer");

    if (isBeautyOrAesthetics) {
      return [
        {
          id: "preview-1",
          name: "Limpeza de Pele Profunda",
          category: "Facial",
          description: "Higienização completa, extração e hidratação com ativos premium.",
          price: 120,
          durationMinutes: 60,
          imageUrl: null,
        },
        {
          id: "preview-2",
          name: "Design de Sobrancelhas",
          category: "Design",
          description: "Mapeamento facial e alinhamento personalizado com visagismo.",
          price: 55,
          durationMinutes: 30,
          imageUrl: null,
        },
        {
          id: "preview-3",
          name: "Revitalização & Glow Facial",
          category: "Facial",
          description: "Protocolo de nutrição e luminosidade imediata para a pele.",
          price: 90,
          durationMinutes: 45,
          imageUrl: null,
        },
      ];
    }

    return [
      {
        id: "preview-1",
        name: "Atendimento Personalizado",
        category: "Serviços",
        description: "Consulta e atendimento completo com foco nas suas necessidades.",
        price: 80,
        durationMinutes: 45,
        imageUrl: null,
      },
      {
        id: "preview-2",
        name: "Sessão Rápida / Retoque",
        category: "Serviços",
        description: "Procedimento ágil e pontual com máxima precisão.",
        price: 45,
        durationMinutes: 25,
        imageUrl: null,
      },
    ];
  }, [storeServices, initialData?.businessType, name]);

  // Pre-select first service if none selected
  useEffect(() => {
    if (previewServices.length > 0 && selectedServiceIds.length === 0) {
      setSelectedServiceIds([previewServices[0].id]);
    }
  }, [previewServices, selectedServiceIds.length]);

  const allCategories = useMemo(() => {
    const distinct = Array.from(
      new Set(previewServices.map((s) => s.category).filter(Boolean)),
    );
    return distinct.length > 1 ? ["Todos", ...distinct] : [];
  }, [previewServices]);

  const filteredServices = useMemo(() => {
    return previewServices.filter((s) => {
      const matchesSearch =
        !searchQuery.trim() ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "Todos" || s.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [previewServices, searchQuery, selectedCategory]);

  const selectedServices = useMemo(() => {
    return previewServices.filter((s) => selectedServiceIds.includes(s.id));
  }, [previewServices, selectedServiceIds]);

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalMinutes = selectedServices.reduce(
    (sum, s) => sum + s.durationMinutes,
    0,
  );

  const activeCategoriesForRender = useMemo(() => {
    if (selectedCategory !== "Todos") return [selectedCategory];
    const set = new Set(filteredServices.map((s) => s.category || "Serviços"));
    return Array.from(set);
  }, [filteredServices, selectedCategory]);

  // Handle client-side image compression
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "logo" | "cover" | "avatar",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await prepareImageUpload(file, {
        maxDimension: target === "cover" ? 1400 : 800,
        square: target === "avatar",
        allowSvg: target === "logo",
      });
      if (target === "logo") setLogoUrl(dataUrl);
      if (target === "cover") setCoverUrl(dataUrl);
      if (target === "avatar") setAvatarUrl(dataUrl);
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      e.target.value = "";
    }
  };

  // Save Branding to Server
  const handleSave = async () => {
    if (!isValidHexColor(primaryColor)) {
      notify("Por favor, insira uma cor hexadecimal válida (ex: #3B82F6).", "error");
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
        bookingFontFamily: string;
        bookingCopyOverrides: CopyOverrides;
        bookingSectionsConfig: SectionConfig[];
      }>("/api/business/branding", {
        method: "PUT",
        body: JSON.stringify({
          logoUrl,
          avatarUrl,
          coverUrl,
          coverPosition,
          primaryColor,
          bookingThemeMode,
          bookingFontFamily: fontFamily,
          bookingCopyOverrides: copyOverrides,
          bookingSectionsConfig: sectionsConfig,
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
        bookingFontFamily: res?.bookingFontFamily || fontFamily,
        bookingCopyOverrides: res?.bookingCopyOverrides || copyOverrides,
        bookingSectionsConfig: res?.bookingSectionsConfig || sectionsConfig,
      };

      setInitialData(updated);
      if (res?.logoUrl) setLogoUrl(res.logoUrl);
      if (res?.avatarUrl) setAvatarUrl(res.avatarUrl);
      if (res?.coverUrl) setCoverUrl(res.coverUrl);
      if (res?.bookingCopyOverrides) setCopyOverrides(res.bookingCopyOverrides);
      if (res?.bookingSectionsConfig?.length) setSectionsConfig(res.bookingSectionsConfig);

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
    if (confirm("Deseja restaurar as cores e identidade visual padrão do Reservei?")) {
      setPrimaryColor(DEFAULT_BRAND_COLOR);
      setBookingThemeMode("auto");
      setCoverUrl(null);
      setCoverPosition("center");
      setPreviewTheme("dark");
      setFontFamily(DEFAULT_FONT_PACK);
      setCopyOverrides({});
      setSectionsConfig(DEFAULT_SECTIONS_CONFIG);
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
              {coverUrl && (
                <div className={styles.coverPositionField}>
                  <span className={styles.fieldLabel}>Enquadramento da capa</span>
                  <div className={styles.coverPositionGrid}>
                    {([
                      ["top", "Topo"],
                      ["center", "Centro"],
                      ["bottom", "Base"],
                    ] as const).map(([position, label]) => (
                      <button
                        key={position}
                        type="button"
                        className={`${styles.coverPositionBtn} ${coverPosition === position ? styles.coverPositionBtnActive : ""}`}
                        aria-pressed={coverPosition === position}
                        onClick={() => setCoverPosition(position)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                  placeholder="#3B82F6"
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

          {/* Card: Tipografia */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                <Type size={16} /> Tipografia
              </h3>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Combinação de fontes</label>
              <div className={styles.fontPackGrid}>
                {FONT_PACK_IDS.map((id) => {
                  const pack = FONT_PACKS[id];
                  const active = fontFamily === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`${styles.fontPackBtn} ${active ? styles.fontPackBtnActive : ""}`}
                      aria-pressed={active}
                      onClick={() => setFontFamily(id)}
                    >
                      <span className={styles.fontPackPreview} style={{ fontFamily: pack.heading }}>
                        Aa
                      </span>
                      <span className={styles.fontPackLabel}>{pack.label}</span>
                    </button>
                  );
                })}
              </div>
              <span className={styles.fieldHint} style={{ marginTop: 4 }}>
                {FONT_PACKS[fontFamily].description}
              </span>
            </div>
          </section>

          {/* Card: Textos da Página */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                <AlignLeft size={16} /> Textos da página
              </h3>
            </div>
            {COPY_OVERRIDE_KEYS.map((key) => (
              <div className={styles.field} key={key}>
                <label className={styles.fieldLabel}>{COPY_OVERRIDE_LABELS[key]}</label>
                <div className={styles.copyFieldRow}>
                  <input
                    type="text"
                    className={styles.textInput}
                    value={copyOverrides[key] ?? ""}
                    placeholder={COPY_OVERRIDE_DEFAULTS[key] || "Texto gerado automaticamente"}
                    maxLength={200}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCopyOverrides((prev) => {
                        const next = { ...prev };
                        if (value) next[key] = value;
                        else delete next[key];
                        return next;
                      });
                    }}
                  />
                  {copyOverrides[key] && (
                    <button
                      type="button"
                      className={styles.btnLinkSmall}
                      onClick={() =>
                        setCopyOverrides((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        })
                      }
                    >
                      Restaurar padrão
                    </button>
                  )}
                </div>
              </div>
            ))}
          </section>

          {/* Card: Seções da Página */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                <ListOrdered size={16} /> Seções da página
              </h3>
            </div>
            <span className={styles.fieldHint}>
              Escolha quais blocos aparecem e em que ordem. O perfil do estabelecimento e a lista de serviços são sempre exibidos.
            </span>
            {sectionsConfig.map((section, index) => (
              <div className={styles.sectionRow} key={section.id}>
                <div
                  className={styles.checkRow}
                  role="switch"
                  aria-checked={section.visible}
                  tabIndex={0}
                  onClick={() =>
                    setSectionsConfig((prev) =>
                      prev.map((s) =>
                        s.id === section.id ? { ...s, visible: !s.visible } : s,
                      ),
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSectionsConfig((prev) =>
                        prev.map((s) =>
                          s.id === section.id ? { ...s, visible: !s.visible } : s,
                        ),
                      );
                    }
                  }}
                >
                  <div className={styles.checkInfo}>
                    <span className={styles.checkTitle}>{SECTION_LABELS[section.id]}</span>
                  </div>
                  <div className={`${styles.switch} ${section.visible ? styles.switchActive : ""}`}>
                    <div
                      className={`${styles.switchKnob} ${section.visible ? styles.switchKnobActive : ""}`}
                    />
                  </div>
                </div>
                <div className={styles.sectionOrderBtns}>
                  <button
                    type="button"
                    className={styles.sectionOrderBtn}
                    disabled={index === 0}
                    aria-label={`Mover ${SECTION_LABELS[section.id]} para cima`}
                    onClick={() =>
                      setSectionsConfig((prev) => {
                        if (index === 0) return prev;
                        const next = [...prev];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        return next;
                      })
                    }
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    className={styles.sectionOrderBtn}
                    disabled={index === sectionsConfig.length - 1}
                    aria-label={`Mover ${SECTION_LABELS[section.id]} para baixo`}
                    onClick={() =>
                      setSectionsConfig((prev) => {
                        if (index === prev.length - 1) return prev;
                        const next = [...prev];
                        [next[index], next[index + 1]] = [next[index + 1], next[index]];
                        return next;
                      })
                    }
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>
            ))}
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

            <PreviewToolbar
              theme={previewTheme}
              viewport={viewport}
              slug={slug}
              onTheme={setPreviewTheme}
              onViewport={setViewport}
            />
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
                reservei.com.br/agendar/{slug || "studio-prime"}
              </span>
              <span style={{ fontSize: 10, color: "#8eb3a2", fontWeight: 700 }}>
                {previewTheme.toUpperCase()}
              </span>
            </div>

            <PublicFrame
              preview={viewport}
              color={primaryColor}
              coverUrl={coverUrl}
              coverPosition={coverPosition}
              themeMode={previewTheme}
              fontFamily={fontFamily}
              copyOverrides={copyOverrides}
              company={{
                name: name || "Studio Prime",
                category: initialData?.businessType || "Serviços",
                logoUrl,
                avatarUrl,
                slug,
                address: initialData?.address || undefined,
              }}
            >
              <main className={b.main}>
                {/* Clickable Step Progress Navigation */}
                <ol className={b.progress} aria-label="Prévia do progresso">
                  {[
                    { label: "Serviços", step: 0 },
                    { label: "Data e horário", step: 1 },
                    { label: "Confirmação", step: 2 },
                  ].map(({ label, step }) => (
                    <li
                      key={label}
                      className={previewStep === step ? b.current : ""}
                      style={{ cursor: "pointer" }}
                      onClick={() => setPreviewStep(step)}
                      title={`Ver passo: ${label}`}
                    >
                      <b>{previewStep > step ? <Check size={11} /> : step + 1}</b>
                      {label}
                    </li>
                  ))}
                </ol>

                <div className={b.layout}>
                  {/* Left Column: Flow Content */}
                  <div className={b.content}>
                    {previewStep > 0 && (
                      <button
                        type="button"
                        className={`${b.textButton} ${b.back}`}
                        onClick={() => setPreviewStep((s) => s - 1)}
                        style={{ marginBottom: 10, display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        <ArrowLeft size={14} /> Voltar
                      </button>
                    )}

                    {/* STEP 0: SERVIÇOS */}
                    {previewStep === 0 && (
                      <>
                        <p className={b.eyebrow}>ESCOLHA SEU SERVIÇO</p>
                        <h1 className={b.title}>Escolha seu serviço</h1>
                        <p className={b.subtitle}>
                          {resolveCopy(copyOverrides, "heroSubtitle")}
                        </p>

                        {/* Establishment Profile Card */}
                        <div className={b.profile}>
                          {avatarUrl || logoUrl ? (
                            <img
                              className={b.avatar}
                              src={avatarUrl || logoUrl || ""}
                              alt=""
                            />
                          ) : (
                            <span className={b.avatar}>
                              {(name || "S").slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div>
                            <h2>{name || "Studio Prime"}</h2>
                            <div className={b.muted}>
                              {initialData?.businessType || "Serviços"}
                            </div>
                            {initialData?.address && (
                              <div
                                className={`${b.muted} ${b.inline}`}
                                style={{ marginTop: 2, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                              >
                                <MapPin size={11} />
                                <span>{initialData.address}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Search Bar */}
                        {isSectionVisible(sectionsConfig, "search") && (
                          <div className={b.search}>
                            <Search size={16} />
                            <input
                              aria-label="Buscar serviço"
                              placeholder={resolveCopy(copyOverrides, "searchPlaceholder")}
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                            />
                          </div>
                        )}

                        {/* Category Filter Pills */}
                        {allCategories.length > 2 && (
                          <div className={b.categoryFilter} role="tablist" aria-label="Categorias">
                            {allCategories.map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                className={`${b.categoryPill} ${
                                  selectedCategory === cat ? b.categoryPillActive : ""
                                }`}
                                onClick={() => setSelectedCategory(cat)}
                              >
                                <span>{cat}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Service Groups */}
                        {activeCategoriesForRender.map((category) => {
                          const groupServices = filteredServices.filter(
                            (s) => (s.category || "Serviços") === category,
                          );
                          if (groupServices.length === 0) return null;

                          return (
                            <section className={b.serviceGroup} key={category}>
                              <h2 className={b.groupTitle}>
                                {category} <span>{groupServices.length}</span>
                              </h2>

                              {groupServices.map((service) => {
                                const selected = selectedServiceIds.includes(service.id);

                                return (
                                  <article className={b.service} key={service.id}>
                                    <div className={b.serviceMain}>
                                      <div className={b.serviceBody}>
                                        {service.imageUrl ? (
                                          <img
                                            className={b.serviceImage}
                                            src={service.imageUrl}
                                            alt={service.name}
                                          />
                                        ) : (
                                          <span className={b.serviceImagePlaceholder}>
                                            {service.name.slice(0, 1).toUpperCase()}
                                          </span>
                                        )}
                                        <div className={b.serviceDetails}>
                                          <h3>{service.name}</h3>
                                          {service.description && (
                                            <p className={b.serviceDescription}>
                                              {service.description}
                                            </p>
                                          )}
                                          <div className={b.serviceMeta}>
                                            <Clock3 size={12} />
                                            <span>{service.durationMinutes} min</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className={b.serviceActions}>
                                      <div className={b.servicePrice}>
                                        <Price amount={service.price} />
                                      </div>
                                      <div className={b.serviceButtons}>
                                        <button
                                          type="button"
                                          className={`${b.button} ${b.small} ${
                                            selected ? "" : b.outline
                                          }`}
                                          aria-pressed={selected}
                                          onClick={() => {
                                            setSelectedServiceIds((prev) =>
                                              prev.includes(service.id)
                                                ? prev.filter((id) => id !== service.id)
                                                : [...prev, service.id],
                                            );
                                          }}
                                        >
                                          {selected ? (
                                            <>
                                              <Check size={12} /> Selecionado
                                            </>
                                          ) : (
                                            "Selecionar"
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </article>
                                );
                              })}
                            </section>
                          );
                        })}

                        {/* Optional Photos section */}
                        {sectionsConfig
                          .filter((s) => s.id === "photos" && s.visible)
                          .map(() => (
                            <div className={b.photos} key="photos-preview">
                              <span className={b.serviceImagePlaceholder}>1</span>
                              <span className={b.serviceImagePlaceholder}>2</span>
                              <span className={b.serviceImagePlaceholder}>3</span>
                            </div>
                          ))}

                        {/* Optional Hours section */}
                        {sectionsConfig
                          .filter((s) => s.id === "hours" && s.visible)
                          .map(() => (
                            <div
                              className={b.muted}
                              style={{ marginTop: 14, fontSize: 11.5 }}
                              key="hours-preview"
                            >
                              Funcionamento: Seg a Sáb · 09:00–19:00
                            </div>
                          ))}
                      </>
                    )}

                    {/* STEP 1: DATA E HORÁRIO */}
                    {previewStep === 1 && (
                      <div>
                        <p className={b.eyebrow}>ESCOLHA QUANDO VOCÊ QUER IR</p>
                        <h1 className={b.title}>Escolha a data e o horário</h1>
                        <p className={b.subtitle}>
                          Selecione o melhor dia e horário para seu atendimento.
                        </p>

                        <div className={b.calendar} style={{ padding: 14, borderRadius: 12, marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>Próximos dias disponíveis</span>
                            <span style={{ fontSize: 11, color: "var(--accent)" }}>Mês atual</span>
                          </div>
                          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                            {["Hoje", "Amanhã", "Quarta", "Quinta", "Sexta"].map((d, i) => (
                              <button
                                key={d}
                                type="button"
                                className={`${b.day} ${i === 0 ? b.daySelected : ""}`}
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: 8,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  background: i === 0 ? "var(--accent)" : undefined,
                                  color: i === 0 ? "var(--accent-contrast)" : undefined,
                                }}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{ marginBottom: 14 }}>
                          <span style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                            Horários disponíveis
                          </span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {["09:00", "10:30", "14:00", "15:30", "17:00"].map((slot, i) => (
                              <button
                                key={slot}
                                type="button"
                                className={b.slotChip}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 8,
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  background: i === 1 ? "var(--accent)" : undefined,
                                  color: i === 1 ? "var(--accent-contrast)" : undefined,
                                }}
                                onClick={() => setPreviewStep(2)}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 2: CONFIRMAÇÃO */}
                    {previewStep === 2 && (
                      <div>
                        <p className={b.eyebrow}>Finalize seu agendamento</p>
                        <h1 className={b.title}>Revise seu agendamento</h1>
                        <p className={b.subtitle}>
                          Confira os detalhes para garantir a reserva.
                        </p>

                        <div className={b.card} style={{ padding: 14, borderRadius: 12, marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <span className={b.muted}>Data e horário</span>
                            <strong style={{ color: "var(--accent)" }}>Amanhã às 10:30</strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <span className={b.muted}>Estabelecimento</span>
                            <strong>{name || "Studio Prime"}</strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span className={b.muted}>Serviços</span>
                            <span>{selectedServices.map((s) => s.name).join(", ") || "1 serviço"}</span>
                          </div>
                        </div>

                        <div style={{ marginBottom: 14 }}>
                          <span style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                            Forma de pagamento no local
                          </span>
                          <div style={{ display: "flex", gap: 6 }}>
                            {["PIX", "Cartão", "Dinheiro"].map((method, idx) => (
                              <div
                                key={method}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 8,
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  border: idx === 0 ? "1px solid var(--accent)" : "1px solid var(--line)",
                                  background: idx === 0 ? "var(--accent)" : "var(--paper)",
                                  color: idx === 0 ? "var(--accent-contrast)" : "var(--booking-text)",
                                }}
                              >
                                {method}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Desktop Sticky Summary Card */}
                  <aside className={b.summary} aria-label="Resumo do agendamento">
                    <h2>Seu agendamento</h2>

                    {selectedServices.length === 0 ? (
                      <div className={b.summaryEmpty}>
                        <Sparkles size={18} style={{ color: "var(--accent)" }} />
                        <span>Nenhum serviço selecionado</span>
                        <small style={{ color: "var(--booking-text-muted)" }}>
                          Escolha um serviço ao lado para continuar.
                        </small>
                      </div>
                    ) : (
                      <>
                        {selectedServices.map((service) => (
                          <div className={b.summaryItem} key={service.id}>
                            <div className={b.summaryItemRow}>
                              <div className={b.summaryItemLeft}>
                                <div className={b.summaryItemInfo}>
                                  <h3>{service.name}</h3>
                                  <div className={b.summaryItemMeta}>
                                    <span>{service.durationMinutes} min</span>
                                    <Price amount={service.price} className={b.summaryItemPrice} />
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                className={b.remove}
                                aria-label={`Remover ${service.name}`}
                                onClick={() =>
                                  setSelectedServiceIds((prev) =>
                                    prev.filter((id) => id !== service.id),
                                  )
                                }
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}

                        <div className={b.total}>
                          <div>
                            Total
                            <span
                              className={b.muted}
                              style={{ display: "block", fontWeight: 400, fontSize: 11 }}
                            >
                              {totalMinutes} min ({selectedServices.length}{" "}
                              {selectedServices.length === 1 ? "serviço" : "serviços"})
                            </span>
                          </div>
                          <strong>
                            <Price amount={totalPrice} />
                          </strong>
                        </div>

                        <div className={b.summaryFooter}>
                          <button
                            type="button"
                            className={`${b.button} ${b.wide}`}
                            onClick={() =>
                              setPreviewStep((prev) => (prev < 2 ? prev + 1 : 0))
                            }
                          >
                            <span>
                              {previewStep === 0
                                ? resolveCopy(copyOverrides, "ctaContinue")
                                : previewStep === 1
                                  ? "Revisar agendamento"
                                  : resolveCopy(copyOverrides, "ctaConfirm")}
                            </span>
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </aside>
                </div>

                {/* Mobile Sticky Bottom Bar */}
                {selectedServices.length > 0 && (
                  <div className={b.mobileBottomBar}>
                    <div className={b.mobileBottomBarInner}>
                      <div className={b.mobileSummaryInfo}>
                        <div className={b.mobileSummaryTitle}>
                          <span>
                            {selectedServices[0].name}
                            {selectedServices.length > 1
                              ? ` +${selectedServices.length - 1}`
                              : ` • ${totalMinutes} min`}
                          </span>
                        </div>
                        <div className={b.mobileSummaryPrice}>
                          <Price amount={totalPrice} />
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`${b.button} ${b.mobileCtaBtn}`}
                        onClick={() =>
                          setPreviewStep((prev) => (prev < 2 ? prev + 1 : 0))
                        }
                      >
                        <span>
                          {previewStep === 2
                            ? resolveCopy(copyOverrides, "ctaConfirm")
                            : resolveCopy(copyOverrides, "ctaContinue")}
                        </span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </main>

              <footer className={b.footer}>
                <div className={b.footerInner}>
                  <span>{resolveCopy(copyOverrides, "footerLine1")}</span>
                  <span className={b.footerDot}>·</span>
                  <span>{resolveCopy(copyOverrides, "footerLine2")}</span>
                </div>
              </footer>
            </PublicFrame>
          </div>
        </div>
      </div>
    </div>
  );
}
