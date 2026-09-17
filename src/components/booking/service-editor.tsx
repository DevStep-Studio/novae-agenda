"use client";
import { useState, useRef, type FormEvent } from "react";
import NextImage from "next/image";
import { api } from "@/lib/api-client";
import { useStore } from "@/store/store";
import type { ServiceDTO } from "@/shared/types";
import { getServiceDescription } from "@/lib/client-utils";
import { ErrorMessage } from "./primitives";
import styles from "./service-editor.module.css";
import {
  Sparkles,
  Users,
  FolderPlus,
  Pencil,
  ChevronDown,
  Check,
  Image as ImageIcon,
  ImagePlus,
  Trash2,
  RefreshCw,
  Link2,
  SlidersHorizontal,
  Loader2,
  Coins,
  FileText,
} from "lucide-react";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function processImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagem inválida"));
      img.onload = () => {
        const MAX_DIM = 800;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(e.target?.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const webp = canvas.toDataURL("image/webp", 0.85);
          if (webp.startsWith("data:image/webp")) {
            resolve(webp);
            return;
          }
        } catch {}
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(e.target?.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ServiceEditor({
  service,
  onDone,
}: {
  service?: ServiceDTO;
  onDone: () => void;
}) {
  const { employees, categories, reloadServices, reloadCategories, reloadEmployees, notify, confirm } =
    useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState(service?.categoryId ?? "");
  const [extraCategories, setExtraCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [newCategory, setNewCategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showEditCategory, setShowEditCategory] = useState(false);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [isQuote, setIsQuote] = useState<boolean>(
    service?.paymentType === "QUOTE" || (service ? Number(service.price) === 0 : false),
  );
  const initialMinutes = service?.durationMinutes ?? 60;
  const [durationMinutes, setDurationMinutes] = useState<number>(initialMinutes);
  const [durationUnit, setDurationUnit] = useState<"min" | "hora">("min");
  const [durationInput, setDurationInput] = useState<string>(String(initialMinutes));
  const [imageUrl, setImageUrl] = useState(service?.imageUrl ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [paymentType, setPaymentType] = useState(
    service?.paymentType ?? "PAY_LATER",
  );
  const [deliveryMode, setDeliveryMode] = useState(
    service?.deliveryMode ?? "IN_PERSON",
  );
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(
      service?.cancellationPolicy ||
        (service?.paymentType && service.paymentType !== "PAY_LATER") ||
        (service?.deliveryMode && service.deliveryMode !== "IN_PERSON"),
    ),
  );

  const [ids, setIds] = useState(
    employees
      .filter((e) => e.serviceIds.includes(service?.id ?? ""))
      .map((e) => e.id),
  );

  const activeEmployees = employees.filter((e) => e.active);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP).");
      return;
    }
    setUploadingImage(true);
    setError("");
    try {
      const dataUrl = await processImageFile(file);
      setImageUrl(dataUrl);
      notify("Foto selecionada da galeria com sucesso.");
    } catch {
      setError("Não foi possível processar a imagem selecionada.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleAddCategory() {
    if (newCategory.trim().length < 2 || busy) return;
    setBusy(true);
    try {
      const c = await api<{ id: string; name: string }>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: newCategory.trim() }),
      });
      setExtraCategories((prev) => [...prev, c]);
      setCategory(c.id);
      setNewCategory("");
      setShowNewCategory(false);
      if (reloadCategories) await reloadCategories();
      await reloadServices();
      notify(`Categoria "${c.name}" criada com sucesso.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const safeCategories = Array.isArray(categories) ? categories : [];
  const allCategories = [
    ...safeCategories,
    ...extraCategories.filter(
      (c) => !safeCategories.some((x) => x.id === c.id),
    ),
  ];
  const currentCategory = allCategories.find((c) => c.id === category);

  async function handleUpdateCategory() {
    if (!category || editingCategoryName.trim().length < 2 || busy) return;
    setBusy(true);
    try {
      const trimmed = editingCategoryName.trim();
      await api<{ data: { id: string; name: string } }>(`/api/categories/${category}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      setExtraCategories((prev) =>
        prev.map((c) => (c.id === category ? { ...c, name: trimmed } : c)),
      );
      if (reloadCategories) await reloadCategories();
      await reloadServices();
      setShowEditCategory(false);
      notify(`Categoria alterada para "${trimmed}".`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCategory() {
    if (!category || busy) return;
    const catName = currentCategory?.name || "esta categoria";
    const ok = await confirm({
      title: "Excluir categoria",
      description: `Deseja realmente excluir a categoria "${catName}"? Os serviços vinculados serão mantidos em "Outros (Geral)".`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/api/categories/${category}`, {
        method: "DELETE",
      });
      setExtraCategories((prev) => prev.filter((c) => c.id !== category));
      setCategory("");
      setShowEditCategory(false);
      if (reloadCategories) await reloadCategories();
      await reloadServices();
      notify(`Categoria "${catName}" excluída.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const parsedDuration = durationUnit === "hora"
        ? Math.max(5, Math.round(Number(durationInput) * 60))
        : Math.max(5, Number(durationInput || durationMinutes || 60));
      const parsedPrice = isQuote ? 0 : Number(f.get("price") || 0);
      const parsedPaymentType = isQuote ? "QUOTE" : (f.get("payment") || paymentType);

      await api(service ? `/api/services/${service.id}` : "/api/services", {
        method: service ? "PATCH" : "POST",
        body: JSON.stringify({
          name: f.get("name"),
          price: parsedPrice,
          durationMinutes: parsedDuration,
          description: f.get("description"),
          categoryId: category || null,
          employeeIds: ids,
          bufferMinutes: Number(f.get("buffer") || 0),
          imageUrl: String(f.get("image") || imageUrl || "").trim() || null,
          deliveryMode: f.get("mode") || deliveryMode,
          paymentType: parsedPaymentType,
          depositAmount: Number(f.get("deposit") || 0),
          cancellationPolicy: f.get("policy") || "",
        }),
      });
      await Promise.all([reloadServices(), reloadEmployees()]);
      notify(service ? "Serviço atualizado com sucesso." : "Serviço cadastrado com sucesso.");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.container}>
      <form onSubmit={submit} className={styles.section}>
        <ErrorMessage message={error} />

        {/* 1. Informações Básicas */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <Sparkles size={13} />
            <span>Dados principais</span>
          </div>

          <div className={styles.field}>
            <label htmlFor="service-name" className={styles.label}>
              Nome do serviço
            </label>
            <div className={styles.inputWrapper}>
              <input
                id="service-name"
                name="name"
                aria-label="Nome do serviço"
                required
                minLength={2}
                defaultValue={service?.name}
                placeholder="Ex.: Corte & Barba Terapia, Manicure Completa..."
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label htmlFor="service-category" className={styles.label}>
                Categoria
              </label>
              <div className={styles.categoryActionButtons}>
                {Boolean(category && currentCategory) && (
                  <button
                    type="button"
                    className={styles.editCategoryTrigger}
                    onClick={() => {
                      if (!showEditCategory) {
                        setEditingCategoryName(currentCategory?.name ?? "");
                        setShowEditCategory(true);
                        setShowNewCategory(false);
                      } else {
                        setShowEditCategory(false);
                      }
                    }}
                    title="Editar categoria selecionada"
                  >
                    <Pencil size={12} />
                    <span>{showEditCategory ? "Fechar" : "Editar categoria"}</span>
                  </button>
                )}
                <button
                  type="button"
                  className={styles.addCategoryTrigger}
                  onClick={() => {
                    setShowNewCategory(!showNewCategory);
                    setShowEditCategory(false);
                  }}
                >
                  <FolderPlus size={13} />
                  <span>{showNewCategory ? "Fechar" : "+ Nova categoria"}</span>
                </button>
              </div>
            </div>
            <div className={styles.categoryBar}>
              <div className={styles.categorySelectWrapper}>
                <select
                  id="service-category"
                  className={styles.select}
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setShowEditCategory(false);
                  }}
                >
                  <option value="">Outros (Geral)</option>
                  {allCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {showEditCategory && currentCategory && (
              <div className={styles.newCategoryBox}>
                <input
                  aria-label="Editar nome da categoria"
                  value={editingCategoryName}
                  onChange={(e) => setEditingCategoryName(e.target.value)}
                  placeholder="Nome da categoria"
                  className={styles.newCategoryInput}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleUpdateCategory();
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.newCategoryBtn}
                  disabled={editingCategoryName.trim().length < 2 || busy}
                  onClick={handleUpdateCategory}
                >
                  Salvar
                </button>
                <button
                  type="button"
                  className={styles.deleteCategoryBtn}
                  disabled={busy}
                  onClick={handleDeleteCategory}
                  title="Excluir categoria"
                  aria-label="Excluir categoria"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}

            {showNewCategory && (
              <div className={styles.newCategoryBox}>
                <input
                  aria-label="Nova categoria"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Criar categoria"
                  className={styles.newCategoryInput}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCategory();
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.newCategoryBtn}
                  disabled={newCategory.trim().length < 2 || busy}
                  onClick={handleAddCategory}
                >
                  Adicionar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 2. Valores e Tempo */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <Coins size={13} />
            <span>Valores & Tempo</span>
          </div>

          <div className={styles.pricingModeToggle}>
            <button
              type="button"
              className={`${styles.pricingModeBtn} ${!isQuote ? styles.pricingModeBtnActive : ""}`}
              onClick={() => setIsQuote(false)}
            >
              <Coins size={13} />
              <span>Preço fixo</span>
            </button>
            <button
              type="button"
              className={`${styles.pricingModeBtn} ${isQuote ? styles.pricingModeBtnActive : ""}`}
              onClick={() => setIsQuote(true)}
            >
              <FileText size={13} />
              <span>Orçamento direto (Sob consulta)</span>
            </button>
          </div>

          <div className={styles.grid3}>
            {isQuote ? (
              <div className={styles.quoteNoticeBox}>
                <div className={styles.quoteNoticeTitle}>
                  <Sparkles size={14} />
                  <span>Sob consulta / Orçamento direto</span>
                </div>
                <span className={styles.quoteNoticeDesc}>
                  Sem valor fixo. O cliente poderá solicitar orçamento direto pelo WhatsApp com o proprietário ou funcionário selecionado.
                </span>
                <input type="hidden" name="price" value="0" />
              </div>
            ) : (
              <div className={styles.field}>
                <label htmlFor="service-price" className={styles.label}>
                  Preço (R$)
                </label>
                <div className={styles.inputWrapper}>
                  <span className={styles.prefix}>R$</span>
                  <input
                    id="service-price"
                    name="price"
                    aria-label="Preço (R$)"
                    type="number"
                    step="0.01"
                    min={0}
                    required={!isQuote}
                    defaultValue={service?.price ?? ""}
                    placeholder="0,00"
                    className={`${styles.input} ${styles.inputWithPrefix}`}
                  />
                </div>
              </div>
            )}

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label htmlFor="service-duration" className={styles.label}>
                  Duração
                </label>
                <span className={styles.labelHint}>
                  {durationUnit === "hora" ? `${durationMinutes} min no total` : durationMinutes >= 60 ? `${(durationMinutes / 60).toFixed(1).replace(".0", "")}h` : ""}
                </span>
              </div>
              <div className={styles.durationInputWrapper}>
                <input
                  id="service-duration"
                  name="duration"
                  aria-label={`Duração em ${durationUnit === "hora" ? "horas" : "minutos"}`}
                  type="number"
                  min={durationUnit === "hora" ? 0.1 : 5}
                  max={durationUnit === "hora" ? 24 : 1440}
                  step={durationUnit === "hora" ? 0.5 : 1}
                  required
                  value={durationInput}
                  onChange={(e) => {
                    const valStr = e.target.value;
                    setDurationInput(valStr);
                    const num = Number(valStr);
                    if (!isNaN(num) && num > 0) {
                      setDurationMinutes(durationUnit === "hora" ? Math.round(num * 60) : num);
                    }
                  }}
                  className={`${styles.input} ${styles.durationInputField}`}
                />
                <select
                  aria-label="Unidade de duração"
                  value={durationUnit}
                  onChange={(e) => {
                    const next = e.target.value as "min" | "hora";
                    if (next === "hora" && durationUnit === "min") {
                      const hrs = durationMinutes / 60;
                      setDurationInput(hrs % 1 === 0 ? hrs.toString() : hrs.toFixed(1));
                    } else if (next === "min" && durationUnit === "hora") {
                      setDurationInput(durationMinutes.toString());
                    }
                    setDurationUnit(next);
                  }}
                  className={styles.durationUnitSelect}
                >
                  <option value="min">min</option>
                  <option value="hora">hora(s)</option>
                </select>
              </div>
              <div className={styles.presetRow}>
                {[
                  { label: "15m", mins: 15 },
                  { label: "30m", mins: 30 },
                  { label: "45m", mins: 45 },
                  { label: "1h", mins: 60 },
                  { label: "1h30", mins: 90 },
                  { label: "2h", mins: 120 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`${styles.presetBtn} ${durationMinutes === preset.mins ? styles.presetBtnActive : ""}`}
                    onClick={() => {
                      setDurationMinutes(preset.mins);
                      if (durationUnit === "hora") {
                        const hrs = preset.mins / 60;
                        setDurationInput(hrs % 1 === 0 ? hrs.toString() : hrs.toFixed(1));
                      } else {
                        setDurationInput(preset.mins.toString());
                      }
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label htmlFor="service-buffer" className={styles.label}>
                  Intervalo após atendimento (min)
                </label>
              </div>
              <div className={styles.inputWrapper}>
                <input
                  id="service-buffer"
                  name="buffer"
                  aria-label="Intervalo após atendimento (min)"
                  type="number"
                  min={0}
                  max={180}
                  step={1}
                  defaultValue={service?.bufferMinutes ?? 0}
                  className={`${styles.input} ${styles.inputWithSuffix}`}
                />
                <span className={styles.suffix}>min</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Detalhes (Descrição e Imagem) */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <FileText size={13} />
            <span>Apresentação</span>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label htmlFor="service-description" className={styles.label}>
                Descrição
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className={styles.editCategoryTrigger}
                  style={{
                    height: 26,
                    padding: "0 10px",
                    fontSize: 11,
                    color: "var(--primary, #38bdf8)",
                    borderColor: "rgba(56, 189, 248, 0.35)",
                    background: "rgba(56, 189, 248, 0.08)",
                  }}
                  onClick={() => {
                    const nameInput = document.querySelector<HTMLInputElement>("#service-name");
                    const currentName = nameInput?.value || service?.name || "";
                    const categoryObj = extraCategories.find((c) => c.id === category) || categories.find((c) => c.id === category);
                    const suggested = getServiceDescription({ name: currentName, categoryName: categoryObj?.name });
                    setDescription(suggested);
                    notify("Sugestão de descrição inteligente aplicada!");
                  }}
                  title="Gerar sugestão inteligente baseada no nome e categoria do serviço"
                >
                  <Sparkles size={12} />
                  <span>Sugerir descrição</span>
                </button>
                <span className={styles.labelHint}>Opcional</span>
              </div>
            </div>
            <textarea
              id="service-description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.textarea}
              placeholder="Descreva o que está incluso no atendimento, benefícios e orientações para o cliente..."
            />
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label}>
                Foto do serviço
              </label>
              <span className={styles.labelHint}>Galeria do dispositivo</span>
            </div>

            <input type="hidden" name="image" value={imageUrl} />

            {!imageUrl ? (
              <div
                className={`${styles.uploadDropzone} ${isDragging ? styles.uploadDropzoneActive : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) await handleFile(file);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await handleFile(file);
                  }}
                />
                <div className={styles.uploadIconWrap}>
                  {uploadingImage ? (
                    <Loader2 size={22} className={styles.spin} />
                  ) : (
                    <ImagePlus size={22} />
                  )}
                </div>
                <div className={styles.uploadTextWrap}>
                  <strong className={styles.uploadTitle}>
                    {uploadingImage
                      ? "Processando foto..."
                      : "Escolher foto da galeria"}
                  </strong>
                  <span className={styles.uploadHint}>
                    Clique ou arraste uma imagem do seu dispositivo (PNG, JPG, WebP)
                  </span>
                </div>
              </div>
            ) : (
              <div className={styles.imagePreviewCard}>
                <NextImage
                  src={imageUrl}
                  alt="Prévia do serviço"
                  width={72}
                  height={72}
                  className={styles.imagePreviewLarge}
                  unoptimized
                />
                <div className={styles.imagePreviewMeta}>
                  <span className={styles.imageSuccessBadge}>
                    <Check size={14} /> Foto selecionada
                  </span>
                  <span className={styles.imageHintText}>
                    A foto será exibida no cartão de agendamento online.
                  </span>
                  <div className={styles.imageActions}>
                    <button
                      type="button"
                      className={styles.imageChangeBtn}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <RefreshCw size={12} /> Trocar foto
                    </button>
                    <button
                      type="button"
                      className={styles.imageRemoveBtn}
                      onClick={() => {
                        setImageUrl("");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <Trash2 size={12} /> Remover
                    </button>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await handleFile(file);
                  }}
                />
              </div>
            )}

            <div className={styles.urlToggleWrap}>
              <button
                type="button"
                className={styles.urlToggleBtn}
                onClick={() => setShowUrlInput(!showUrlInput)}
              >
                <Link2 size={12} />
                {showUrlInput ? "Ocultar link manual" : "Ou inserir por link (URL)"}
              </button>
              {showUrlInput && (
                <div className={styles.inputWrapper} style={{ marginTop: 8 }}>
                  <span className={styles.inputIcon}>
                    <ImageIcon size={16} />
                  </span>
                  <input
                    aria-label="Imagem (URL manual)"
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    placeholder="https://exemplo.com/foto-do-servico.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4. Profissionais que realizam */}
        <div className={styles.teamSection}>
          <div className={styles.teamTopRow}>
            <div className={styles.sectionTitle}>
              <Users size={13} />
              <span>Profissionais que realizam</span>
              {ids.length > 0 && (
                <span className={styles.labelHint}>
                  ({ids.length} selecionado{ids.length > 1 ? "s" : ""})
                </span>
              )}
            </div>
            {activeEmployees.length > 0 && (
              <button
                type="button"
                className={styles.teamActionBtn}
                onClick={() => {
                  if (ids.length === activeEmployees.length) {
                    setIds([]);
                  } else {
                    setIds(activeEmployees.map((e) => e.id));
                  }
                }}
              >
                {ids.length === activeEmployees.length
                  ? "Desmarcar todos"
                  : "Selecionar todos"}
              </button>
            )}
          </div>

          {activeEmployees.length > 0 ? (
            <div className={styles.teamGrid}>
              {activeEmployees.map((e) => {
                const isSelected = ids.includes(e.id);
                return (
                  <label
                    key={e.id}
                    htmlFor={`emp-${e.id}`}
                    className={`${styles.teamCard} ${isSelected ? styles.teamCardActive : ""}`}
                  >
                    <input
                      id={`emp-${e.id}`}
                      type="checkbox"
                      className={styles.srOnlyCheckbox}
                      checked={isSelected}
                      aria-label={e.name}
                      onChange={(event) =>
                        setIds(
                          event.target.checked
                            ? [...ids, e.id]
                            : ids.filter((id) => id !== e.id),
                        )
                      }
                    />
                    <span className={styles.teamAvatar} aria-hidden="true">
                      {getInitials(e.name)}
                    </span>
                    <div className={styles.teamInfo}>
                      <span className={styles.teamName}>{e.name}</span>
                    </div>
                    <span className={styles.teamCheckIcon} aria-hidden="true">
                      <Check size={11} strokeWidth={3} />
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className={styles.teamEmpty}>
              Cadastre sua equipe para disponibilizar este serviço no catálogo.
            </div>
          )}
        </div>

        {/* 5. Opções Avançadas (Modalidade, Pagamento e Cancelamento) */}
        <div className={styles.section}>
          <button
            type="button"
            className={`${styles.advancedToggle} ${showAdvanced ? styles.advancedToggleOpen : ""}`}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <SlidersHorizontal size={14} />
              <span>Opções avançadas (Modalidade, Pagamento & Políticas)</span>
            </span>
            <ChevronDown size={15} />
          </button>

          <div
            className={styles.advancedContent}
            style={{ display: showAdvanced ? "flex" : "none" }}
          >
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label htmlFor="service-mode" className={styles.label}>
                  Atendimento
                </label>
                <select
                  id="service-mode"
                  name="mode"
                  className={styles.select}
                  value={deliveryMode}
                  onChange={(e) => setDeliveryMode(e.target.value)}
                >
                  <option value="IN_PERSON">Presencial</option>
                  <option value="ONLINE">Online</option>
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="service-payment" className={styles.label}>
                  Pagamento
                </label>
                <select
                  id="service-payment"
                  name="payment"
                  className={styles.select}
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                >
                  <option value="PAY_LATER">No atendimento</option>
                  <option value="FULL_PAYMENT">
                    Antecipado (aguarda integração)
                  </option>
                  <option value="DEPOSIT">Sinal (aguarda integração)</option>
                </select>
              </div>
            </div>

            {paymentType === "DEPOSIT" && (
              <div className={styles.field}>
                <label htmlFor="service-deposit" className={styles.label}>
                  Valor do sinal (R$)
                </label>
                <div className={styles.inputWrapper}>
                  <span className={styles.prefix}>R$</span>
                  <input
                    id="service-deposit"
                    name="deposit"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={service?.depositAmount ?? 0}
                    placeholder="0,00"
                    className={`${styles.input} ${styles.inputWithPrefix}`}
                  />
                </div>
              </div>
            )}

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label htmlFor="service-policy" className={styles.label}>
                  Informações de cancelamento
                </label>
                <span className={styles.labelHint}>Opcional</span>
              </div>
              <textarea
                id="service-policy"
                name="policy"
                className={styles.textarea}
                placeholder="Ex.: Reagendamentos ou cancelamentos permitidos com até 24h de antecedência..."
                defaultValue={service?.cancellationPolicy ?? ""}
                maxLength={1000}
              />
            </div>
          </div>
        </div>

        {/* Rodapé / Ações */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onDone}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 size={16} className={styles.spin} />
                <span>Salvando…</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Salvar serviço</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
