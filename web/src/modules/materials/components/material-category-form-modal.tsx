"use client";

import { Modal } from "@/components/modal";
import type {
  MaterialCategory,
  MaterialCategoryFormValues,
} from "@/modules/materials/types";

interface MaterialCategoryFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  categories: MaterialCategory[];
  initialValues?: MaterialCategory | null;
  isSaving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: MaterialCategoryFormValues) => void;
}

const EMPTY_VALUES: MaterialCategoryFormValues = {
  category_code: "",
  name_ar: "",
  name_en: "",
  parent_id: "",
  is_active: true,
};

export function MaterialCategoryFormModal({
  open,
  mode,
  categories,
  initialValues,
  isSaving,
  error,
  onClose,
  onSubmit,
}: MaterialCategoryFormModalProps) {
  const defaults: MaterialCategoryFormValues = initialValues
    ? {
        category_code: initialValues.category_code,
        name_ar: initialValues.name_ar,
        name_en: initialValues.name_en ?? "",
        parent_id: initialValues.parent_id ?? "",
        is_active: initialValues.is_active,
      }
    : EMPTY_VALUES;

  const parentOptions = categories.filter(
    (category) => category.is_active && category.id !== initialValues?.id,
  );

  return (
    <Modal
      open={open}
      title={mode === "create" ? "صنف جديد" : "تعديل صنف"}
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
            category_code: String(formData.get("category_code") ?? ""),
            name_ar: String(formData.get("name_ar") ?? ""),
            name_en: String(formData.get("name_en") ?? ""),
            parent_id: String(formData.get("parent_id") ?? ""),
            is_active: formData.get("is_active") === "on",
          });
        }}
      >
        <label className="grid gap-1 text-sm">
          <span className="font-medium">رمز الصنف *</span>
          <input
            name="category_code"
            defaultValue={defaults.category_code}
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
        <label className="grid gap-1 text-sm">
          <span className="font-medium">صنف أب (اختياري)</span>
          <select
            name="parent_id"
            defaultValue={defaults.parent_id}
            disabled={isSaving}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">— بدون —</option>
            {parentOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.category_code} — {category.name_ar}
              </option>
            ))}
          </select>
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
