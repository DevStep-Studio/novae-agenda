"use client";

import React, { useRef } from "react";
import {
  Film,
  Image as ImageIcon,
  Video,
  Upload,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Link,
  Eye,
} from "lucide-react";
import type { PromoBannersConfig, PromoBannerItem } from "@/lib/booking/customization";
import { prepareImageUpload } from "@/lib/image-upload-client";
import { BookingPromoCarousel } from "./booking-promo-carousel";
import styles from "./promo-carousel-editor.module.css";

export interface PromoCarouselEditorProps {
  promoBanners: PromoBannersConfig;
  onChange: (next: PromoBannersConfig) => void;
  notify?: (msg: string, type?: "success" | "error") => void;
  showLivePreview?: boolean;
}

export function PromoCarouselEditor({
  promoBanners,
  onChange,
  notify = (msg) => alert(msg),
  showLivePreview = true,
}: PromoCarouselEditorProps) {
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const videoInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleToggle = () => {
    onChange({
      ...promoBanners,
      enabled: !promoBanners.enabled,
    });
  };

  const handleUpdateConfig = (updates: Partial<PromoBannersConfig>) => {
    onChange({
      ...promoBanners,
      ...updates,
    });
  };

  const currentAspect = promoBanners.aspectRatio || "portrait";
  const currentStyle = promoBanners.contentStyle || "overlay";
  const currentFit = promoBanners.fit || "cover";
  const currentSpeed = promoBanners.autoplaySpeed ?? 5000;

  const handleAddItem = () => {
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
    onChange({
      ...promoBanners,
      enabled: true,
      items: [...promoBanners.items, newItem],
    });
  };

  const handleRemoveItem = (index: number) => {
    const nextItems = promoBanners.items.filter((_, i) => i !== index);
    onChange({
      ...promoBanners,
      items: nextItems,
    });
  };

  const handleMoveItem = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= promoBanners.items.length) return;
    const items = [...promoBanners.items];
    const temp = items[index];
    items[index] = items[targetIdx];
    items[targetIdx] = temp;
    onChange({
      ...promoBanners,
      items,
    });
  };

  const handleUpdateItem = (index: number, updates: Partial<PromoBannerItem>) => {
    const items = [...promoBanners.items];
    if (items[index]) {
      items[index] = { ...items[index], ...updates };
    }
    onChange({
      ...promoBanners,
      items,
    });
  };

  const handleImageUpload = async (
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
      handleUpdateItem(index, { type: "image", url: dataUrl });
      notify("Imagem da arte carregada com sucesso!", "success");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erro ao processar imagem.", "error");
    }
    e.target.value = "";
  };

  const handleVideoUpload = async (
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
      handleUpdateItem(index, { type: "video", url: videoDataUrl });
      notify("Vídeo da arte carregado com sucesso!", "success");
    };
    reader.onerror = () => {
      notify("Não foi possível carregar este vídeo.", "error");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const hasValidMedia = promoBanners.items.some((it) => Boolean(it.url));

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <div className={styles.headerInfo}>
          <h3 className={styles.cardTitle}>
            <Film size={18} style={{ color: "var(--primary, #dcff4c)" }} />
            Carrossel Promocional (Abaixo de Seu Agendamento)
          </h3>
          <p className={styles.cardSubtitle}>
            Exiba de 1 até 3 artes promocionais rotativas (fotos ou vídeos) logo abaixo do card &quot;Seu agendamento&quot;.
            Se o recurso estiver desligado ou sem mídias, nada será exibido na página.
          </p>
        </div>
        <span className={styles.badgeCount}>
          <Sparkles size={13} />
          {promoBanners.enabled
            ? `${promoBanners.items.length}/3 artes ativas`
            : "Desativado"}
        </span>
      </div>

      {/* Main Switch */}
      <div
        className={styles.checkRow}
        role="switch"
        aria-checked={promoBanners.enabled}
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <div className={styles.checkInfo}>
          <span className={styles.checkTitle}>Ativar carrossel no link de agendamento</span>
          <span className={styles.checkDesc}>
            {promoBanners.enabled
              ? "O carrossel será exibido na página pública para os seus clientes."
              : "Desativado — o espaço abaixo do agendamento permanecerá limpo."}
          </span>
        </div>
        <div className={`${styles.switch} ${promoBanners.enabled ? styles.switchActive : ""}`}>
          <div className={`${styles.switchKnob} ${promoBanners.enabled ? styles.switchKnobActive : ""}`} />
        </div>
      </div>

      {/* Carousel Format & Display Options */}
      {promoBanners.enabled && (
        <div className={styles.configSection}>
          <div className={styles.configSectionHeader}>
            <span className={styles.configSectionTitle}>
              <Sparkles size={16} style={{ color: "var(--primary, #dcff4c)" }} />
              Formato & Estilo de Exibição do Carrossel
            </span>
            <p className={styles.configSectionSub}>
              Escolha as dimensões ideais para suas artes e como as informações serão apresentadas.
            </p>
          </div>

          {/* Formatos: Retrato, Stories, Quadrado, Banner */}
          <div className={styles.formatGrid}>
            <div
              className={`${styles.formatCard} ${currentAspect === "portrait" ? styles.formatCardActive : ""}`}
              onClick={() => handleUpdateConfig({ aspectRatio: "portrait" })}
              role="button"
              tabIndex={0}
              title="Proporção 4:5 - Ideal para fotos de cortes e tratamentos"
            >
              <div className={`${styles.formatVisual} ${styles.shapePortrait}`} />
              <div className={styles.formatInfo}>
                <span className={styles.formatTitle}>Retrato (4:5)</span>
                <span className={styles.formatSub}>Feed Instagram / Cortes</span>
              </div>
            </div>

            <div
              className={`${styles.formatCard} ${currentAspect === "story" ? styles.formatCardActive : ""}`}
              onClick={() => handleUpdateConfig({ aspectRatio: "story" })}
              role="button"
              tabIndex={0}
              title="Proporção 9:16 - Formato vertical de celular / Reels"
            >
              <div className={`${styles.formatVisual} ${styles.shapeStory}`} />
              <div className={styles.formatInfo}>
                <span className={styles.formatTitle}>Stories (9:16)</span>
                <span className={styles.formatSub}>Vertical / Reels</span>
              </div>
            </div>

            <div
              className={`${styles.formatCard} ${currentAspect === "square" ? styles.formatCardActive : ""}`}
              onClick={() => handleUpdateConfig({ aspectRatio: "square" })}
              role="button"
              tabIndex={0}
              title="Proporção 1:1 - Formato quadrado tradicional"
            >
              <div className={`${styles.formatVisual} ${styles.shapeSquare}`} />
              <div className={styles.formatInfo}>
                <span className={styles.formatTitle}>Quadrado (1:1)</span>
                <span className={styles.formatSub}>Feed Tradicional</span>
              </div>
            </div>

            <div
              className={`${styles.formatCard} ${currentAspect === "banner" ? styles.formatCardActive : ""}`}
              onClick={() => handleUpdateConfig({ aspectRatio: "banner" })}
              role="button"
              tabIndex={0}
              title="Proporção 16:9 - Formato horizontal panorâmico"
            >
              <div className={`${styles.formatVisual} ${styles.shapeBanner}`} />
              <div className={styles.formatInfo}>
                <span className={styles.formatTitle}>Banner (16:9)</span>
                <span className={styles.formatSub}>Paisagem / Horizontal</span>
              </div>
            </div>
          </div>

          {/* Local de Exibição */}
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingTitle}>Local de Exibição</span>
              <span className={styles.settingSub}>
                Posicionado fixo diretamente abaixo do card <strong>&quot;Seu agendamento&quot;</strong> (e no resumo mobile).
              </span>
            </div>
            <div className={styles.pillGroup}>
              <span className={`${styles.pillBtn} ${styles.pillBtnActive}`} style={{ cursor: "default" }}>
                Abaixo de &quot;Seu agendamento&quot;
              </span>
            </div>
          </div>

          {/* Estilo Visual das Informações */}
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingTitle}>Apresentação dos Textos</span>
              <span className={styles.settingSub}>Como títulos, selos e botões aparecem</span>
            </div>
            <div className={styles.pillGroup}>
              <button
                type="button"
                className={`${styles.pillBtn} ${currentStyle === "overlay" ? styles.pillBtnActive : ""}`}
                onClick={() => handleUpdateConfig({ contentStyle: "overlay" })}
              >
                Sobreposto (Gradiente Cinema)
              </button>
              <button
                type="button"
                className={`${styles.pillBtn} ${currentStyle === "card" ? styles.pillBtnActive : ""}`}
                onClick={() => handleUpdateConfig({ contentStyle: "card" })}
              >
                Card Abaixo da Arte
              </button>
              <button
                type="button"
                className={`${styles.pillBtn} ${currentStyle === "clean" ? styles.pillBtnActive : ""}`}
                onClick={() => handleUpdateConfig({ contentStyle: "clean" })}
              >
                Apenas Arte Limpa
              </button>
            </div>
          </div>

          {/* Enquadramento da Mídia */}
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingTitle}>Enquadramento da Imagem/Vídeo</span>
              <span className={styles.settingSub}>Como a imagem preenche a moldura</span>
            </div>
            <div className={styles.pillGroup}>
              <button
                type="button"
                className={`${styles.pillBtn} ${currentFit === "cover" ? styles.pillBtnActive : ""}`}
                onClick={() => handleUpdateConfig({ fit: "cover" })}
              >
                Preencher Todo o Espaço (Cover)
              </button>
              <button
                type="button"
                className={`${styles.pillBtn} ${currentFit === "contain" ? styles.pillBtnActive : ""}`}
                onClick={() => handleUpdateConfig({ fit: "contain" })}
              >
                Conter Sem Cortar (Contain)
              </button>
            </div>
          </div>

          {/* Velocidade de Transição */}
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingTitle}>Transição Automática (Autoplay)</span>
              <span className={styles.settingSub}>Tempo para avançar para a próxima arte</span>
            </div>
            <div className={styles.pillGroup}>
              <button
                type="button"
                className={`${styles.pillBtn} ${currentSpeed === 3000 ? styles.pillBtnActive : ""}`}
                onClick={() => handleUpdateConfig({ autoplaySpeed: 3000 })}
              >
                Rápido (3s)
              </button>
              <button
                type="button"
                className={`${styles.pillBtn} ${currentSpeed === 5000 ? styles.pillBtnActive : ""}`}
                onClick={() => handleUpdateConfig({ autoplaySpeed: 5000 })}
              >
                Normal (5s)
              </button>
              <button
                type="button"
                className={`${styles.pillBtn} ${currentSpeed === 7000 ? styles.pillBtnActive : ""}`}
                onClick={() => handleUpdateConfig({ autoplaySpeed: 7000 })}
              >
                Lento (7s)
              </button>
              <button
                type="button"
                className={`${styles.pillBtn} ${currentSpeed === 0 ? styles.pillBtnActive : ""}`}
                onClick={() => handleUpdateConfig({ autoplaySpeed: 0 })}
              >
                Manual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Carousel Items Editor */}
      {promoBanners.enabled && (
        <>
          {promoBanners.items.length === 0 ? (
            <div className={styles.emptyNotice}>
              <Sparkles size={28} style={{ color: "var(--primary, #dcff4c)" }} />
              <span className={styles.emptyTitle}>Nenhuma arte adicionada ainda</span>
              <p className={styles.emptySub}>
                Adicione fotos ou vídeos com títulos, descontos e links para divulgar combos, promoções do mês ou novidades.
              </p>
              <button
                type="button"
                className={styles.btnAddBanner}
                onClick={handleAddItem}
              >
                <Plus size={16} /> Adicionar 1ª Arte (Foto ou Vídeo)
              </button>
            </div>
          ) : (
            <div className={styles.bannerList}>
              {promoBanners.items.map((item, index) => (
                <div className={styles.bannerCard} key={item.id || index}>
                  {/* Item Header */}
                  <div className={styles.bannerCardHeader}>
                    <div className={styles.bannerNumberBadge}>
                      <span className={styles.indexPill}>Arte #{index + 1}</span>
                      <span>{item.type === "video" ? "Vídeo Promocional" : "Foto / Imagem"}</span>
                    </div>

                    <div className={styles.bannerActions}>
                      <button
                        type="button"
                        className={styles.btnControl}
                        disabled={index === 0}
                        onClick={() => handleMoveItem(index, -1)}
                        title="Mover para cima"
                        aria-label="Mover arte para cima"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.btnControl}
                        disabled={index === promoBanners.items.length - 1}
                        onClick={() => handleMoveItem(index, 1)}
                        title="Mover para baixo"
                        aria-label="Mover arte para baixo"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.btnControl} ${styles.btnControlDanger}`}
                        onClick={() => handleRemoveItem(index)}
                        title="Remover arte"
                        aria-label="Remover arte"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Media Type Switcher */}
                  <div className={styles.typeTabs}>
                    <button
                      type="button"
                      className={`${styles.typeBtn} ${item.type === "image" ? styles.typeBtnActive : ""}`}
                      onClick={() => handleUpdateItem(index, { type: "image" })}
                    >
                      <ImageIcon size={14} /> Foto / Imagem
                    </button>
                    <button
                      type="button"
                      className={`${styles.typeBtn} ${item.type === "video" ? styles.typeBtnActive : ""}`}
                      onClick={() => handleUpdateItem(index, { type: "video" })}
                    >
                      <Video size={14} /> Vídeo Promocional
                    </button>
                  </div>

                  {/* Media Upload & Preview Row */}
                  <div className={styles.mediaRow}>
                    <div className={styles.mediaThumb}>
                      {item.url ? (
                        item.type === "video" ? (
                          <video src={item.url} autoPlay muted loop playsInline />
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={item.url} alt={item.title || `Arte ${index + 1}`} />
                        )
                      ) : (
                        <div className={styles.mediaPlaceholder}>
                          {item.type === "video" ? <Video size={24} /> : <ImageIcon size={24} />}
                          <span>Sem mídia</span>
                        </div>
                      )}
                    </div>

                    <div className={styles.uploadButtons}>
                      {item.type === "image" ? (
                        <>
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            ref={(el) => {
                              fileInputRefs.current[index] = el;
                            }}
                            onChange={(e) => void handleImageUpload(e, index)}
                          />
                          <button
                            type="button"
                            className={styles.btnUpload}
                            onClick={() => fileInputRefs.current[index]?.click()}
                          >
                            <Upload size={14} /> Carregar Imagem (JPG, PNG, WebP)
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime"
                            style={{ display: "none" }}
                            ref={(el) => {
                              videoInputRefs.current[index] = el;
                            }}
                            onChange={(e) => void handleVideoUpload(e, index)}
                          />
                          <button
                            type="button"
                            className={styles.btnUpload}
                            onClick={() => videoInputRefs.current[index]?.click()}
                          >
                            <Upload size={14} /> Carregar Vídeo (MP4, WebM até 20MB)
                          </button>
                        </>
                      )}

                      <div className={styles.field} style={{ marginTop: 4 }}>
                        <label className={styles.fieldLabel}>Ou cole a URL direta da mídia:</label>
                        <input
                          className={styles.input}
                          type="url"
                          value={item.url}
                          onChange={(e) => handleUpdateItem(index, { url: e.target.value })}
                          placeholder={item.type === "video" ? "https://seusite.com/video.mp4" : "https://seusite.com/foto.jpg"}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Text & Link Configuration Fields */}
                  <div className={styles.formGrid2}>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Badge / Selo em destaque (opcional):</label>
                      <input
                        className={styles.input}
                        value={item.badge || ""}
                        onChange={(e) => handleUpdateItem(index, { badge: e.target.value })}
                        placeholder="Ex: PROMOÇÃO, 50% OFF, NOVIDADE"
                        maxLength={30}
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Título principal da arte:</label>
                      <input
                        className={styles.input}
                        value={item.title || ""}
                        onChange={(e) => handleUpdateItem(index, { title: e.target.value })}
                        placeholder="Ex: Combo Barba & Cabelo com Desconto"
                        maxLength={60}
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Subtítulo / Descrição curta (opcional):</label>
                    <input
                      className={styles.input}
                      value={item.subtitle || ""}
                      onChange={(e) => handleUpdateItem(index, { subtitle: e.target.value })}
                      placeholder="Ex: Válido de terça a quinta. Aproveite esta semana!"
                      maxLength={100}
                    />
                  </div>

                  <div className={styles.formGrid2}>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Link ao clicar na arte (opcional):</label>
                      <div style={{ position: "relative" }}>
                        <input
                          className={styles.input}
                          value={item.linkUrl || ""}
                          onChange={(e) => handleUpdateItem(index, { linkUrl: e.target.value })}
                          placeholder="Ex: https://wa.me/55... ou link externo"
                        />
                      </div>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Texto do botão de ação:</label>
                      <input
                        className={styles.input}
                        value={item.buttonText || ""}
                        onChange={(e) => handleUpdateItem(index, { buttonText: e.target.value })}
                        placeholder="Ex: Saiba mais, Aproveitar"
                        maxLength={30}
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Alinhamento do foco / corte:</label>
                      <div className={styles.pillGroup}>
                        <button
                          type="button"
                          className={`${styles.pillBtn} ${(item.focusPosition || "center") === "center" ? styles.pillBtnActive : ""}`}
                          onClick={() => handleUpdateItem(index, { focusPosition: "center" })}
                        >
                          Centro
                        </button>
                        <button
                          type="button"
                          className={`${styles.pillBtn} ${item.focusPosition === "top" ? styles.pillBtnActive : ""}`}
                          onClick={() => handleUpdateItem(index, { focusPosition: "top" })}
                        >
                          Topo (Rosto/Corte)
                        </button>
                        <button
                          type="button"
                          className={`${styles.pillBtn} ${item.focusPosition === "bottom" ? styles.pillBtnActive : ""}`}
                          onClick={() => handleUpdateItem(index, { focusPosition: "bottom" })}
                        >
                          Base
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {promoBanners.items.length < 3 && (
                <button
                  type="button"
                  className={styles.btnAddBanner}
                  onClick={handleAddItem}
                >
                  <Plus size={16} /> Adicionar outra arte ({promoBanners.items.length}/3)
                </button>
              )}
            </div>
          )}

          {/* Live Real-Time Preview */}
          {showLivePreview && hasValidMedia && (
            <div className={styles.livePreviewSection}>
              <span className={styles.previewLabel}>
                <Eye size={14} /> Pré-visualização ao vivo do carrossel
              </span>
              <div style={{ maxWidth: promoBanners.aspectRatio === "banner" ? "100%" : 440, margin: "0 auto", width: "100%" }}>
                <BookingPromoCarousel promoBanners={promoBanners} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
