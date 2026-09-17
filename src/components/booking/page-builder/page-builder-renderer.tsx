/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Building2,
  Calendar,
  Clock,
  MapPin,
  Search,
  Check,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Copy,
  ArrowUp,
  ArrowDown,
  Phone,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import type {
  PageBuilderDocument,
  PageBlock,
  PageSection,
  DeviceMode,
} from "./page-builder-types";
import { COMPONENT_REGISTRY } from "./page-builder-registry";
import { LocationMapCard } from "../location-map-card";
import { money } from "../primitives";
import styles from "./page-builder-renderer.module.css";

export interface PageBuilderRendererProps {
  document: PageBuilderDocument;
  mode?: "editor" | "public";
  device?: DeviceMode;
  catalog: any; // PublicCatalog or partial catalog for preview
  selectedBlockId?: string | null;
  hoveredBlockId?: string | null;
  onSelectBlock?: (blockId: string) => void;
  onHoverBlock?: (blockId: string | null) => void;
  onMoveBlock?: (blockId: string, direction: "up" | "down") => void;
  onDuplicateBlock?: (blockId: string) => void;
  onDeleteBlock?: (blockId: string) => void;
  // Interactive booking state
  selectedServiceIds?: string[];
  onToggleService?: (serviceId: string) => void;
  onContinueBooking?: () => void;
}

