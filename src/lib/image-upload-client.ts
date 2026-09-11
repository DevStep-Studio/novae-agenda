const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

type PrepareImageOptions = {
  allowSvg?: boolean;
  maxBytes?: number;
  maxDimension?: number;
  square?: boolean;
  quality?: number;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler esta imagem."));
    reader.readAsDataURL(file);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler esta imagem."));
    };
    image.src = url;
  });
}

export async function prepareImageUpload(
  file: File,
  {
    allowSvg = false,
    maxBytes = 5 * 1024 * 1024,
    maxDimension = 1200,
    square = false,
    quality = 0.88,
  }: PrepareImageOptions = {},
): Promise<string> {
  if (allowSvg && file.type === "image/svg+xml") {
    if (file.size > maxBytes) {
      throw new Error(`A imagem deve ter no máximo ${Math.round(maxBytes / 1024 / 1024)}MB.`);
    }
    return readFileAsDataUrl(file);
  }
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number])) {
    throw new Error(`Use uma imagem JPG, JPEG, PNG${allowSvg ? ", WEBP ou SVG" : " ou WEBP"}.`);
  }
  if (file.size > maxBytes) {
    throw new Error(`A imagem deve ter no máximo ${Math.round(maxBytes / 1024 / 1024)}MB.`);
  }

  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error("A imagem selecionada é inválida.");
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Seu navegador não conseguiu preparar a imagem.");

  if (square) {
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - sourceSize) / 2;
    const sourceY = (image.naturalHeight - sourceSize) / 2;
    const targetSize = Math.min(maxDimension, sourceSize);
    canvas.width = targetSize;
    canvas.height = targetSize;
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      targetSize,
      targetSize,
    );
  } else {
    const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  }

  return canvas.toDataURL("image/webp", quality);
}
