"use client";

import { useMemo } from "react";
import { Modal } from "@/components/modal";
import type { CostCenterFormValues } from "@/modules/cost-centers/services/cost-center-api";
import { previewCostCenterCode } from "@/modules/cost-centers/utils/generate-cost-center-code";
import type { CostCenter } from "@/modules/vouchers/types";

interface CostCenterFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  center: CostCenter | null;
  allCenters: CostCenter[];
  isSaving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: CostCenterFormValues) => Promise<void>;
}

export function CostCenterFormModal({
  open,
  mode,
  center,
  allCenters,
  isSaving,
  error,
  onClose,
  onSubmit,
}: CostCenterFormModalProps) {
  const title = mode === "create" ? "إضافة مركز كلفة" : "تعديل مركز كلفة";
  const description =
    mode === "create"
      ? "يُولَّد كود النظام تلقائياً — الكود الفرعي اختياري للمستخدم."
      : center
        ? `${center.code} — ${center.name_ar}`
        : undefined;

  return (
    <Modal open={open} title={title} description={description} onClose={onClose}>
      <CostCenterForm
        key={center?.id ?? "new"}
        mode={mode}
        initial={center}
        allCenters={allCenters}
        isSaving={isSaving}
        error={error}
        onSubmit={onSubmit}
        onCancel={onClose}
      />
    </Modal>
  );
}

function CostCenterForm({
  mode,
  initial,
  allCenters,
  isSaving,
  error,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  initial: CostCenter | null;
  allCenters: CostCenter[];
  isSaving: boolean;
  error: string;
  onSubmit: (values: CostCenterFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const systemCode = useMemo(() => {
    if (mode === "edit") return initial?.code ?? "—";
    return previewCostCenterCode(allCenters);
  }, [mode, allCenters, initial?.code]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onSubmit({
      sub_code: String(form.get("sub_code") ?? ""),
      name_ar: String(form.get("name_ar") ?? ""),
      name_en: String(form.get("name_en") ?? ""),
      is_active: form.get("is_active") === "on",
    });
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-4">
      <div className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">كود النظام (تلقائي — للربط)</span>
        <p
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700"
          dir="ltr"
        >
          {systemCode}
        </p>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">كود فرعي (اختياري — للمستخدم)</span>
        <input
          name="sub_code"
          defaultValue={initial?.sub_code ?? ""}
          disabled={isSaving}
          maxLength={30}
          placeholder="مرجع داخلي — لا يُستخدم في الربط"
          className="rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
          dir="ltr"
        />
        <span className="text-xs text-slate-500">
          حقل مرجعي للمستخدم فقط، منفصل عن كود مركز الكلفة في النظام.
        </span>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">الاسم (عربي) *</span>
        <input
          name="name_ar"
          defaultValue={initial?.name_ar ?? ""}
          required
          disabled={isSaving}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">الاسم (إنجليزي)</span>
        <input
          name="name_en"
          defaultValue={initial?.name_en ?? ""}
          disabled={isSaving}
          className="rounded-md border border-slate-300 px-3 py-2"
          dir="ltr"
        />
      </label>

      {mode === "edit" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            name="is_active"
            type="checkbox"
            defaultChecked={initial?.is_active ?? true}
            disabled={isSaving}
          />
          <span className="font-medium text-slate-700">نشط</span>
        </label>
      )}

      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSaving ? "جاري الحفظ..." : mode === "create" ? "إضافة" : "حفظ التعديل"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 disabled:opacity-60"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}
