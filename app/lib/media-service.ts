import { createHash, randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { assertSafeMediaStorage } from "@/app/lib/deploy-safety";

type UploadResult = {
  url: string;
  publicId?: string;
  provider: "LOCAL" | "CLOUDINARY";
};

const DEFAULT_MAX_UPLOAD_MB = 12;

export function validateMediaFile(file: File) {
  const maxMb = Math.max(1, Number(process.env.MAX_UPLOAD_MB ?? DEFAULT_MAX_UPLOAD_MB));
  const maxBytes = maxMb * 1024 * 1024;
  if (!file.type.startsWith("image/")) return `Chỉ hỗ trợ upload ảnh.`;
  if (file.size > maxBytes) return `Ảnh quá nặng. Vui lòng chọn ảnh dưới ${maxMb} MB.`;
  return null;
}

function extensionFromName(name: string) {
  const ext = path.extname(name).toLowerCase();
  return ext || ".jpg";
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

async function uploadLocal(file: File): Promise<UploadResult> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${randomUUID()}${extensionFromName(file.name)}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), bytes);
  return { url: `/uploads/${filename}`, provider: "LOCAL" };
}

async function uploadCloudinary(file: File): Promise<UploadResult> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    if (isProduction()) throw new Error("MEDIA_STORAGE_NOT_CONFIGURED");
    return uploadLocal(file);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = process.env.CLOUDINARY_FOLDER ?? "studio-finance";
  const signatureBase = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = createHash("sha1").update(signatureBase).digest("hex");

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    if (isProduction()) throw new Error("CLOUDINARY_UPLOAD_FAILED");
    console.warn("Cloudinary upload failed, falling back to local storage in development.");
    return uploadLocal(file);
  }
  const data = (await response.json()) as { secure_url: string; public_id: string };
  return { url: data.secure_url, publicId: data.public_id, provider: "CLOUDINARY" };
}

export async function uploadMediaFile(file: File) {
  const error = validateMediaFile(file);
  if (error) throw new Error(error);
  assertSafeMediaStorage();
  if (process.env.CLOUDINARY_CLOUD_NAME) return uploadCloudinary(file);
  return uploadLocal(file);
}
