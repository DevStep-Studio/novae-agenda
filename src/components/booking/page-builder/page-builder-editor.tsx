/* eslint-disable react-hooks/set-state-in-effect -- Synchronizes document layout and revisions from server API on mount. */
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  Save,
  Rocket,
  Layers,
  Plus,
  Palette,
  History,
  LayoutTemplate,
  ChevronRight,
  ChevronDown,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  Building2,
  Image as ImageIcon,
  FileText,
  Search,
  Users,
  ShoppingBag,
  MapPin,
  Clock,
  Camera,
  HelpCircle,
  Type,
  Box,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useStore } from "@/store/store";
import type {
  PageBuilderDocument,
  PageSection,
  PageBlock,
  BlockType,
  DeviceMode,
  GlobalTokens,
  PageBuilderRevision,
} from "./page-builder-types";
import { COMPONENT_REGISTRY, CATEGORY_LABELS } from "./page-builder-registry";
import { TEMPLATES, DEFAULT_GLOBAL_TOKENS } from "./page-builder-templates";
import { PageBuilderRenderer } from "./page-builder-renderer";
import styles from "./page-builder.module.css";

interface PageBuilderEditorProps {
  onExit?: () => void;
  onSaved?: () => void;
}

export function PageBuilderEditor({ onExit, onSaved }: PageBuilderEditorProps) {
  const { notify } = useStore();

  // Document State
  const [doc, setDoc] = useState<PageBuilderDocument | null>(null);
  const [status, setStatus] = useState<"draft" | "published">("published");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Undo / Redo History Stacks
  const [undoStack, setUndoStack] = useState<PageBuilderDocument[]>([]);
  const [redoStack, setRedoStack] = useState<PageBuilderDocument[]>([]);

  // Editor View Controls
  const [activeTab, setActiveTab] = useState<"layers" | "elements" | "templates" | "global" | "history">("layers");
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [focusPreview, setFocusPreview] = useState(false);

  // Selection State
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Revisions & Real Catalog Preview Data
  const [revisions, setRevisions] = useState<PageBuilderRevision[]>([]);
  const [catalog, setCatalog] = useState<any>(null);

  // Mobile Bottom Sheet control
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Load document and revisions on mount
  const loadDocument = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{
        data: {
          draftLayout: PageBuilderDocument;
          publishedLayout: PageBuilderDocument | null;
          status: "draft" | "published";
          catalog?: any;
        };
      }>("/api/business/page-builder");

      const initial = res.data.draftLayout || TEMPLATES[0].document;
      setDoc(initial);
      setStatus(res.data.status || "published");

      // Auto-expand all sections in Layers tree
      const exp: Record<string, boolean> = {};
      initial.sections?.forEach((s) => {
        exp[s.id] = true;
      });
      setExpandedSections(exp);

      if (res.data.catalog) {
        setCatalog(res.data.catalog);
      }
    } catch (err: any) {
      notify(err.message || "Erro ao carregar página de agendamento.", "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const loadRevisions = useCallback(async () => {
    try {
      const res = await api<{ data: PageBuilderRevision[] }>("/api/business/page-builder/versions");
      setRevisions(res.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    void loadDocument();
    void loadRevisions();
  }, [loadDocument, loadRevisions]);

  // Update document with Undo history push
  const updateDoc = useCallback((newDoc: PageBuilderDocument) => {
    setDoc((prev) => {
      if (prev) {
        setUndoStack((u) => [...u.slice(-20), prev]);
        setRedoStack([]);
      }
      return newDoc;
    });
    setHasUnsavedChanges(true);
  }, []);

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    if (!undoStack.length || !doc) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, doc]);
    setDoc(prev);
    setHasUnsavedChanges(true);
  }, [doc, undoStack]);

  const handleRedo = useCallback(() => {
    if (!redoStack.length || !doc) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, doc]);
    setDoc(next);
    setHasUnsavedChanges(true);
  }, [doc, redoStack]);

  // Autosave Draft with debounce (1500ms)
  useEffect(() => {
    if (!hasUnsavedChanges || !doc) return;
    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        await api("/api/business/page-builder", {
          method: "PUT",
          body: JSON.stringify({ draftLayout: doc, globalTokens: doc.globalTokens }),
        });
        setHasUnsavedChanges(false);
        setStatus("draft");
      } catch {
        // Keep unsaved flag on failure
      } finally {
        setSaving(false);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [doc, hasUnsavedChanges]);

  // Manual Save Draft
  const handleSaveDraft = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      await api("/api/business/page-builder", {
        method: "PUT",
        body: JSON.stringify({ draftLayout: doc, globalTokens: doc.globalTokens }),
      });
      setHasUnsavedChanges(false);
      setStatus("draft");
      notify("Rascunho salvo com sucesso!", "success");
      void loadRevisions();
    } catch (err: any) {
      notify(err.message || "Falha ao salvar rascunho.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Publish Page
  const handlePublish = async () => {
    if (!doc) return;
    setPublishing(true);
    try {
      // First save latest draft
      await api("/api/business/page-builder", {
        method: "PUT",
        body: JSON.stringify({ draftLayout: doc, globalTokens: doc.globalTokens }),
      });

      // Then publish
      await api("/api/business/page-builder", {
        method: "POST",
      });

      setStatus("published");
      setHasUnsavedChanges(false);
      notify("Página publicada com sucesso! O link público foi atualizado.", "success");
      void loadRevisions();
      onSaved?.();
    } catch (err: any) {
      notify(err.message || "Erro ao publicar página.", "error");
    } finally {
      setPublishing(false);
    }
  };

  // Block Helpers
  const findBlock = useCallback((id: string): { block: PageBlock; section: PageSection; index: number } | null => {
    if (!doc) return null;
    for (const section of doc.sections || []) {
      const idx = section.blocks?.findIndex((b) => b.id === id);
      if (idx !== undefined && idx !== -1) {
        return { block: section.blocks[idx], section, index: idx };
      }
    }
    return null;
  }, [doc]);

  const selectedBlockInfo = selectedBlockId ? findBlock(selectedBlockId) : null;

  // Move block up or down
  const handleMoveBlock = (blockId: string, direction: "up" | "down") => {
    if (!doc) return;
    const info = findBlock(blockId);
    if (!info) return;

    const { section, index } = info;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= section.blocks.length) return;

    const newBlocks = [...section.blocks];
    const [moved] = newBlocks.splice(index, 1);
    newBlocks.splice(targetIndex, 0, moved);

    const newSections = doc.sections.map((s) => (s.id === section.id ? { ...s, blocks: newBlocks } : s));
    updateDoc({ ...doc, sections: newSections });
  };

  // Duplicate block
  const handleDuplicateBlock = (blockId: string) => {
    if (!doc) return;
    const info = findBlock(blockId);
    if (!info) return;

    const { section, index, block } = info;
    const cloned: PageBlock = {
      ...JSON.parse(JSON.stringify(block)),
      id: `blk-${crypto.randomUUID().slice(0, 8)}`,
      name: `${block.name || block.type} (Cópia)`,
    };

    const newBlocks = [...section.blocks];
    newBlocks.splice(index + 1, 0, cloned);

    const newSections = doc.sections.map((s) => (s.id === section.id ? { ...s, blocks: newBlocks } : s));
    updateDoc({ ...doc, sections: newSections });
    setSelectedBlockId(cloned.id);
  };

  // Delete block
  const handleDeleteBlock = (blockId: string) => {
    if (!doc) return;
    const info = findBlock(blockId);
    if (!info) return;

    const meta = COMPONENT_REGISTRY[info.block.type];
    if (meta?.isEssential || info.block.isLocked) {
      notify("Este elemento é indispensável para o funcionamento das reservas e não pode ser removido.", "error");
      return;
    }

    const newBlocks = info.section.blocks.filter((b) => b.id !== blockId);
    const newSections = doc.sections.map((s) => (s.id === info.section.id ? { ...s, blocks: newBlocks } : s));
    updateDoc({ ...doc, sections: newSections });
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  };

  // Add block from library
  const handleAddBlock = (type: BlockType) => {
    if (!doc) return;
    const meta = COMPONENT_REGISTRY[type];
    const newBlock: PageBlock = {
      id: `blk-${crypto.randomUUID().slice(0, 8)}`,
      type,
      name: meta.name,
      props: { ...meta.defaultProps },
    };

    // Target active section or the last section
    const targetSection =
      selectedBlockInfo?.section ||
      doc.sections[doc.sections.length - 1] || {
        id: `sec-${crypto.randomUUID().slice(0, 8)}`,
        name: "Nova Seção",
        props: { paddingY: 16 },
        blocks: [],
      };

    const newSections = doc.sections.map((s) =>
      s.id === targetSection.id ? { ...s, blocks: [...s.blocks, newBlock] } : s,
    );

    updateDoc({ ...doc, sections: newSections });
    setSelectedBlockId(newBlock.id);
    notify(`Elemento "${meta.name}" adicionado à página!`, "success");
  };

  // Apply template preset
  const handleApplyTemplate = (template: (typeof TEMPLATES)[0]) => {
    if (!confirm(`Aplicar o modelo "${template.name}"? Isso substituirá a composição atual em rascunho.`)) return;
    const newDoc = JSON.parse(JSON.stringify(template.document)) as PageBuilderDocument;
    updateDoc(newDoc);
    notify(`Modelo "${template.name}" aplicado!`, "success");
  };

  // Restore revision
  const handleRestoreRevision = async (rev: PageBuilderRevision) => {
    if (!confirm(`Deseja restaurar a Versão ${rev.versionNumber}?`)) return;
    try {
      const res = await api<{ data: { restoredDoc: PageBuilderDocument } }>(
        "/api/business/page-builder/versions",
        {
          method: "POST",
          body: JSON.stringify({ revisionId: rev.id }),
        },
      );
      setDoc(res.data.restoredDoc);
      setHasUnsavedChanges(true);
      notify(`Versão ${rev.versionNumber} restaurada com sucesso!`, "success");
    } catch (err: any) {
      notify(err.message || "Erro ao restaurar versão.", "error");
    }
  };

  if (loading || !doc) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          height: "100vh",
          backgroundColor: "#09090b",
          color: "#fafafa",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <Sparkles size={32} color="#dcff4c" />
          <p style={{ fontWeight: 600 }}>Carregando Page Builder 2.0...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.builderRoot}>
      {/* =========================================================
          TOP TOOLBAR
         ========================================================= */}
      <header className={styles.topToolbar}>
        <div className={styles.toolbarLeft}>
          {onExit && (
            <button type="button" className={styles.exitBtn} onClick={onExit}>
              <ArrowLeft size={14} />
              <span>Voltar</span>
            </button>
          )}

          <div className={styles.docTitle}>
            <span>{doc.name || "Página de Agendamento"}</span>
            {saving ? (
              <span className={styles.statusBadgeSaving}>Salvando...</span>
            ) : hasUnsavedChanges ? (
              <span className={styles.statusBadgeDraft}>Alterações não salvas</span>
            ) : status === "published" ? (
              <span className={styles.statusBadgePublished}>Publicado</span>
            ) : (
              <span className={styles.statusBadgeDraft}>Rascunho</span>
            )}
          </div>
        </div>

        <div className={styles.toolbarCenter}>
          {/* Undo / Redo */}
          <div className={styles.undoRedoGroup}>
            <button
              type="button"
              className={styles.toolIconBtn}
              title="Desfazer (Cmd+Z)"
              disabled={!undoStack.length}
              onClick={handleUndo}
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              className={styles.toolIconBtn}
              title="Refazer (Cmd+Shift+Z)"
              disabled={!redoStack.length}
              onClick={handleRedo}
            >
              <Redo2 size={15} />
            </button>
          </div>

          {/* Viewport Breakpoints */}
          <div className={styles.deviceGroup}>
            <button
              type="button"
              className={`${styles.toolIconBtn} ${device === "desktop" ? styles.toolIconBtnActive : ""}`}
              title="Computador (Desktop)"
              onClick={() => setDevice("desktop")}
            >
              <Monitor size={15} />
            </button>
            <button
              type="button"
              className={`${styles.toolIconBtn} ${device === "tablet" ? styles.toolIconBtnActive : ""}`}
              title="Tablet (768px)"
              onClick={() => setDevice("tablet")}
            >
              <Tablet size={15} />
            </button>
            <button
              type="button"
              className={`${styles.toolIconBtn} ${device === "mobile" ? styles.toolIconBtnActive : ""}`}
              title="Celular (390px)"
              onClick={() => setDevice("mobile")}
            >
              <Smartphone size={15} />
            </button>
          </div>

          {/* Focus Mode */}
          <button
            type="button"
            className={`${styles.toolIconBtn} ${focusPreview ? styles.toolIconBtnActive : ""}`}
            title="Foco na Prévia (Esconder painéis)"
            onClick={() => setFocusPreview(!focusPreview)}
          >
            <Eye size={15} />
          </button>
        </div>

        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={styles.saveDraftBtn}
            disabled={saving || !hasUnsavedChanges}
            onClick={handleSaveDraft}
          >
            <Save size={14} />
            <span>Salvar rascunho</span>
          </button>

          <button
            type="button"
            className={styles.publishBtn}
            disabled={publishing}
            onClick={handlePublish}
          >
            <Rocket size={14} />
            <span>{publishing ? "Publicando..." : "Publicar"}</span>
          </button>
        </div>
      </header>

      {/* =========================================================
          WORKSPACE (LEFT SIDEBAR, CANVAS, RIGHT INSPECTOR)
         ========================================================= */}
      <div className={styles.builderWorkspace}>
        {/* AREA A: LEFT SIDEBAR */}
        {!focusPreview && (
          <aside className={styles.leftSidebar}>
            <nav className={styles.sidebarTabs}>
              <button
                type="button"
                className={`${styles.sidebarTabBtn} ${activeTab === "layers" ? styles.sidebarTabBtnActive : ""}`}
                onClick={() => setActiveTab("layers")}
              >
                <Layers size={16} />
                <span>Camadas</span>
              </button>
              <button
                type="button"
                className={`${styles.sidebarTabBtn} ${activeTab === "elements" ? styles.sidebarTabBtnActive : ""}`}
                onClick={() => setActiveTab("elements")}
              >
                <Plus size={16} />
                <span>Adicionar</span>
              </button>
              <button
                type="button"
                className={`${styles.sidebarTabBtn} ${activeTab === "templates" ? styles.sidebarTabBtnActive : ""}`}
                onClick={() => setActiveTab("templates")}
              >
                <LayoutTemplate size={16} />
                <span>Modelos</span>
              </button>
              <button
                type="button"
                className={`${styles.sidebarTabBtn} ${activeTab === "global" ? styles.sidebarTabBtnActive : ""}`}
                onClick={() => setActiveTab("global")}
              >
                <Palette size={16} />
                <span>Estilo</span>
              </button>
              <button
                type="button"
                className={`${styles.sidebarTabBtn} ${activeTab === "history" ? styles.sidebarTabBtnActive : ""}`}
                onClick={() => setActiveTab("history")}
              >
                <History size={16} />
                <span>Versões</span>
              </button>
            </nav>

            <div className={styles.sidebarContent}>
              {/* TAB: LAYERS NAVIGATOR */}
              {activeTab === "layers" && (
                <div className={styles.layersTree}>
                  {doc.sections?.map((section) => {
                    const isExp = expandedSections[section.id] !== false;
                    return (
                      <div key={section.id} className={styles.layerSection}>
                        <div
                          className={styles.layerSectionHeader}
                          onClick={() =>
                            setExpandedSections((prev) => ({
                              ...prev,
                              [section.id]: !isExp,
                            }))
                          }
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span>{section.name || "Seção"}</span>
                          </div>
                          <span style={{ fontSize: 10, color: "#71717a" }}>
                            {section.blocks?.length || 0}
                          </span>
                        </div>

                        {isExp && (
                          <div>
                            {section.blocks?.map((block) => {
                              const meta = COMPONENT_REGISTRY[block.type];
                              const isSelected = selectedBlockId === block.id;
                              return (
                                <div
                                  key={block.id}
                                  className={`${styles.layerBlockItem} ${isSelected ? styles.layerBlockItemActive : ""}`}
                                  onClick={() => setSelectedBlockId(block.id)}
                                >
                                  <span>{meta?.name || block.type}</span>
                                  {meta?.isEssential && (
                                    <span style={{ fontSize: 10, color: "#dcff4c" }}>● Essencial</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB: ELEMENT LIBRARY */}
              {activeTab === "elements" && (
                <div className={styles.elementCategories}>
                  {(["booking", "identity", "basics", "content"] as const).map((cat) => (
                    <div key={cat}>
                      <h4 className={styles.categoryTitle}>{CATEGORY_LABELS[cat]}</h4>
                      <div className={styles.elementGrid}>
                        {Object.values(COMPONENT_REGISTRY)
                          .filter((m) => m.category === cat)
                          .map((meta) => (
                            <div
                              key={meta.type}
                              className={styles.elementCard}
                              onClick={() => handleAddBlock(meta.type)}
                            >
                              <div className={styles.elementCardIcon}>
                                <Plus size={16} />
                              </div>
                              <span className={styles.elementCardTitle}>{meta.name}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB: TEMPLATES */}
              {activeTab === "templates" && (
                <div>
                  {TEMPLATES.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className={styles.templateCard}
                      onClick={() => handleApplyTemplate(tmpl)}
                    >
                      <div className={styles.templateCardHeader}>
                        <strong style={{ fontSize: 14 }}>{tmpl.name}</strong>
                        {tmpl.badge && <span className={styles.templateBadge}>{tmpl.badge}</span>}
                      </div>
                      <p style={{ fontSize: 12, color: "#a1a1aa", margin: "4px 0 8px" }}>
                        {tmpl.description}
                      </p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: tmpl.accentColor,
                          }}
                        />
                        <span style={{ fontSize: 11, color: "#71717a" }}>{tmpl.accentColor}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB: GLOBAL STYLES */}
              {activeTab === "global" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Cor de Destaque (Principal)</label>
                    <div className={styles.fieldColorWrap}>
                      <input
                        type="color"
                        className={styles.colorPicker}
                        value={doc.globalTokens.primaryColor}
                        onChange={(e) =>
                          updateDoc({
                            ...doc,
                            globalTokens: { ...doc.globalTokens, primaryColor: e.target.value },
                          })
                        }
                      />
                      <input
                        type="text"
                        className={styles.fieldInput}
                        style={{ flex: 1 }}
                        value={doc.globalTokens.primaryColor}
                        onChange={(e) =>
                          updateDoc({
                            ...doc,
                            globalTokens: { ...doc.globalTokens, primaryColor: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Tema Base</label>
                    <select
                      className={styles.fieldSelect}
                      value={doc.globalTokens.themeMode}
                      onChange={(e) =>
                        updateDoc({
                          ...doc,
                          globalTokens: {
                            ...doc.globalTokens,
                            themeMode: e.target.value as any,
                            backgroundColor: e.target.value === "light" ? "#f8fafc" : "#09090b",
                            surfaceColor: e.target.value === "light" ? "#ffffff" : "#18181b",
                            textColor: e.target.value === "light" ? "#0f172a" : "#f4f4f5",
                            textMutedColor: e.target.value === "light" ? "#64748b" : "#a1a1aa",
                            borderColor: e.target.value === "light" ? "#e2e8f0" : "#27272a",
                          },
                        })
                      }
                    >
                      <option value="dark">Escuro (Dark Mode)</option>
                      <option value="light">Claro (Light Mode)</option>
                    </select>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Fonte dos Títulos</label>
                    <select
                      className={styles.fieldSelect}
                      value={doc.globalTokens.fontHeading}
                      onChange={(e) =>
                        updateDoc({
                          ...doc,
                          globalTokens: { ...doc.globalTokens, fontHeading: e.target.value },
                        })
                      }
                    >
                      <option value="Outfit">Outfit (Moderna & Tecnológica)</option>
                      <option value="Inter">Inter (Clean & Minimalista)</option>
                      <option value="Playfair Display">Playfair Display (Elegante / Editorial)</option>
                      <option value="Plus Jakarta Sans">Plus Jakarta Sans (Corporativa)</option>
                      <option value="Syne">Syne (Arrojada & Urbana)</option>
                    </select>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>
                      <span>Arredondamento dos Cards</span>
                      <span>{doc.globalTokens.borderRadius}px</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={28}
                      step={2}
                      value={doc.globalTokens.borderRadius}
                      onChange={(e) =>
                        updateDoc({
                          ...doc,
                          globalTokens: { ...doc.globalTokens, borderRadius: Number(e.target.value) },
                        })
                      }
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Largura Máxima do Container</label>
                    <select
                      className={styles.fieldSelect}
                      value={doc.globalTokens.containerWidth}
                      onChange={(e) =>
                        updateDoc({
                          ...doc,
                          globalTokens: { ...doc.globalTokens, containerWidth: Number(e.target.value) },
                        })
                      }
                    >
                      <option value={960}>960px (Compacto)</option>
                      <option value={1140}>1140px (Médio)</option>
                      <option value={1200}>1200px (Padrão)</option>
                      <option value={1440}>1440px (Amplo)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* TAB: REVISION HISTORY */}
              {activeTab === "history" && (
                <div>
                  {!revisions.length ? (
                    <p style={{ fontSize: 13, color: "#a1a1aa" }}>Nenhuma versão anterior registrada.</p>
                  ) : (
                    revisions.map((rev) => (
                      <div key={rev.id} className={styles.revisionItem}>
                        <div>
                          <strong style={{ fontSize: 13 }}>{rev.name}</strong>
                          <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>
                            {new Date(rev.createdAt).toLocaleString("pt-BR")}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={styles.exitBtn}
                          onClick={() => handleRestoreRevision(rev)}
                        >
                          Restaurar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* AREA B: CENTRAL CANVAS */}
        <main className={styles.canvasArea} onClick={() => setSelectedBlockId(null)}>
          <div
            className={`${styles.viewportFrame} ${
              device === "mobile"
                ? styles.viewportMobile
                : device === "tablet"
                  ? styles.viewportTablet
                  : styles.viewportDesktop
            }`}
          >
            <PageBuilderRenderer
              document={doc}
              mode="editor"
              device={device}
              catalog={catalog}
              selectedBlockId={selectedBlockId}
              hoveredBlockId={hoveredBlockId}
              onSelectBlock={(id) => setSelectedBlockId(id)}
              onHoverBlock={(id) => setHoveredBlockId(id)}
              onMoveBlock={handleMoveBlock}
              onDuplicateBlock={handleDuplicateBlock}
              onDeleteBlock={handleDeleteBlock}
            />
          </div>
        </main>

        {/* AREA C: PROPERTIES INSPECTOR */}
        {!focusPreview && (
          <aside className={styles.rightSidebar}>
            <div className={styles.inspectorHeader}>
              <h3 className={styles.inspectorTitle}>
                <Sliders size={16} />
                <span>
                  {selectedBlockInfo
                    ? COMPONENT_REGISTRY[selectedBlockInfo.block.type]?.name || "Propriedades"
                    : "Página"}
                </span>
              </h3>
              {selectedBlockId && (
                <button
                  type="button"
                  className={styles.toolIconBtn}
                  onClick={() => setSelectedBlockId(null)}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className={styles.inspectorBody}>
              {selectedBlockInfo ? (
                <>
                  {/* Categorized Props Fields */}
                  {COMPONENT_REGISTRY[selectedBlockInfo.block.type]?.propDefinitions?.map((def) => {
                    const block = selectedBlockInfo.block;
                    const currentValue =
                      block.props[def.name] !== undefined
                        ? block.props[def.name]
                        : def.defaultValue;

                    const handlePropChange = (val: any) => {
                      const newProps = { ...block.props, [def.name]: val };
                      const newBlocks = selectedBlockInfo.section.blocks.map((b) =>
                        b.id === block.id ? { ...b, props: newProps } : b,
                      );
                      const newSections = doc.sections.map((s) =>
                        s.id === selectedBlockInfo.section.id ? { ...s, blocks: newBlocks } : s,
                      );
                      updateDoc({ ...doc, sections: newSections });
                    };

                    if (def.type === "switch") {
                      return (
                        <div
                          key={def.name}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                        >
                          <label className={styles.fieldLabel}>{def.label}</label>
                          <input
                            type="checkbox"
                            checked={!!currentValue}
                            onChange={(e) => handlePropChange(e.target.checked)}
                          />
                        </div>
                      );
                    }

                    if (def.type === "slider") {
                      return (
                        <div key={def.name} className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>
                            <span>{def.label}</span>
                            <span>{currentValue}</span>
                          </label>
                          <input
                            type="range"
                            min={def.min ?? 0}
                            max={def.max ?? 100}
                            step={def.step ?? 1}
                            value={currentValue ?? 0}
                            onChange={(e) => handlePropChange(Number(e.target.value))}
                          />
                        </div>
                      );
                    }

                    if (def.type === "select") {
                      return (
                        <div key={def.name} className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>{def.label}</label>
                          <select
                            className={styles.fieldSelect}
                            value={currentValue}
                            onChange={(e) => handlePropChange(e.target.value)}
                          >
                            {def.options?.map((opt) => (
                              <option key={String(opt.value)} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    }

                    if (def.type === "textarea") {
                      return (
                        <div key={def.name} className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>{def.label}</label>
                          <textarea
                            className={styles.fieldInput}
                            rows={3}
                            value={currentValue || ""}
                            onChange={(e) => handlePropChange(e.target.value)}
                          />
                        </div>
                      );
                    }

                    return (
                      <div key={def.name} className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>{def.label}</label>
                        <input
                          type="text"
                          className={styles.fieldInput}
                          value={currentValue || ""}
                          onChange={(e) => handlePropChange(e.target.value)}
                        />
                      </div>
                    );
                  })}

                  {/* Responsive Visibility Override */}
                  <div style={{ borderTop: "1px solid #27272a", paddingTop: 14, marginTop: 10 }}>
                    <h4 style={{ fontSize: 12, color: "#a1a1aa", margin: "0 0 10px" }}>
                      Visibilidade por Dispositivo
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <input
                          type="checkbox"
                          checked={!selectedBlockInfo.block.responsive?.mobile?.hideOnMobile}
                          onChange={(e) => {
                            const hide = !e.target.checked;
                            const block = selectedBlockInfo.block;
                            const updatedBlock = {
                              ...block,
                              responsive: {
                                ...block.responsive,
                                mobile: { ...block.responsive?.mobile, hideOnMobile: hide },
                              },
                            };
                            const newBlocks = selectedBlockInfo.section.blocks.map((b) =>
                              b.id === block.id ? updatedBlock : b,
                            );
                            const newSections = doc.sections.map((s) =>
                              s.id === selectedBlockInfo.section.id ? { ...s, blocks: newBlocks } : s,
                            );
                            updateDoc({ ...doc, sections: newSections });
                          }}
                        />
                        <span>Visível no Celular (Mobile)</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <input
                          type="checkbox"
                          checked={!selectedBlockInfo.block.responsive?.desktop?.hideOnDesktop}
                          onChange={(e) => {
                            const hide = !e.target.checked;
                            const block = selectedBlockInfo.block;
                            const updatedBlock = {
                              ...block,
                              responsive: {
                                ...block.responsive,
                                desktop: { ...block.responsive?.desktop, hideOnDesktop: hide },
                              },
                            };
                            const newBlocks = selectedBlockInfo.section.blocks.map((b) =>
                              b.id === block.id ? updatedBlock : b,
                            );
                            const newSections = doc.sections.map((s) =>
                              s.id === selectedBlockInfo.section.id ? { ...s, blocks: newBlocks } : s,
                            );
                            updateDoc({ ...doc, sections: newSections });
                          }}
                        />
                        <span>Visível no Computador (Desktop)</span>
                      </label>
                    </div>
                  </div>

                  {/* Delete Button */}
                  {!selectedBlockInfo.block.isLocked && (
                    <button
                      type="button"
                      style={{
                        marginTop: 16,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid #7f1d1d",
                        background: "rgba(127, 29, 29, 0.2)",
                        color: "#fca5a5",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                      onClick={() => handleDeleteBlock(selectedBlockInfo.block.id)}
                    >
                      <Trash2 size={14} />
                      <span>Excluir elemento</span>
                    </button>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center", color: "#71717a", padding: "32px 0" }}>
                  <Sliders size={28} style={{ opacity: 0.5, marginBottom: 8 }} />
                  <p style={{ fontSize: 13, margin: 0 }}>
                    Clique em qualquer elemento na prévia para editar suas propriedades.
                  </p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
