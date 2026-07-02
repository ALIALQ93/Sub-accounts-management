"use client";

import { useEffect, useRef, useState } from "react";
import { voucherAttachmentApi } from "@/modules/vouchers/services/voucher-attachment-api";
import type { VoucherAttachment } from "@/modules/vouchers/types";
import {
  formatFileSize,
  getFileTypeLabel,
} from "@/modules/vouchers/utils/file-utils";

interface VoucherAttachmentsPanelProps {
  voucherId: string;
  canManage: boolean;
  readOnly?: boolean;
}

export function VoucherAttachmentsPanel({
  voucherId,
  canManage,
  readOnly = false,
}: VoucherAttachmentsPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<VoucherAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canUpload = canManage && !readOnly;

  useEffect(() => {
    if (!voucherId) {
      setAttachments([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError("");

    void voucherAttachmentApi
      .listByVoucherId(voucherId)
      .then((items) => {
        if (!cancelled) setAttachments(items);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل المرفقات.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [voucherId]);

  const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !voucherId || !canUpload) return;

    setIsUploading(true);
    setError("");
    setSuccess("");
    try {
      const attachment = await voucherAttachmentApi.upload(voucherId, file);
      setAttachments((current) => [attachment, ...current]);
      setSuccess("تم رفع المرفق.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل رفع المرفق.");
    } finally {
      setIsUploading(false);
    }
  };

  const onDownload = async (attachment: VoucherAttachment) => {
    setBusyId(attachment.id);
    setError("");
    try {
      const url = await voucherAttachmentApi.getDownloadUrl(attachment);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل المرفق.");
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (attachment: VoucherAttachment) => {
    if (!canUpload) return;
    if (!window.confirm(`حذف المرفق «${attachment.file_name}»؟`)) return;

    setBusyId(attachment.id);
    setError("");
    setSuccess("");
    try {
      await voucherAttachmentApi.remove(attachment);
      setAttachments((current) =>
        current.filter((item) => item.id !== attachment.id),
      );
      setSuccess("تم حذف المرفق.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حذف المرفق.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">مرفقات السند</h2>
          <p className="text-xs text-slate-500">
            فواتير، إيصالات، عقود — PDF أو صور أو Word/Excel حتى 10 MB.
          </p>
        </div>

        {canUpload && voucherId && (
          <button
            type="button"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-60"
          >
            {isUploading ? "جاري الرفع..." : "إرفاق ملف"}
          </button>
        )}
      </div>

      {!voucherId && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          احفظ السند أولاً ثم أرفق المستندات.
        </p>
      )}

      {voucherId && isLoading && (
        <p className="text-sm text-slate-600">جاري تحميل المرفقات...</p>
      )}

      {voucherId && !isLoading && attachments.length === 0 && (
        <p className="text-sm text-slate-500">لا توجد مرفقات بعد.</p>
      )}

      {attachments.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">
                  {attachment.file_name}
                </p>
                <p className="text-xs text-slate-500">
                  {getFileTypeLabel(attachment.mime_type)} ·{" "}
                  {formatFileSize(attachment.file_size)} ·{" "}
                  {new Date(attachment.created_at).toLocaleString("ar-IQ")}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={busyId === attachment.id}
                  onClick={() => void onDownload(attachment)}
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs disabled:opacity-60"
                >
                  {busyId === attachment.id ? "..." : "تحميل"}
                </button>
                {canUpload && (
                  <button
                    type="button"
                    disabled={busyId === attachment.id}
                    onClick={() => void onDelete(attachment)}
                    className="rounded-md border border-rose-200 px-2.5 py-1 text-xs text-rose-700 disabled:opacity-60"
                  >
                    حذف
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {success}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,application/pdf,image/*"
        disabled={!canUpload || isUploading}
        onChange={(event) => void onFileSelected(event)}
      />
    </section>
  );
}
