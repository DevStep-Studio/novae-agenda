"use client";
import { useState, useRef, type FormEvent } from "react";
import NextImage from "next/image";
import { api } from "@/lib/api-client";
import { useStore } from "@/store/store";
import type { ServiceDTO } from "@/shared/types";
import { ErrorMessage } from "./primitives";
import styles from "./service-editor.module.css";
import {
  Sparkles,
  Users,
  FolderPlus,
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
  const { employees, categories, reloadServices, reloadEmployees, notify } =
    useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState(service?.categoryId ?? "");
  const [extraCategories, setExtraCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [newCategory, setNewCategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [durationValue, setDurationValue] = useState<number>(
    service?.durationMinutes ?? 60,
  );
  const [imageUrl, setImageUrl] = useState(service?.imageUrl ?? "");
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
      notify(`Categoria "${c.name}" criada com sucesso.`);
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
      await api(service ? `/api/services/${service.id}` : "/api/services", {
        method: service ? "PATCH" : "POST",
        body: JSON.stringify({
          name: f.get("name"),
          price: Number(f.get("price")),
          durationMinutes: Number(f.get("duration")),
          description: f.get("description"),
          categoryId: category || null,
          employeeIds: ids,
          bufferMinutes: Number(f.get("buffer")),
          imageUrl: String(f.get("image") || imageUrl || "").trim() || null,
          deliveryMode: f.get("mode") || deliveryMode,
          paymentType: f.get("payment") || paymentType,
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
              <button
                type="button"
                className={styles.addCategoryTrigger}
                onClick={() => setShowNewCategory(!showNewCategory)}
              >
                <FolderPlus size={13} />
                <span>{showNewCategory ? "Fechar" : "+ Nova categoria"}</span>
              </button>
            </div>
            <div className={styles.categoryBar}>
              <div className={styles.categorySelectWrapper}>
                <select
                  id="service-category"
                  className={styles.select}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Outros (Geral)</option>
                  {[
                    ...categories,
                    ...extraCategories.filter(
                      (c) => !categories.some((x) => x.id === c.id),
                    ),
                  ].map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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

          <div className={styles.grid3}>
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
                  required
                  defaultValue={service?.price}
                  placeholder="0,00"
                  className={`${styles.input} ${styles.inputWithPrefix}`}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="service-duration" className={styles.label}>
                Duração em minutos
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="service-duration"
                  name="duration"
                  aria-label="Duração em minutos"
                  type="number"
                  min={5}
                  max={1440}
                  step={1}
                  required
                  value={durationValue}
                  onChange={(e) => setDurationValue(Number(e.target.value))}
                  className={`${styles.input} ${styles.inputWithSuffix}`}
                />
                <span className={styles.suffix}>min</span>
              </div>
              <div className={styles.presetRow}>
                {[30, 45, 60, 90].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`${styles.presetBtn} ${durationValue === preset ? styles.presetBtnActive : ""}`}
                    onClick={() => setDurationValue(preset)}
                  >
                    {preset}m
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
              <span className={styles.labelHint}>Opcional</span>
            </div>
            <textarea
              id="service-description"
              name="description"
              className={styles.textarea}
              placeholder="Descreva o que está incluso no atendimento, benefícios e orientações para o cliente..."
              defaultValue={service?.description ?? ""}
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
