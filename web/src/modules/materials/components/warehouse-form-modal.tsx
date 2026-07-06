"use client";

import type { BranchOption } from "@/modules/branches/services/branch-api";
import type { Warehouse, WarehouseFormValues } from "@/modules/materials/types";

interface WarehouseFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  branches: BranchOption[];
  initialValues?: Warehouse | null;
  isSaving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: WarehouseFormValues) => void;
}

const EMPTY_VALUES: WarehouseFormValues = {
  warehouse_code: "",
  name_ar: "",
  name_en: "",
  branch_id: "",
  is_active: true,
};

export function WarehouseFormModal({
  open,
  mode,
  branches,
  initialValues,
  isSaving,
  error,
  onClose,
  onSubmit,
}: WarehouseFormModalProps) {
  if (!open) return null;

  const defaults: WarehouseFormValues = initialValues
    ? {
        warehouse_code: initialValues.warehouse_code,
        name_ar: initialValues.name_ar,
        name_en: initialValues.name_en ?? "",
        branch_id: initialValues.branch_id,
        is_active: initialValues.is_active,
      }
    : {
        ...EMPTY_VALUES,
        branch_id: branches.find((b) => b.is_active)?.id ?? "",
      };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          onSubmit({
            warehouse_code: String(formData.get("warehouse_code") ?? ""),
            name_ar: String(formData.get("name_ar") ?? ""),
            name_en: String(formData.get("name_en") ?? ""),
            branch_id: String(formData.get("branch_id") ?? ""),
            is_active: formData.get("is_active") === "on",
          });
        }}
      >
        <h2 className="text-lg font-bold text-slate-900">
          {mode === "create" ? "مستودع جديد" : "تعديل مستودع"}
        </h2>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">رمز المستودع *</span>
            <input
              name="warehouse_code"
              defaultValue={defaults.warehouse_code}
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
            <span className="font-medium">الفرع *</span>
            <select
              name="branch_id"
              defaultValue={defaults.branch_id}
              disabled={isSaving}
              className="rounded-md border border-slate-300 px-3 py-2"
              required
            >
              <option value="">— اختر فرعاً —</option>
              {branches
                .filter((branch) => branch.is_active)
                .map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.branch_code} — {branch.name_ar}
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
