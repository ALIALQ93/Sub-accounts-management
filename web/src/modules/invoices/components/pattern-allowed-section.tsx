"use client";

import type { MaterialCategoryOption, MaterialOption } from "@/modules/invoices/types";

interface PatternAllowedSectionProps {
  materials: MaterialOption[];
  categories: MaterialCategoryOption[];
  allowedMaterialIds: string[];
  allowedCategoryIds: string[];
  disabled?: boolean;
  onChange: (patch: {
    allowed_material_ids?: string[];
    allowed_category_ids?: string[];
  }) => void;
}

const boxClass =
  "max-h-40 overflow-y-auto rounded-md border border-slate-300 bg-white p-2 text-sm";

export function PatternAllowedSection({
  materials,
  categories,
  allowedMaterialIds,
  allowedCategoryIds,
  disabled = false,
  onChange,
}: PatternAllowedSectionProps) {
  const toggleId = (
    list: string[],
    id: string,
    key: "allowed_material_ids" | "allowed_category_ids",
  ) => {
    const next = list.includes(id)
      ? list.filter((item) => item !== id)
      : [...list, id];
    onChange({ [key]: next });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:col-span-2">
      <h2 className="mb-1 text-sm font-bold text-slate-800">تخصيص المواد والأصناف</h2>
      <p className="mb-3 text-xs text-slate-600">
        اترك القوائم فارغة للسماح بكل المواد. عند التحديد تُقبل المواد المختارة أو التابعة للأصناف المختارة.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">أصناف مسموحة</p>
          <div className={boxClass}>
            {categories
              .filter((c) => c.is_active)
              .map((category) => (
                <label
                  key={category.id}
                  className="flex items-center gap-2 py-0.5"
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={allowedCategoryIds.includes(category.id)}
                    onChange={() =>
                      toggleId(
                        allowedCategoryIds,
                        category.id,
                        "allowed_category_ids",
                      )
                    }
                  />
                  {category.category_code} — {category.name_ar}
                </label>
              ))}
            {categories.length === 0 && (
              <p className="text-slate-500">لا توجد أصناف.</p>
            )}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">مواد مسموحة</p>
          <div className={boxClass}>
            {materials
              .filter((m) => m.is_active)
              .map((material) => (
                <label
                  key={material.id}
                  className="flex items-center gap-2 py-0.5"
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={allowedMaterialIds.includes(material.id)}
                    onChange={() =>
                      toggleId(
                        allowedMaterialIds,
                        material.id,
                        "allowed_material_ids",
                      )
                    }
                  />
                  {material.material_code} — {material.name_ar}
                </label>
              ))}
            {materials.length === 0 && (
              <p className="text-slate-500">لا توجد مواد.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
