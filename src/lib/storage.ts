import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
type UploadFolder = "branding" | "professionals";

async function ensureUploadsDir(folder: UploadFolder) {
  await fs.mkdir(path.join(UPLOADS_ROOT, folder), { recursive: true });
}

/** Persists validated image data in a public, folder-scoped upload directory. */
export async function saveBrandingImage(
  imageInput: string,
  previousUrl?: string | null
): Promise<string> {
  return saveUploadedImage(imageInput, { folder: "branding", previousUrl, allowSvg: true });
}

export async function saveProfessionalImage(
  imageInput: string,
  previousUrl?: string | null,
): Promise<string> {
  return saveUploadedImage(imageInput, { folder: "professionals", previousUrl });
}

async function saveUploadedImage(
  imageInput: string,
  {
    folder,
    previousUrl,
    allowSvg = false,
  }: { folder: UploadFolder; previousUrl?: string | null; allowSvg?: boolean },
): Promise<string> {
  // If it's already an existing URL path or external URL, keep it
  if (!imageInput.startsWith("data:image/")) {
    return imageInput;
  }

  await ensureUploadsDir(folder);

  // Parse data URL: data:image/png;base64,iVBORw...
  const match = imageInput.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Formato de imagem base64 inválido.");
  }

  let mimeSubtype = match[1].toLowerCase();
  if (mimeSubtype === "jpeg") mimeSubtype = "jpg";
  if (mimeSubtype === "svg+xml") mimeSubtype = "svg";

  const allowedExts = allowSvg ? ["png", "jpg", "webp", "svg"] : ["png", "jpg", "webp"];
  if (!allowedExts.includes(mimeSubtype)) {
    throw new Error(
      `Formato de imagem não suportado. Use PNG, JPG, WebP${allowSvg ? " ou SVG" : ""}.`,
    );
  }

  const buffer = Buffer.from(match[2], "base64");

  // Max 5MB
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error("A imagem não pode ultrapassar 5MB.");
  }

  // Basic Magic Byte Validation for security
  if (mimeSubtype === "png") {
    if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) {
      throw new Error("Arquivo PNG corrompido ou inválido.");
    }
  } else if (mimeSubtype === "jpg") {
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      throw new Error("Arquivo JPG corrompido ou inválido.");
    }
  } else if (mimeSubtype === "webp") {
    const riff = buffer.subarray(0, 4).toString("ascii");
    const webp = buffer.subarray(8, 12).toString("ascii");
    if (riff !== "RIFF" || webp !== "WEBP") {
      throw new Error("Arquivo WebP corrompido ou inválido.");
    }
  }

  // Generate safe non-executable filename
  const filename = `${crypto.randomUUID()}.${mimeSubtype}`;
  const uploadDir = path.join(UPLOADS_ROOT, folder);
  const filePath = path.join(uploadDir, filename);

  await fs.writeFile(filePath, buffer);

  // Clean up previous file if it was in the local uploads directory
  if (previousUrl && previousUrl.startsWith(`/uploads/${folder}/`)) {
    try {
      const prevFilename = path.basename(previousUrl);
      const prevFilePath = path.join(uploadDir, prevFilename);
      await fs.unlink(prevFilePath);
    } catch {
      // Ignore if previous file was already deleted
    }
  }

  return `/uploads/${folder}/${filename}`;
}

export async function deleteBrandingImage(fileUrl: string) {
  return deleteUploadedImage(fileUrl, "branding");
}

export async function deleteProfessionalImage(fileUrl: string) {
  return deleteUploadedImage(fileUrl, "professionals");
}

async function deleteUploadedImage(fileUrl: string, folder: UploadFolder) {
  if (fileUrl.startsWith(`/uploads/${folder}/`)) {
    try {
      const filename = path.basename(fileUrl);
      const filePath = path.join(UPLOADS_ROOT, folder, filename);
      await fs.unlink(filePath);
    } catch {
      // Ignore
    }
  }
}
