"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Crop,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Move,
  Maximize2,
  Check,
  X,
  Sparkles,
  Sliders,
} from "lucide-react";
import styles from "./image-cropper-modal.module.css";

export type CropAspectRatio = "1:1" | "16:5" | "3:1" | "16:9" | "4:3";

export interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  aspectRatio?: CropAspectRatio;
  shape?: "rect" | "circle";
  title?: string;
  subtitle?: string;
  outputMaxDimension?: number;
  outputQuality?: number;
  allowRatioSwitch?: boolean;
  onCropComplete: (croppedDataUrl: string) => void;
}

export function ImageCropperModal({
  isOpen,
  onClose,
  imageSrc,
  aspectRatio: initialRatio = "1:1",
  shape = "rect",
  title = "Ajustar e Recortar Imagem",
  subtitle = "Arraste para reposicionar e ajuste o zoom para enquadrar",
  outputMaxDimension = 1200,
  outputQuality = 0.90,
  allowRatioSwitch = true,
  onCropComplete,
}: ImageCropperModalProps) {
  const [aspectRatio, setAspectRatio] = useState<CropAspectRatio>(initialRatio);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [applying, setApplying] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Synchronize ratio if prop changes
  useEffect(() => {
    setAspectRatio(initialRatio);
  }, [initialRatio]);

  // Reset transform when imageSrc changes or opens
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
    }
  }, [isOpen, imageSrc]);

  // Load natural image dimensions
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Calculate crop box dimensions based on container and aspect ratio
  const getCropBoxDimensions = useCallback(() => {
    const maxWidth = 480;
    const maxHeight = 250;

    let ratioValue = 1;
    if (aspectRatio === "16:5") ratioValue = 16 / 5;
    else if (aspectRatio === "3:1") ratioValue = 3 / 1;
    else if (aspectRatio === "16:9") ratioValue = 16 / 9;
    else if (aspectRatio === "4:3") ratioValue = 4 / 3;
    else if (aspectRatio === "1:1") ratioValue = 1;

    let width = maxWidth;
    let height = width / ratioValue;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * ratioValue;
    }

    return { width: Math.round(width), height: Math.round(height) };
  }, [aspectRatio]);

  const cropBox = getCropBoxDimensions();

  // Compute base rendered image scale to cover crop box at 1x
  const getBaseScale = useCallback(() => {
    if (!imageSize) return 1;
    const isRotated90 = rotation % 180 !== 0;
    const effectiveImgWidth = isRotated90 ? imageSize.height : imageSize.width;
    const effectiveImgHeight = isRotated90 ? imageSize.width : imageSize.height;

    const scaleX = cropBox.width / effectiveImgWidth;
    const scaleY = cropBox.height / effectiveImgHeight;
    return Math.max(scaleX, scaleY);
  }, [imageSize, cropBox, rotation]);

  const baseScale = getBaseScale();

  // Mouse / Touch Drag Handlers
  const handlePointerDown = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    setOffset({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.002;
    setZoom((prev) => Math.min(3, Math.max(1, +(prev + delta).toFixed(2))));
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  const handleRotateCw = () => {
    setRotation((r) => (r + 90) % 360);
    setOffset({ x: 0, y: 0 });
  };

  const handleRotateCcw = () => {
    setRotation((r) => (r - 90 + 360) % 360);
    setOffset({ x: 0, y: 0 });
  };

  // Export cropped image via Canvas
  const handleApplyCrop = async () => {
    if (!imageSize || !imageSrc) return;
    setApplying(true);

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Falha ao carregar imagem para corte"));
        img.src = imageSrc;
      });

      let targetWidth = outputMaxDimension;
      let ratioValue = 1;
      if (aspectRatio === "16:5") ratioValue = 16 / 5;
      else if (aspectRatio === "3:1") ratioValue = 3 / 1;
      else if (aspectRatio === "16:9") ratioValue = 16 / 9;
      else if (aspectRatio === "4:3") ratioValue = 4 / 3;
      else if (aspectRatio === "1:1") ratioValue = 1;

      let targetHeight = Math.round(targetWidth / ratioValue);
      if (targetHeight > outputMaxDimension) {
        targetHeight = outputMaxDimension;
        targetWidth = Math.round(targetHeight * ratioValue);
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context não disponível");

      // Optional circle clipping mask if shape is circle
      if (shape === "circle" && aspectRatio === "1:1") {
        ctx.save();
        ctx.beginPath();
        ctx.arc(targetWidth / 2, targetHeight / 2, targetWidth / 2, 0, Math.PI * 2);
        ctx.clip();
      }

      const ratioMultiplier = targetWidth / cropBox.width;

      ctx.save();
      // Translate to canvas center
      ctx.translate(targetWidth / 2, targetHeight / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);
      ctx.translate(offset.x * ratioMultiplier, offset.y * ratioMultiplier);

      const renderW = imageSize.width * baseScale * ratioMultiplier;
      const renderH = imageSize.height * baseScale * ratioMultiplier;

      ctx.drawImage(img, -renderW / 2, -renderH / 2, renderW, renderH);
      ctx.restore();

      if (shape === "circle" && aspectRatio === "1:1") {
        ctx.restore();
      }

      const dataUrl = canvas.toDataURL("image/webp", outputQuality);
      onCropComplete(dataUrl);
      onClose();
    } catch (err: any) {
      console.error("Erro ao recortar imagem:", err);
      alert("Erro ao processar o corte da imagem: " + err.message);
    } finally {
      setApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitle}>
            <Crop size={18} color="#dcff4c" />
            <div>
              <h3>{title}</h3>
              <div className={styles.headerSubtitle}>{subtitle}</div>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Crop Area */}
        <div className={styles.cropWorkspace}>
          <div
            ref={viewportRef}
            className={styles.cropViewportContainer}
            onWheel={handleWheel}
          >
            <div
              className={`${styles.cropBox} ${shape === "circle" && aspectRatio === "1:1" ? styles.cropBoxCircle : ""}`}
              style={{
                width: `${cropBox.width}px`,
                height: `${cropBox.height}px`,
              }}
              onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
              onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                if (touch) handlePointerDown(touch.clientX, touch.clientY);
              }}
              onTouchMove={(e) => {
                const touch = e.touches[0];
                if (touch) handlePointerMove(touch.clientX, touch.clientY);
              }}
              onTouchEnd={handlePointerUp}
            >
              {imageSize && (
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Prévia de corte"
                  className={styles.cropImage}
                  style={{
                    width: `${imageSize.width * baseScale}px`,
                    height: `${imageSize.height * baseScale}px`,
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) rotate(${rotation}deg) scale(${zoom})`,
                  }}
                  draggable={false}
                />
              )}

              {/* Grid overlay for rule of thirds */}
              <div className={styles.gridOverlay}>
                <div /><div /><div />
                <div /><div /><div />
                <div /><div /><div />
              </div>

              <div className={styles.dragHint}>
                <Move size={12} />
                Arraste para enquadrar
              </div>
            </div>
          </div>

          {/* Controls Section */}
          <div className={styles.controlsSection}>
            {/* Zoom Slider */}
            <div className={styles.sliderRow}>
              <span className={styles.zoomLabel}>
                <ZoomIn size={14} /> Zoom
              </span>
              <button
                type="button"
                className={styles.toolBtn}
                style={{ padding: "4px 8px" }}
                onClick={() => setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2)))}
                title="Diminuir Zoom"
              >
                <ZoomOut size={13} />
              </button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className={styles.zoomSlider}
              />
              <button
                type="button"
                className={styles.toolBtn}
                style={{ padding: "4px 8px" }}
                onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
                title="Aumentar Zoom"
              >
                <ZoomIn size={13} />
              </button>
              <span className={styles.zoomPercent}>
                {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Quick Actions & Proportions */}
            <div className={styles.buttonRow}>
              <div className={styles.btnGroup}>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={handleRotateCcw}
                  title="Girar 90° à esquerda"
                >
                  <RotateCcw size={13} /> -90°
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={handleRotateCw}
                  title="Girar 90° à direita"
                >
                  <RotateCw size={13} /> +90°
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={handleReset}
                  title="Redefinir zoom e posição"
                >
                  Centralizar
                </button>
              </div>

              {allowRatioSwitch && (
                <div className={styles.btnGroup}>
                  {initialRatio.includes(":") || initialRatio === "3:1" ? (
                    <>
                      <button
                        type="button"
                        className={`${styles.toolBtn} ${aspectRatio === "16:5" ? styles.toolBtnActive : ""}`}
                        onClick={() => { setAspectRatio("16:5"); handleReset(); }}
                      >
                        16:5 (Capa)
                      </button>
                      <button
                        type="button"
                        className={`${styles.toolBtn} ${aspectRatio === "3:1" ? styles.toolBtnActive : ""}`}
                        onClick={() => { setAspectRatio("3:1"); handleReset(); }}
                      >
                        3:1
                      </button>
                      <button
                        type="button"
                        className={`${styles.toolBtn} ${aspectRatio === "16:9" ? styles.toolBtnActive : ""}`}
                        onClick={() => { setAspectRatio("16:9"); handleReset(); }}
                      >
                        16:9
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={`${styles.toolBtn} ${aspectRatio === "1:1" ? styles.toolBtnActive : ""}`}
                        onClick={() => { setAspectRatio("1:1"); handleReset(); }}
                      >
                        1:1 (Quadrado)
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <span style={{ fontSize: 11, color: "#71717a" }}>
            Formatos suportados: PNG, JPG, WEBP
          </span>
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.btnCancel}
              onClick={onClose}
              disabled={applying}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={styles.btnApply}
              onClick={handleApplyCrop}
              disabled={applying}
            >
              <Check size={15} />
              {applying ? "Processando..." : "Aplicar Corte & Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
