import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: pathSegments } = await params;
  if (!pathSegments || pathSegments.length === 0) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Prevent path traversal attacks
  const safePath = pathSegments.join("/");
  if (safePath.includes("..") || path.isAbsolute(safePath)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  const filePath = path.join(uploadsRoot, safePath);

  // Ensure filePath stays within uploadsRoot
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(uploadsRoot))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const fileBuffer = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
