"use client";

import { useState } from "react";
import type { VoucherLineCategoryFormValues } from "@/modules/vouchers/services/voucher-line-category-api";
import { voucherLineCategoryApi } from "@/modules/vouchers/services/voucher-line-category-api";
import type { VoucherLineCategory, VoucherType } from "@/modules/vouchers/types";
import { getVoucherTypeLabel } from "@/modules/vouchers/utils/voucher-type-config";
import { VOUCHER_TYPES } from "@/modules/vouchers/utils/voucher-type-config";

interface VoucherLineCategoriesSettingsProps {
  categories: VoucherLineCategory[];
  onChange: (categories: VoucherLineCategory[]) => void;
}

const EMPTY_FORM: VoucherLineCategoryFormValues = {
  code: "",
  name_ar: "",
  name_en: "",
  requires_quantity: false,
  quantity_label: "العدد",
  sort_order: 0,
};

export function VoucherLineCategoriesSettings({
  categories,
  onChange,
}: VoucherLineCategoriesSettingsProps) {
  const [addingFor, setAddingFor] = useState<VoucherType | null>(null);
  const [form, setForm] = useState<VoucherLineCategoryFormValues>(EMPTY_FORM);
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const reload = async () => {
    const data = await voucherLineCategoryApi.listCategories();
    onChange(data);
  };

  const startAdd = (type: VoucherType) => {
    setAddingFor(type);
    setForm({ ...EMPTY_FORM, sort_order: (categories.filter((c) => c.voucher_type === type).length + 1) * 10 });
    setFeedback("");
  };

  const submitAdd = async () => {
    if (!addingFor || !form.code.trim() || !form.name_ar.trim()) {
      setFeedback("الكود والاسم مطلوبان.");
      return;
    }
    setIsSaving(true);
    setFeedback("");
    try {
      await voucherLineCategoryApi.createCategory(addingFor, form);
      await reload();
      setAddingFor(null);
      setForm(EMPTY_FORM);
      setFeedback("تمت إضافة النوع.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "فشل الإضافة.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (category: VoucherLineCategory) => {
    setIsSaving(true);
    setFeedback("");
    try {
      await voucherLineCategoryApi.updateCategory(category.id, {
        is_active: !category.is_active,
      });
      await reload();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "فشل التحديث.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">أنواع أسطر السند</h2>
        <p className="mt-1 text-xs text-slate-600">
          تصنيفات عامة لكل نوع سند — تظهر في أسطر السند وتُستخدم في التقارير. منفصلة عن
          كود الحساب.
        </p>
      </div>

      {VOUCHER_TYPES.map((type) => {
        const rows = categories.filter((item) => item.voucher_type === type);
        return (
          <article
            key={type}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900">
                {getVoucherTypeLabel(type)}
              </h3>
              <button
                type="button"
                onClick={() => startAdd(type)}
                disabled={isSaving}
                className="rounded-md border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-800 disabled:opacity-50"
              >
                + إضافة نوع
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-right text-slate-700">
                    <th className="border border-slate-200 p-2">الكود</th>
                    <th className="border border-slate-200 p-2">الاسم</th>
                    <th className="border border-slate-200 p-2">يتطلب عدداً</th>
                    <th className="border border-slate-200 p-2">الحالة</th>
                    <th className="border border-slate-200 p-2">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="odd:bg-white even:bg-slate-50/60">
                      <td className="border border-slate-100 p-2 font-mono text-xs">
                        {row.code}
                      </td>
                      <td className="border border-slate-100 p-2">{row.name_ar}</td>
                      <td className="border border-slate-100 p-2 text-xs text-slate-600">
                        {row.requires_quantity
                          ? row.quantity_label ?? "العدد"
                          : "—"}
                      </td>
                      <td className="border border-slate-100 p-2">
                        {row.is_active ? (
                          <span className="text-xs text-emerald-700">نشط</span>
                        ) : (
                          <span className="text-xs text-slate-500">معطّل</span>
                        )}
                      </td>
                      <td className="border border-slate-100 p-2">
                        <button
                          type="button"
                          onClick={() => void toggleActive(row)}
                          disabled={isSaving}
                          className="rounded-md border border-amber-300 px-2 py-1 text-xs text-amber-800 disabled:opacity-50"
                        >
                          {row.is_active ? "تعطيل" : "تفعيل"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="border border-slate-100 p-4 text-center text-slate-500"
                      >
                        لا أنواع معرّفة — مثال للصرف: اطعام، تغذية، انشائية
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {addingFor === type && (
              <div className="mt-3 grid gap-2 rounded-lg border border-blue-200 bg-blue-50/40 p-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span>الكود *</span>
                  <input
                    value={form.code}
                    onChange={(e) => setForm((c) => ({ ...c, code: e.target.value }))}
                    className="rounded-md border border-slate-300 px-2 py-1 font-mono text-sm"
                    dir="ltr"
                    placeholder="PAY-FOOD"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span>الاسم *</span>
                  <input
                    value={form.name_ar}
                    onChange={(e) => setForm((c) => ({ ...c, name_ar: e.target.value }))}
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.requires_quantity}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, requires_quantity: e.target.checked }))
                    }
                  />
                  يتطلب حقل عدد في سطر السند
                </label>
                {form.requires_quantity && (
                  <label className="grid gap-1 text-sm md:col-span-2">
                    <span>تسمية حقل العدد</span>
                    <input
                      value={form.quantity_label ?? ""}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, quantity_label: e.target.value }))
                      }
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      placeholder="العدد"
                    />
                  </label>
                )}
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <button
                    type="button"
                    onClick={() => void submitAdd()}
                    disabled={isSaving}
                    className="rounded-md bg-blue-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  >
                    حفظ النوع
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingFor(null)}
                    disabled={isSaving}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}

      {feedback && (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{feedback}</p>
      )}
    </section>
  );
}
