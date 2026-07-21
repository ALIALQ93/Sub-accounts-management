"use client";

import type {
  UnitCatalogFormValues,
  UnitCatalogItem,
} from "@/modules/materials/types";

interface UnitFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  initialValues?: UnitCatalogItem | null;
  isSaving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: UnitCatalogFormValues) => void;
}

const EMPTY_VALUES: UnitCatalogFormValues = {
  unit_code: "",
  name_ar: "",
  name_en: "",
  is_active: true,
};

export function UnitFormModal({
  open,
  mode,
  initialValues,
  isSaving,
  error,
  onClose,
  onSubmit,
}: UnitFormModalProps) {
  if (!open) return null;

  const defaults: UnitCatalogFormValues = initialValues
    ? {
        unit_code: initialValues.unit_code,
        name_ar: initialValues.name_ar,
        name_en: initialValues.name_en ?? "",
        is_active: initialValues.is_active,
      }
    : EMPTY_VALUES;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          onSubmit({
            unit_code: String(formData.get("unit_code") ?? ""),
            name_ar: String(formData.get("name_ar") ?? ""),
            name_en: String(formData.get("name_en") ?? ""),
            is_active: formData.get("is_active") === "on",
          });
        }}
      >
        <h2 className="text-lg font-bold text-slate-900">
          {mode === "create" ? "وحدة جديدة" : "تعديل وحدة"}
        </h2>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">رمز الوحدة *</span>
            <input
              name="unit_code"
              defaultValue={defaults.unit_code}
              disabled={isSaving}
              className="rounded-md border border-slate-300 px-3 py-2 font-mono uppercase"
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">الاسم العربي *</span>
            <input
              name="name_ar"
              defaultValue={defaults.name_ar}
              disabled={isSaving}
              className="rounded-md border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">الاسم الإنجليزي</span>
            <input
              name="name_en"
              defaultValue={defaults.name_en}
              disabled={isSaving}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={defaults.is_active}
              disabled={isSaving}
            />
            <span>نشط</span>
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-blue-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSaving ? "جاري الحفظ..." : "حفظ"}
          </button>
        </div>
      </form>
    </div>
  );
}
