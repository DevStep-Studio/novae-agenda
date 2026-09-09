import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "branding");

export async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

/**
 * Validates and converts a dataURL or image buffer to a stored file in /uploads/branding/
 * Returns the public URL path: /uploads/branding/[uuid].[ext]
 */
export async function saveBrandingImage(
  imageInput: string,
  previousUrl?: string | null
): Promise<string> {
  // If it's already an existing URL path or external URL, keep it
  if (!imageInput.startsWith("data:image/")) {
    return imageInput;
  }

  await ensureUploadsDir();

  // Parse data URL: data:image/png;base64,iVBORw...
  const match = imageInput.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Formato de imagem base64 inválido.");
  }

  let mimeSubtype = match[1].toLowerCase();
  if (mimeSubtype === "jpeg") mimeSubtype = "jpg";
  if (mimeSubtype === "svg+xml") mimeSubtype = "svg";

  const allowedExts = ["png", "jpg", "webp", "svg"];
  if (!allowedExts.includes(mimeSubtype)) {
    throw new Error("Formato de imagem não suportado. Use PNG, JPG, WebP ou SVG.");
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
  const filePath = path.join(UPLOADS_DIR, filename);

  await fs.writeFile(filePath, buffer);

  // Clean up previous file if it was in the local uploads directory
  if (previousUrl && previousUrl.startsWith("/uploads/branding/")) {
    try {
      const prevFilename = path.basename(previousUrl);
      const prevFilePath = path.join(UPLOADS_DIR, prevFilename);
      await fs.unlink(prevFilePath);
    } catch {
      // Ignore if previous file was already deleted
    }
  }

  return `/uploads/branding/${filename}`;
}

export async function deleteBrandingImage(fileUrl: string) {
  if (fileUrl.startsWith("/uploads/branding/")) {
    try {
      const filename = path.basename(fileUrl);
      const filePath = path.join(UPLOADS_DIR, filename);
      await fs.unlink(filePath);
    } catch {
      // Ignore
    }
  }
}
