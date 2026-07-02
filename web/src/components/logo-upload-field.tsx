"use client";

import { useRef, useState } from "react";
import { CompanyLogo } from "@/components/company-logo";
import {
  deleteCompanyLogoFromStorage,
  uploadCompanyLogo,
} from "@/lib/supabase/storage";

interface LogoUploadFieldProps {
  companyName: string;
  logoUrl: string | null;
  disabled?: boolean;
  onLogoChange: (logoUrl: string | null) => Promise<void> | void;
}

export function LogoUploadField({
  companyName,
  logoUrl,
  disabled = false,
  onLogoChange,
}: LogoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || disabled) return;

    setIsUploading(true);
    setError("");
    try {
      const nextUrl = await uploadCompanyLogo(file);
      await onLogoChange(nextUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل رفع الشعار.");
    } finally {
      setIsUploading(false);
    }
  };

  const onRemove = async () => {
    if (disabled || !logoUrl) return;

    setIsUploading(true);
    setError("");
    try {
      await deleteCompanyLogoFromStorage(logoUrl);
      await onLogoChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حذف الشعار.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="grid gap-2 text-sm">
      <span className="font-medium text-slate-700">شعار الشركة</span>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <CompanyLogo
          companyName={companyName}
          logoUrl={logoUrl}
          size="md"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || isUploading}
              onClick={() => inputRef.current?.click()}
              className="rounded-md bg-blue-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              {isUploading ? "جاري الرفع..." : logoUrl ? "استبدال الشعار" : "رفع شعار"}
            </button>

            {logoUrl && (
              <button
                type="button"
                disabled={disabled || isUploading}
                onClick={() => void onRemove()}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-60"
              >
                إزالة
              </button>
            )}
          </div>

          <p className="text-xs text-slate-500">
            PNG أو JPG أو WebP أو SVG — حتى 2 ميغابايت. يظهر في تسجيل الدخول والشريط
            الجانبي.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          disabled={disabled || isUploading}
          onChange={(event) => void onFileSelected(event)}
        />
      </div>

      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
