"use client";

import { Modal } from "@/components/modal";
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
  const defaults: UnitCatalogFormValues = initialValues
    ? {
        unit_code: initialValues.unit_code,
        name_ar: initialValues.name_ar,
        name_en: initialValues.name_en ?? "",
        is_active: initialValues.is_active,
      }
    : EMPTY_VALUES;

  return (
    <Modal
      open={open}
      title={mode === "create" ? "وحدة جديدة" : "تعديل وحدة"}
      onClose={() => {
        if (isSaving) return;
        onClose();
      }}
    >
      <form
        key={initialValues?.id ?? "new"}
        className="grid gap-3"
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

        {error && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="btn btn-outline"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="btn btn-primary"
          >
            {isSaving ? "جاري الحفظ..." : "حفظ"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
