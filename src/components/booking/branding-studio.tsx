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
  Loader2,
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
  Crop,
  Film,
  Video,
  Plus,
  ExternalLink,
  Layers,
} from "lucide-react";
import { ImageCropperModal } from "@/components/ui/image-cropper-modal";
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
  DEFAULT_PROMO_BANNERS,
  isSectionVisible,
  resolveCopy,
  SECTION_LABELS,
  parsePromoBanners,
  type CopyOverrides,
  type SectionConfig,
  type PromoBannersConfig,
  type PromoBannerItem,
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
import { PageBuilderEditor } from "./page-builder/page-builder-editor";
import { BookingPromoCarousel } from "./booking-promo-carousel";
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
  bookingPromoBanners?: PromoBannersConfig;
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
  const [promoBanners, setPromoBanners] = useState<PromoBannersConfig>(DEFAULT_PROMO_BANNERS);

  // Studio Preview States
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewTheme, setPreviewTheme] = useState<"dark" | "light">("dark");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [previewStep, setPreviewStep] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showVisualBuilder, setShowVisualBuilder] = useState(false);

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
      setPromoBanners(parsePromoBanners(res.bookingPromoBanners));

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
      JSON.stringify(sectionsConfig) !== JSON.stringify(initialData.bookingSectionsConfig) ||
      JSON.stringify(promoBanners) !== JSON.stringify(initialData.bookingPromoBanners || DEFAULT_PROMO_BANNERS));

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

  // Image Cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState("");
  const [cropperTarget, setCropperTarget] = useState<"logo" | "cover">("logo");

  // Handle client-side image upload & open interactive cropper
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "logo" | "cover" | "avatar",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropperImageSrc(String(reader.result));
      setCropperTarget(target === "cover" ? "cover" : "logo");
      setCropperOpen(true);
    };
    reader.onerror = () => {
      notify("Não foi possível ler o arquivo selecionado.", "error");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleOpenCropperForExisting = (target: "logo" | "cover") => {
    const src = target === "logo" ? logoUrl : coverUrl;
    if (!src) return;
    setCropperImageSrc(src);
    setCropperTarget(target);
    setCropperOpen(true);
  };

  const handleCropComplete = (croppedDataUrl: string) => {
    if (cropperTarget === "logo") {
      setLogoUrl(croppedDataUrl);
      notify("Logo recortada e ajustada com sucesso!");
    } else {
      setCoverUrl(croppedDataUrl);
      notify("Imagem de capa recortada e ajustada!");
    }
  };

  // Promo Banner Handlers
  const handleAddPromoItem = () => {
    if (promoBanners.items.length >= 3) {
      notify("Você pode adicionar no máximo 3 artes.", "error");
      return;
    }
    const newItem: PromoBannerItem = {
      id: `banner-${Date.now()}`,
      type: "image",
      url: "",
      title: "",
      subtitle: "",
      badge: "",
      linkUrl: "",
      buttonText: "Saiba mais",
    };
    setPromoBanners((prev) => ({
      ...prev,
      enabled: true,
      items: [...prev.items, newItem],
    }));
  };

  const handleRemovePromoItem = (index: number) => {
    setPromoBanners((prev) => {
      const items = prev.items.filter((_, i) => i !== index);
      return {
        ...prev,
        items,
      };
    });
  };

  const handleMovePromoItem = (index: number, direction: -1 | 1) => {
    setPromoBanners((prev) => {
      const targetIdx = index + direction;
      if (targetIdx < 0 || targetIdx >= prev.items.length) return prev;
      const items = [...prev.items];
      const temp = items[index];
      items[index] = items[targetIdx];
      items[targetIdx] = temp;
      return { ...prev, items };
    });
  };

  const handleUpdatePromoItem = (index: number, updates: Partial<PromoBannerItem>) => {
    setPromoBanners((prev) => {
      const items = [...prev.items];
      if (items[index]) {
        items[index] = { ...items[index], ...updates };
      }
      return { ...prev, items };
    });
  };

  const handlePromoImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await prepareImageUpload(file, {
        maxDimension: 1200,
        quality: 0.88,
        maxBytes: 5 * 1024 * 1024,
      });
      handleUpdatePromoItem(index, { type: "image", url: dataUrl });
      notify("Imagem da arte carregada com sucesso!");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erro ao processar imagem.", "error");
    }
    e.target.value = "";
  };

  const handlePromoVideoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      notify("O vídeo deve ter no máximo 20MB.", "error");
      return;
    }

    if (!file.type.startsWith("video/")) {
      notify("Por favor, selecione um arquivo de vídeo válido (MP4, WebM, MOV).", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const videoDataUrl = String(reader.result);
      handleUpdatePromoItem(index, { type: "video", url: videoDataUrl });
      notify("Vídeo da arte carregado com sucesso!");
    };
    reader.onerror = () => {
      notify("Não foi possível carregar este vídeo.", "error");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
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
        bookingPromoBanners: PromoBannersConfig;
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
          bookingPromoBanners: promoBanners,
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
        bookingPromoBanners: res?.bookingPromoBanners || promoBanners,
      };

      setInitialData(updated);
      if (res?.logoUrl) setLogoUrl(res.logoUrl);
      if (res?.avatarUrl) setAvatarUrl(res.avatarUrl);
      if (res?.coverUrl) setCoverUrl(res.coverUrl);
      if (res?.bookingCopyOverrides) setCopyOverrides(res.bookingCopyOverrides);
      if (res?.bookingSectionsConfig?.length) setSectionsConfig(res.bookingSectionsConfig);
      if (res?.bookingPromoBanners) setPromoBanners(res.bookingPromoBanners);

      setSaveSuccess(true);
      notify("Identidade visual e banners atualizados com sucesso!");
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
      setPromoBanners(DEFAULT_PROMO_BANNERS);
      notify("Identidade padrão restaurada. Clique em 'Salvar alterações' para confirmar.");
    }
  };

  if (showVisualBuilder) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          width: "100vw",
          height: "100vh",
          backgroundColor: "#09090b",
        }}
      >
        <PageBuilderEditor
          onExit={() => {
            setShowVisualBuilder(false);
            void loadBranding();
          }}
          onSaved={() => {
            void loadBranding();
            onSaved?.();
          }}
        />
      </div>
    );
  }

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
          <button
            type="button"
            className={styles.btnPageBuilderTop}
            onClick={() => setShowVisualBuilder(true)}
          >
            <Sparkles size={16} />
            <span>Abrir Page Builder 2.0 (Visual)</span>
          </button>

          {hasChanges && (
            <span className={styles.unsavedBadge}>
              <AlertTriangle size={13} /> Alterações não salvas
            </span>
          )}
          <button
            type="button"
            className={`${styles.btnSaveTop} ${
              saveSuccess
                ? styles.btnSaveSuccess
                : hasChanges
                  ? styles.btnSaveHasChanges
                  : styles.btnSaveIdle
            }`}
            disabled={saving}
            onClick={handleSave}
            title={hasChanges ? "Salvar alterações pendentes" : "Salvar configurações atuais"}
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 size={16} /> Salvo!
              </>
            ) : saving ? (
              <>
                <Loader2 size={16} className={styles.spin} /> Salvando...
              </>
            ) : (
              <>
                <Check size={16} /> Salvar alterações
              </>
            )}
          </button>
        </div>
      </div>

      {/* Page Builder 2.0 Banner (Desktop Only) */}
      <div className={styles.pageBuilderBanner}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#dcff4c",
              color: "#09090b",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Sparkles size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#f4f4f5" }}>
              Reservei Visual Page Builder 2.0
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#a1a1aa" }}>
              Experiência completa inspirada no Elementor: arraste blocos, altere grades de colunas, tipografia e personalize a versão do celular em tempo real.
            </p>
          </div>
        </div>
        <button
          type="button"
          style={{
            padding: "9px 18px",
            borderRadius: "8px",
            backgroundColor: "#dcff4c",
            color: "#09090b",
            fontWeight: 700,
            fontSize: "13px",
            border: "none",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
          onClick={() => setShowVisualBuilder(true)}
        >
          <span>Entrar no Construtor Visual</span>
        </button>
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
                  <>
                    <button
                      type="button"
                      className={styles.btnUpload}
                      style={{ background: "rgba(220, 255, 76, 0.12)", color: "#dcff4c", borderColor: "rgba(220, 255, 76, 0.3)" }}
                      onClick={() => handleOpenCropperForExisting("logo")}
                    >
                      <Crop size={14} /> Ajustar / Cortar
                    </button>
                    <button
                      type="button"
                      className={styles.btnRemove}
                      onClick={() => setLogoUrl(null)}
                    >
                      <Trash2 size={13} /> Remover
                    </button>
                  </>
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
                  <>
                    <button
                      type="button"
                      className={styles.btnUpload}
                      style={{ background: "rgba(220, 255, 76, 0.12)", color: "#dcff4c", borderColor: "rgba(220, 255, 76, 0.3)" }}
                      onClick={() => handleOpenCropperForExisting("cover")}
                    >
                      <Crop size={14} /> Ajustar / Cortar
                    </button>
                    <button
                      type="button"
                      className={styles.btnRemove}
                      onClick={() => setCoverUrl(null)}
                    >
                      <Trash2 size={13} /> Remover
                    </button>
                  </>
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

          {/* Card: Carrossel Promocional (Abaixo de Seu Agendamento) */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                <Film size={16} /> Carrossel Promocional (Abaixo de Seu Agendamento)
              </h3>
            </div>
            <span className={styles.fieldHint}>
              Exiba de 1 até 3 artes promocionais (fotos ou vídeos) rotativas logo abaixo do resumo &quot;Seu agendamento&quot;. Se o recurso estiver desligado ou sem mídias, nada será exibido.
            </span>

            {/* Toggle Switch */}
            <div
              className={styles.checkRow}
              role="switch"
              aria-checked={promoBanners.enabled}
              tabIndex={0}
              onClick={() =>
                setPromoBanners((prev) => ({
                  ...prev,
                  enabled: !prev.enabled,
                }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPromoBanners((prev) => ({
                    ...prev,
                    enabled: !prev.enabled,
                  }));
                }
              }}
            >
              <div className={styles.checkInfo}>
                <span className={styles.checkTitle}>Ativar banner promocional na página</span>
                <span className={styles.checkSub}>
                  {promoBanners.enabled
                    ? `${promoBanners.items.length} ${promoBanners.items.length === 1 ? "arte configurada" : "artes configuradas"}`
                    : "Banner desativado"}
                </span>
              </div>
              <div className={`${styles.switch} ${promoBanners.enabled ? styles.switchActive : ""}`}>
                <div
                  className={`${styles.switchKnob} ${promoBanners.enabled ? styles.switchKnobActive : ""}`}
                />
              </div>
            </div>

            {promoBanners.enabled && (
              <>
                {promoBanners.items.length === 0 ? (
                  <div className={styles.bannerEmptyNotice}>
                    <Sparkles size={24} style={{ color: "var(--primary, #dcff4c)" }} />
                    <span className={styles.bannerEmptyNoticeTitle}>Nenhuma arte adicionada ainda</span>
                    <span className={styles.bannerEmptyNoticeSub}>
                      Adicione fotos ou vídeos com textos e links para destacar ofertas, combos ou novidades no seu link.
                    </span>
                    <button
                      type="button"
                      className={styles.btnAddBanner}
                      onClick={handleAddPromoItem}
                    >
                      <Plus size={15} /> Adicionar 1ª Arte (Foto ou Vídeo)
                    </button>
                  </div>
                ) : (
                  <div className={styles.bannerList}>
                    {promoBanners.items.map((item, index) => (
                      <div className={styles.bannerItemCard} key={item.id || index}>
                        {/* Header */}
                        <div className={styles.bannerItemHeader}>
                          <div className={styles.bannerItemIndex}>
                            <span className={styles.bannerItemIndexBadge}>Arte #{index + 1}</span>
                            <span>{item.type === "video" ? "Vídeo Promocional" : "Foto / Imagem"}</span>
                          </div>
                          <div className={styles.bannerItemControls}>
                            <button
                              type="button"
                              className={styles.btnControl}
                              disabled={index === 0}
                              onClick={() => handleMovePromoItem(index, -1)}
                              title="Mover para cima"
                              aria-label="Mover arte para cima"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              className={styles.btnControl}
                              disabled={index === promoBanners.items.length - 1}
                              onClick={() => handleMovePromoItem(index, 1)}
                              title="Mover para baixo"
                              aria-label="Mover arte para baixo"
                            >
                              <ArrowDown size={13} />
                            </button>
                            <button
                              type="button"
                              className={`${styles.btnControl} ${styles.btnControlDanger}`}
                              onClick={() => handleRemovePromoItem(index)}
                              title="Remover arte"
                              aria-label="Remover arte"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Media Row */}
                        <div className={styles.bannerMediaRow}>
                          {/* Thumbnail / Video Preview */}
                          <div className={styles.bannerMediaPreview}>
                            {item.url ? (
                              item.type === "video" ? (
                                <video
                                  src={item.url}
                                  autoPlay
                                  muted
                                  loop
                                  playsInline
                                />
                              ) : (
                                <img src={item.url} alt={item.title || `Arte #${index + 1}`} />
                              )
                            ) : (
                              <div className={styles.bannerMediaPlaceholder}>
                                {item.type === "video" ? <Video size={20} /> : <ImageIcon size={20} />}
                                <span>Sem mídia</span>
                              </div>
                            )}
                          </div>

                          {/* Upload / URL controls */}
                          <div className={styles.bannerMediaInputs}>
                            {/* Type Switcher */}
                            <div className={styles.bannerTypeSelector}>
                              <button
                                type="button"
                                className={`${styles.bannerTypeBtn} ${item.type === "image" ? styles.bannerTypeBtnActive : ""}`}
                                onClick={() => handleUpdatePromoItem(index, { type: "image" })}
                              >
                                <ImageIcon size={13} /> Imagem / Foto
                              </button>
                              <button
                                type="button"
                                className={`${styles.bannerTypeBtn} ${item.type === "video" ? styles.bannerTypeBtnActive : ""}`}
                                onClick={() => handleUpdatePromoItem(index, { type: "video" })}
                              >
                                <Video size={13} /> Vídeo
                              </button>
                            </div>

                            {/* File Upload Button + Hidden Input */}
                            <div className={styles.bannerUploadBtnGroup}>
                              <label className={styles.btnUploadMedia}>
                                <Upload size={13} />
                                {item.url ? "Substituir arquivo" : `Carregar ${item.type === "video" ? "vídeo (MP4/WebM)" : "foto (PNG/JPG)"}`}
                                <input
                                  type="file"
                                  accept={item.type === "video" ? "video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp"}
                                  style={{ display: "none" }}
                                  onChange={(e) =>
                                    item.type === "video"
                                      ? void handlePromoVideoUpload(e, index)
                                      : void handlePromoImageUpload(e, index)
                                  }
                                />
                              </label>

                              {item.url && (
                                <button
                                  type="button"
                                  className={styles.btnLinkSmall}
                                  onClick={() => handleUpdatePromoItem(index, { url: "" })}
                                >
                                  Limpar mídia
                                </button>
                              )}
                            </div>

                            {/* Direct URL input */}
                            <input
                              type="url"
                              className={styles.textInput}
                              placeholder={item.type === "video" ? "Ou insira a URL direta do vídeo (MP4/WebM)" : "Ou insira a URL direta da imagem (HTTPS)"}
                              value={item.url && !item.url.startsWith("data:") ? item.url : ""}
                              onChange={(e) => handleUpdatePromoItem(index, { url: e.target.value })}
                            />
                          </div>
                        </div>

                        {/* Text Fields */}
                        <div className={styles.bannerInputGrid}>
                          <div className={styles.field}>
                            <label className={styles.fieldLabel}>Título da arte (opcional)</label>
                            <input
                              type="text"
                              className={styles.textInput}
                              placeholder="Ex: Combo Especial de Verão"
                              maxLength={80}
                              value={item.title || ""}
                              onChange={(e) => handleUpdatePromoItem(index, { title: e.target.value })}
                            />
                          </div>

                          <div className={styles.field}>
                            <label className={styles.fieldLabel}>Tag de destaque (opcional)</label>
                            <input
                              type="text"
                              className={styles.textInput}
                              placeholder="Ex: 20% OFF, Novidade, Destaque"
                              maxLength={30}
                              value={item.badge || ""}
                              onChange={(e) => handleUpdatePromoItem(index, { badge: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className={styles.field}>
                          <label className={styles.fieldLabel}>Subtítulo / Descrição da chamada (opcional)</label>
                          <input
                            type="text"
                            className={styles.textInput}
                            placeholder="Ex: Válido até o fim do mês em todos os serviços selecionados."
                            maxLength={160}
                            value={item.subtitle || ""}
                            onChange={(e) => handleUpdatePromoItem(index, { subtitle: e.target.value })}
                          />
                        </div>

                        <div className={styles.bannerInputGrid}>
                          <div className={styles.field}>
                            <label className={styles.fieldLabel}>Link do botão (opcional)</label>
                            <input
                              type="url"
                              className={styles.textInput}
                              placeholder="Ex: https://wa.me/5511... ou página externa"
                              value={item.linkUrl || ""}
                              onChange={(e) => handleUpdatePromoItem(index, { linkUrl: e.target.value })}
                            />
                          </div>

                          <div className={styles.field}>
                            <label className={styles.fieldLabel}>Texto do botão</label>
                            <input
                              type="text"
                              className={styles.textInput}
                              placeholder="Ex: Saiba mais, Aproveitar"
                              maxLength={40}
                              value={item.buttonText || ""}
                              onChange={(e) => handleUpdatePromoItem(index, { buttonText: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {promoBanners.items.length < 3 && (
                      <button
                        type="button"
                        className={styles.btnAddBanner}
                        onClick={handleAddPromoItem}
                      >
                        <Plus size={15} /> Adicionar outra arte ({promoBanners.items.length}/3)
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
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
              className={`${styles.btnSave} ${
                saveSuccess
                  ? styles.btnSaveSuccess
                  : hasChanges
                    ? styles.btnSaveHasChanges
                    : styles.btnSaveIdle
              }`}
              disabled={saving}
              onClick={handleSave}
              title={hasChanges ? "Salvar alterações pendentes" : "Salvar configurações atuais"}
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 size={16} /> Salvo!
                </>
              ) : saving ? (
                <>
                  <Loader2 size={16} className={styles.spin} /> Salvando...
                </>
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

                        <div className={b.previewDatePanel}>
                          <div className={b.previewDateHeader}>
                            <strong>Próximos dias disponíveis</strong>
                            <span>Mês atual</span>
                          </div>
                          <div className={b.previewDateDays}>
                            {["Hoje", "Amanhã", "Quarta", "Quinta", "Sexta"].map((d, i) => (
                              <button
                                key={d}
                                type="button"
                                className={`${b.previewDateDay} ${i === 0 ? b.previewDateDayActive : ""}`}
                                aria-pressed={i === 0}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className={b.previewSlotsPanel}>
                          <span className={b.previewSlotsTitle}>
                            Horários disponíveis
                          </span>
                          <div className={b.previewSlotsGrid}>
                            {["09:00", "10:30", "14:00", "15:30", "17:00"].map((slot, i) => (
                              <button
                                key={slot}
                                type="button"
                                className={`${b.previewSlotButton} ${i === 1 ? b.previewSlotButtonActive : ""}`}
                                aria-pressed={i === 1}
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
                    {viewport === "mobile" && promoBanners.enabled && promoBanners.items.some((it) => Boolean(it.url)) && (
                      <div style={{ marginTop: 20 }}>
                        <BookingPromoCarousel promoBanners={promoBanners} />
                      </div>
                    )}
                  </div>

                  {/* Right Column: Desktop Sticky Summary Card & Promo Banner */}
                  <div className={b.summaryColumn}>
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

                    {promoBanners.enabled && promoBanners.items.some((it) => Boolean(it.url)) && (
                      <BookingPromoCarousel promoBanners={promoBanners} />
                    )}
                  </div>
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

      {/* Interactive Image Cropper & Drag Modal */}
      <ImageCropperModal
        isOpen={cropperOpen}
        onClose={() => setCropperOpen(false)}
        imageSrc={cropperImageSrc}
        aspectRatio={cropperTarget === "cover" ? "16:5" : "1:1"}
        shape={cropperTarget === "logo" ? "circle" : "rect"}
        title={cropperTarget === "cover" ? "Ajustar e Enquadrar Capa" : "Ajustar e Enquadrar Logo / Perfil"}
        subtitle="Arraste para reposicionar e ajuste o zoom para o enquadramento perfeito"
        outputMaxDimension={cropperTarget === "cover" ? 1400 : 600}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
