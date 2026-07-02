"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const STORAGE_BUCKETS = {
  companyAssets: "company-assets",
  voucherAttachments: "voucher-attachments",
} as const;

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

function throwIfError(error: { message?: string } | null): void {
  if (error) {
    throw new Error(error.message || "فشل رفع الملف.");
  }
}

function getLogoExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["png", "jpg", "jpeg", "webp", "svg"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  switch (file.type) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    default:
      return "png";
  }
}

export function validateCompanyLogoFile(file: File): void {
  if (!LOGO_ALLOWED_TYPES.has(file.type)) {
    throw new Error("نوع الملف غير مدعوم. استخدم PNG أو JPG أو WebP أو SVG.");
  }
  if (file.size > LOGO_MAX_BYTES) {
    throw new Error("حجم الشعار يجب ألا يتجاوز 2 ميغابايت.");
  }
}

export function isCompanyStorageUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const { url: supabaseUrl } = getSupabaseEnv();
    const host = new URL(supabaseUrl).host;
    const parsed = new URL(url);
    return (
      parsed.host === host &&
      parsed.pathname.includes(`/storage/v1/object/public/${STORAGE_BUCKETS.companyAssets}/`)
    );
  } catch {
    return false;
  }
}

export function getStoragePathFromPublicUrl(
  bucket: string,
  publicUrl: string,
): string | null {
  try {
    const { url: supabaseUrl } = getSupabaseEnv();
    const prefix = `${supabaseUrl}/storage/v1/object/public/${bucket}/`;
    const withoutQuery = publicUrl.split("?")[0] ?? publicUrl;
    if (!withoutQuery.startsWith(prefix)) return null;
    return decodeURIComponent(withoutQuery.slice(prefix.length));
  } catch {
    return null;
  }
}

export async function uploadCompanyLogo(file: File): Promise<string> {
  validateCompanyLogoFile(file);

  const supabase = getSupabaseClient();
  const extension = getLogoExtension(file);
  const path = `company/logo.${extension}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.companyAssets)
    .upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
      cacheControl: "3600",
    });
  throwIfError(error);

  const { data } = supabase.storage
    .from(STORAGE_BUCKETS.companyAssets)
    .getPublicUrl(path);

  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function deleteCompanyLogoFromStorage(
  logoUrl: string | null | undefined,
): Promise<void> {
  if (!isCompanyStorageUrl(logoUrl)) return;

  const path = getStoragePathFromPublicUrl(
    STORAGE_BUCKETS.companyAssets,
    logoUrl ?? "",
  );
  if (!path) return;

  const supabase = getSupabaseClient();
  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.companyAssets)
    .remove([path]);
  throwIfError(error);
}

const VOUCHER_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const VOUCHER_ATTACHMENT_ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function sanitizeFileName(name: string): string {
  const base = name.trim().replace(/[/\\?%*:|"<>]/g, "_");
  return base.slice(0, 180) || "attachment";
}

export function validateVoucherAttachmentFile(file: File): void {
  if (!VOUCHER_ATTACHMENT_ALLOWED_TYPES.has(file.type)) {
    throw new Error(
      "نوع الملف غير مدعوم. استخدم PDF أو صور أو Word أو Excel.",
    );
  }
  if (file.size > VOUCHER_ATTACHMENT_MAX_BYTES) {
    throw new Error("حجم الملف يجب ألا يتجاوز 10 ميغابايت.");
  }
}

export function buildVoucherAttachmentPath(
  voucherId: string,
  fileName: string,
): string {
  const safeName = sanitizeFileName(fileName);
  const unique = crypto.randomUUID();
  return `vouchers/${voucherId}/${unique}-${safeName}`;
}

export async function uploadVoucherAttachmentFile(
  voucherId: string,
  file: File,
): Promise<{ storagePath: string }> {
  validateVoucherAttachmentFile(file);

  const supabase = getSupabaseClient();
  const storagePath = buildVoucherAttachmentPath(voucherId, file.name);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.voucherAttachments)
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type || undefined,
      cacheControl: "3600",
    });
  throwIfError(error);

  return { storagePath };
}

export async function deleteVoucherAttachmentFile(
  storagePath: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.voucherAttachments)
    .remove([storagePath]);
  throwIfError(error);
}

export async function createVoucherAttachmentSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.voucherAttachments)
    .createSignedUrl(storagePath, expiresInSeconds);
  throwIfError(error);
  if (!data?.signedUrl) {
    throw new Error("تعذّر إنشاء رابط التحميل.");
  }
  return data.signedUrl;
}