export function PageBuilderRenderer({
  document,
  mode = "public",
  device = "desktop",
  catalog,
  selectedBlockId,
  hoveredBlockId,
  onSelectBlock,
  onHoverBlock,
  onMoveBlock,
  onDuplicateBlock,
  onDeleteBlock,
  selectedServiceIds = [],
  onToggleService,
  onContinueBooking,
}: PageBuilderRendererProps) {
  const { company, services = [], professionals = [], locations = [] } = catalog || {};
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const tokens = document.globalTokens || {};

  // Build CSS custom properties from global tokens
  const themeStyles: React.CSSProperties = {
    "--pb-primary": tokens.primaryColor || "#dcff4c",
    "--pb-bg": tokens.backgroundColor || "#09090b",
    "--pb-surface": tokens.surfaceColor || "#18181b",
    "--pb-text": tokens.textColor || "#f4f4f5",
    "--pb-muted": tokens.textMutedColor || "#a1a1aa",
    "--pb-border": tokens.borderColor || "#27272a",
    "--pb-radius": `${tokens.borderRadius ?? 12}px`,
    "--pb-container-max-width": `${tokens.containerWidth ?? 1200}px`,
    "--pb-font-heading": tokens.fontHeading || "Outfit",
    "--pb-font-body": tokens.fontBody || "Inter",
  } as React.CSSProperties;

  // Filter services by search & category
  const categories: string[] = ["Todos", ...Array.from(new Set<string>(services.map((s: any) => (s.category as string) || "Geral")))];
  const filteredServices = services.filter((s: any) => {
    const matchesSearch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "Todos" || (s.category || "Geral") === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const selectedServices = services.filter((s: any) => selectedServiceIds.includes(s.id));
  const subtotal = selectedServices.reduce((acc: number, s: any) => acc + (Number(s.price) || 0), 0);

  // Helper to render an individual block
  function renderBlock(block: PageBlock) {
    const isSelected = mode === "editor" && selectedBlockId === block.id;
    const isHovered = mode === "editor" && hoveredBlockId === block.id;
    const meta = COMPONENT_REGISTRY[block.type];

    // Responsive override resolution
    const responsiveProps =
      device === "mobile"
        ? block.responsive?.mobile
        : device === "tablet"
          ? block.responsive?.tablet
          : block.responsive?.desktop;

    const mergedProps = { ...block.props, ...responsiveProps };

    if (
      (device === "mobile" && mergedProps.hideOnMobile) ||
      (device === "tablet" && mergedProps.hideOnTablet) ||
      (device === "desktop" && mergedProps.hideOnDesktop)
    ) {
      if (mode !== "editor") return null;
    }

    const content = renderBlockContent(block.type, mergedProps, block);

    if (mode !== "editor") {
      return (
        <div key={block.id} id={block.id} className={styles.publicBlock}>
          {content}
        </div>
      );
    }

    return (
      <div
        key={block.id}
        id={block.id}
        className={`${styles.editableBlock} ${isSelected ? styles.editableBlockSelected : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelectBlock?.(block.id);
        }}
        onMouseEnter={() => onHoverBlock?.(block.id)}
        onMouseLeave={() => onHoverBlock?.(null)}
      >
        {/* Component Badge */}
        {(isSelected || isHovered) && (
          <span className={styles.blockBadge}>
            {meta?.name || block.name || block.type}
          </span>
        )}

        {/* Floating Action Bar */}
        {isSelected && (
          <div className={styles.blockActionBar} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.actionBtn}
              title="Mover para cima"
              onClick={() => onMoveBlock?.(block.id, "up")}
            >
              <ArrowUp size={13} />
            </button>
            <button
              type="button"
              className={styles.actionBtn}
              title="Mover para baixo"
              onClick={() => onMoveBlock?.(block.id, "down")}
            >
              <ArrowDown size={13} />
            </button>
            {!block.isLocked && (
              <>
                <button
                  type="button"
                  className={styles.actionBtn}
                  title="Duplicar"
                  onClick={() => onDuplicateBlock?.(block.id)}
                >
                  <Copy size={13} />
                </button>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                  title="Excluir"
                  onClick={() => onDeleteBlock?.(block.id)}
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        )}

        {content}
      </div>
    );
  }

  // Helper to render block-specific UI
  function renderBlockContent(type: string, props: any, block?: PageBlock) {
    switch (type) {
      case "company-header": {
        const logoUrl = company?.avatarUrl || company?.logoUrl;
        return (
          <header
            className={styles.headerBlock}
            style={{
              justifyContent:
                props.align === "left"
                  ? "flex-start"
                  : props.align === "center"
                    ? "center"
                    : "space-between",
              paddingTop: props.paddingY || 16,
              paddingBottom: props.paddingY || 16,
            }}
          >
            <div className={styles.headerBrand}>
              {props.showLogo && (
                logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={company?.name || "Logo"}
                    className={styles.headerLogo}
                    style={{ width: props.logoSize || 52, height: props.logoSize || 52 }}
                  />
                ) : (
                  <div
                    className={styles.headerLogoPlaceholder}
                    style={{ width: props.logoSize || 52, height: props.logoSize || 52 }}
                  >
                    {(company?.name || "R").slice(0, 1).toUpperCase()}
                  </div>
                )
              )}

              <div className={styles.headerInfo}>
                {props.showName && <h1>{company?.name || "Meu Estabelecimento"}</h1>}
                {props.showCategory && (
                  <div className={styles.headerCategory}>
                    {company?.category || "Serviços Profissionais"}
                  </div>
                )}
              </div>
            </div>

            {props.showMyBookingsButton && (
              <a href="/minhas-reservas" className={styles.myBookingsBtn}>
                <Calendar size={14} />
                <span>{props.myBookingsButtonText || "Minhas reservas"}</span>
              </a>
            )}
          </header>
        );
      }

      case "cover-banner": {
        const coverUrl = company?.coverUrl;
        const bannerHeight = device === "mobile" ? props.heightMobile || 140 : props.heightDesktop || 220;
        return (
          <div
            className={styles.coverBanner}
            style={{
              height: bannerHeight,
              borderRadius: props.borderRadius || 16,
            }}
          >
            {coverUrl ? (
              <img
                src={coverUrl}
                alt="Banner de Capa"
                className={styles.coverImage}
                style={{ objectPosition: props.objectPosition || "center" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "linear-gradient(135deg, #18181b 0%, #27272a 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#71717a",
                  fontSize: "13px",
                  gap: "6px",
                }}
              >
                <Sparkles size={16} />
                <span>Banner de Capa do Estabelecimento</span>
              </div>
            )}
            <div
              className={styles.coverOverlay}
              style={{
                backgroundColor: `rgba(0,0,0, ${(props.overlayOpacity ?? 25) / 100})`,
              }}
            />
          </div>
        );
      }

      case "bio-presentation": {
        return (
          <div
            className={styles.bioBlock}
            style={{ textAlign: props.textAlign || "center", alignItems: props.textAlign === "left" ? "flex-start" : "center" }}
          >
            {props.showDescription && company?.description && (
              <p className={styles.bioDescription} style={{ fontSize: props.fontSize || 15 }}>
                {company.description}
              </p>
            )}

            <div className={styles.bioBadges}>
              {props.showAddressBadge && company?.address && (
                <span className={styles.addressBadge}>
                  <MapPin size={12} />
                  <span>{company.address}</span>
                </span>
              )}

              {props.showContactLinks && (company?.whatsapp || company?.phone) && (
                <a
                  href={`https://wa.me/${(company?.whatsapp || company?.phone || "").replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.contactBtn}
                >
                  <Phone size={12} />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        );
      }

      case "service-search": {
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className={styles.searchWrap}>
              <Search size={16} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder={props.placeholder || "Buscar serviço..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {props.showCategoryPills && categories.length > 2 && (
              <div className={styles.categoryPills}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`${styles.categoryPill} ${selectedCategory === cat ? styles.categoryPillActive : ""}`}
                    style={{
                      borderRadius: props.pillStyle === "pill" ? 999 : props.pillStyle === "square" ? 4 : 8,
                    }}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    <span>{cat}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      }

      case "service-grid": {
        const columns =
          device === "mobile"
            ? props.columnsMobile || 1
            : device === "tablet"
              ? props.columnsTablet || 2
              : props.columnsDesktop || 2;

        const isVertical = props.cardLayout === "vertical";
        const isCompact = props.cardLayout === "compact";

        return (
          <div
            className={styles.serviceGrid}
            style={{
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: props.gap || 12,
            }}
          >
            {filteredServices.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", padding: 24, textAlign: "center", color: "#a1a1aa" }}>
                Nenhum serviço encontrado.
              </div>
            ) : (
              filteredServices.map((service: any) => {
                const isSelected = selectedServiceIds.includes(service.id);

                if (isVertical) {
                  return (
                    <div
                      key={service.id}
                      className={`${styles.serviceCardVertical} ${isSelected ? styles.serviceCardSelected : ""}`}
                      style={{ borderRadius: props.cardBorderRadius || 12 }}
                      onClick={() => onToggleService?.(service.id)}
                    >
                      {props.showImages && service.imageUrl && (
                        <img
                          src={service.imageUrl}
                          alt={service.name}
                          className={styles.serviceVerticalThumb}
                        />
                      )}
                      <div className={styles.serviceVerticalBody}>
                        <h4 className={styles.serviceName}>{service.name}</h4>
                        {props.showDescription && service.description && (
                          <p style={{ margin: 0, fontSize: 13, color: "var(--pb-muted)" }}>
                            {service.description}
                          </p>
                        )}
                        <div className={styles.serviceMeta}>
                          {props.showDuration && (
                            <span>
                              <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
                              {service.durationMinutes} min
                            </span>
                          )}
                          <span className={styles.servicePrice}>{money(service.price)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={service.id}
                    className={`${styles.serviceCardHorizontal} ${isSelected ? styles.serviceCardSelected : ""}`}
                    style={{
                      borderRadius: props.cardBorderRadius || 12,
                      padding: isCompact ? "8px 12px" : "14px",
                    }}
                    onClick={() => onToggleService?.(service.id)}
                  >
                    {props.showImages && service.imageUrl && !isCompact && (
                      <img
                        src={service.imageUrl}
                        alt={service.name}
                        className={styles.serviceThumb}
                      />
                    )}
                    <div className={styles.serviceInfo}>
                      <h4 className={styles.serviceName}>{service.name}</h4>
                      <div className={styles.serviceMeta}>
                        {props.showDuration && (
                          <span>
                            <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
                            {service.durationMinutes} min
                          </span>
                        )}
                        <span className={styles.servicePrice}>{money(service.price)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.serviceAddBtn}
                      aria-label="Selecionar serviço"
                    >
                      {isSelected ? <Check size={16} /> : <Plus size={16} />}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        );
      }

      case "professional-selector": {
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {props.title || "Nossa Equipe"}
            </h3>
            <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 4 }}>
              {(professionals.length ? professionals : [{ id: "1", name: "Profissional Padrão", jobTitle: "Especialista" }]).map((prof: any) => (
                <div
                  key={prof.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 80,
                  }}
                >
                  <div
                    style={{
                      width: props.avatarSize || 56,
                      height: props.avatarSize || 56,
                      borderRadius: props.avatarShape === "circle" ? "50%" : props.avatarShape === "square" ? 4 : 10,
                      background: "var(--pb-surface)",
                      border: "1px solid var(--pb-border)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 18,
                      fontWeight: 700,
                      color: "var(--pb-primary)",
                      overflow: "hidden",
                    }}
                  >
                    {prof.photoUrl ? (
                      <img src={prof.photoUrl} alt={prof.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      prof.name.slice(0, 1)
                    )}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, textAlign: "center" }}>{prof.name}</span>
                  {props.showJobTitle && prof.jobTitle && (
                    <span style={{ fontSize: 11, color: "var(--pb-muted)", textAlign: "center" }}>
                      {prof.jobTitle}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      }

      case "booking-summary": {
        return (
          <div className={styles.summaryBox}>
            <h3 className={styles.summaryTitle}>Seu Agendamento</h3>
            {selectedServices.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--pb-muted)", margin: "8px 0" }}>
                Nenhum serviço selecionado ainda.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedServices.map((s: any) => (
                  <div
                    key={s.id}
                    style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}
                  >
                    <span>{s.name}</span>
                    <span style={{ fontWeight: 600 }}>{money(s.price)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.summaryTotalRow}>
              <span>Subtotal</span>
              <span className={styles.summaryTotalPrice}>{money(subtotal)}</span>
            </div>

            <button
              type="button"
              className={styles.ctaBtn}
              style={{ borderRadius: props.buttonBorderRadius || 10 }}
              disabled={selectedServices.length === 0}
              onClick={() => onContinueBooking?.()}
            >
              <span>{props.ctaText || "Continuar"}</span>
            </button>

            {props.showTrustBadge && (
              <p className={styles.trustLine}>
                <ShieldCheck size={14} color="var(--pb-primary)" />
                <span>{props.trustBadgeText || "Agendamento instantâneo & seguro"}</span>
              </p>
            )}
          </div>
        );
      }

      case "location-map": {
        const address = locations[0]?.address || company?.address || "Endereço comercial da empresa";
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {props.title && (
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{props.title}</h3>
            )}
            <LocationMapCard
              address={address}
              companyName={company?.name || "Estabelecimento"}
              companyLogo={company?.avatarUrl || company?.logoUrl}
            />
          </div>
        );
      }

      case "working-hours": {
        const days = [
          { day: "Segunda-feira", hours: "08:00 – 19:00" },
          { day: "Terça-feira", hours: "08:00 – 19:00" },
          { day: "Quarta-feira", hours: "08:00 – 19:00" },
          { day: "Quinta-feira", hours: "08:00 – 19:00" },
          { day: "Sexta-feira", hours: "08:00 – 19:00" },
          { day: "Sábado", hours: "08:00 – 16:00" },
          { day: "Domingo", hours: "Fechado" },
        ];
        return (
          <div className={styles.summaryBox}>
            <h3 className={styles.summaryTitle}>{props.title || "Horário de Funcionamento"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              {days.map((d, i) => (
                <div
                  key={d.day}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                    borderBottom: i < days.length - 1 ? "1px solid var(--pb-border)" : "none",
                  }}
                >
                  <span>{d.day}</span>
                  <span style={{ color: d.hours === "Fechado" ? "#ef4444" : "var(--pb-text)" }}>
                    {d.hours}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case "gallery-photos": {
        const columns = device === "mobile" ? props.columnsMobile || 2 : props.columnsDesktop || 3;
        const photos = company?.photos?.length
          ? company.photos
          : [
              "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=500&auto=format&fit=crop",
              "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500&auto=format&fit=crop",
              "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=500&auto=format&fit=crop",
            ];
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {props.title && <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{props.title}</h3>}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: 10,
              }}
            >
              {photos.map((src: string, i: number) => (
                <img
                  key={i}
                  src={src}
                  alt={`Galeria ${i + 1}`}
                  style={{
                    width: "100%",
                    height: 120,
                    objectFit: "cover",
                    borderRadius: props.borderRadius || 10,
                    background: "#27272a",
                  }}
                />
              ))}
            </div>
          </div>
        );
      }

      case "faq-accordion": {
        const items = props.items || [];
        return (
          <div className={styles.faqWrap}>
            {props.title && <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{props.title}</h3>}
            {items.map((item: any, i: number) => {
              const isOpen = openFaqIndex === i;
              return (
                <div key={i} className={styles.faqItem}>
                  <div
                    className={styles.faqQuestion}
                    onClick={() => setOpenFaqIndex(isOpen ? null : i)}
                  >
                    <span>{item.question}</span>
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  {isOpen && <div className={styles.faqAnswer}>{item.answer}</div>}
                </div>
              );
            })}
          </div>
        );
      }

      case "custom-text": {
        const Tag = props.tag === "h1" || props.tag === "h2" || props.tag === "h3" ? props.tag : "div";
        return (
          <Tag
            style={{
              fontSize: props.fontSize || 15,
              textAlign: props.textAlign || "left",
              paddingTop: props.paddingY || 8,
              paddingBottom: props.paddingY || 8,
              color: props.textColor === "primary" ? "var(--pb-primary)" : "var(--pb-text)",
              margin: 0,
            }}
          >
            {props.content}
          </Tag>
        );
      }

      case "footer": {
        return (
          <footer className={styles.footerBlock} style={{ padding: `${props.paddingY || 24}px 0` }}>
            {props.showCopyright && (
              <div>
                © {new Date().getFullYear()} {company?.name || "Reservei"}. {props.customText}
              </div>
            )}
            {props.showPoweredBy && (
              <div className={styles.footerPowered}>
                Plataforma de Agendamento Online desenvolvida por <strong>Reservei</strong>
              </div>
            )}
          </footer>
        );
      }

      case "container": {
        return (
          <div
            style={{
              display: "flex",
              flexDirection: props.direction || "column",
              gap: props.gap || 16,
              padding: `${props.paddingY || 16}px ${props.paddingX || 16}px`,
              background: props.background || "transparent",
              borderRadius: props.borderRadius || 12,
            }}
          >
            {block?.children?.map((child: PageBlock) => renderBlock(child))}
          </div>
        );
      }

      default:
        return (
          <div style={{ padding: 12, border: "1px dashed #52525b", borderRadius: 8, fontSize: 12 }}>
            Componente: {type}
          </div>
        );
    }
  }

  return (
    <div className={styles.pageRoot} style={themeStyles}>
      <div className={styles.pageContainer}>
        {document.sections?.map((section: PageSection) => (
          <section
            key={section.id}
            id={section.id}
            className={styles.section}
            style={{
              paddingTop: section.props?.paddingY ?? 12,
              paddingBottom: section.props?.paddingY ?? 12,
              background: section.props?.background || "transparent",
            }}
          >
            <div className={styles.sectionInner}>
              {section.blocks?.map((block) => renderBlock(block))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
