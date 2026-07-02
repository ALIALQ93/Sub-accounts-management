"use client";

import { useState } from "react";
import type { VoucherLineCategoryFormValues } from "@/modules/vouchers/services/voucher-line-category-api";
import { voucherLineCategoryApi } from "@/modules/vouchers/services/voucher-line-category-api";
import type { VoucherLineCategory, VoucherType } from "@/modules/vouchers/types";
import {
  getVoucherTypeLabel,
  VOUCHER_TYPES,
} from "@/modules/vouchers/utils/voucher-type-config";

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

function categoryToForm(category: VoucherLineCategory): VoucherLineCategoryFormValues {
  return {
    code: category.code,
    name_ar: category.name_ar,
    name_en: category.name_en ?? "",
    requires_quantity: category.requires_quantity,
    quantity_label: category.quantity_label ?? "العدد",
    sort_order: category.sort_order,
    is_active: category.is_active,
  };
}

function CategoryFormPanel({
  title,
  form,
  isSaving,
  submitLabel,
  onFormChange,
  onSubmit,
  onCancel,
}: {
  title: string;
  form: VoucherLineCategoryFormValues;
  isSaving: boolean;
  submitLabel: string;
  onFormChange: (patch: Partial<VoucherLineCategoryFormValues>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-blue-200 bg-blue-50/40 p-3 md:grid-cols-2">
      <p className="md:col-span-2 text-sm font-medium text-blue-950">{title}</p>
      <label className="grid gap-1 text-sm">
        <span>الكود *</span>
        <input
          value={form.code}
          onChange={(event) => onFormChange({ code: event.target.value })}
          className="rounded-md border border-slate-300 px-2 py-1 font-mono text-sm"
          dir="ltr"
          placeholder="PAY-FOOD"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span>الاسم *</span>
        <input
          value={form.name_ar}
          onChange={(event) => onFormChange({ name_ar: event.target.value })}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span>الاسم (EN)</span>
        <input
          value={form.name_en ?? ""}
          onChange={(event) => onFormChange({ name_en: event.target.value })}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          dir="ltr"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span>ترتيب العرض</span>
        <input
          type="number"
          value={form.sort_order ?? 0}
          onChange={(event) =>
            onFormChange({ sort_order: Number(event.target.value) || 0 })
          }
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input
          type="checkbox"
          checked={form.requires_quantity}
          onChange={(event) =>
            onFormChange({ requires_quantity: event.target.checked })
          }
        />
        يتطلب حقل عدد في سطر السند
      </label>
      {form.requires_quantity && (
        <label className="grid gap-1 text-sm md:col-span-2">
          <span>تسمية حقل العدد</span>
          <input
            value={form.quantity_label ?? ""}
            onChange={(event) =>
              onFormChange({ quantity_label: event.target.value })
            }
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            placeholder="العدد"
          />
        </label>
      )}
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSaving}
          className="rounded-md bg-blue-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}

export function VoucherLineCategoriesSettings({
  categories,
  onChange,
}: VoucherLineCategoriesSettingsProps) {
  const [addingFor, setAddingFor] = useState<VoucherType | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VoucherLineCategoryFormValues>(EMPTY_FORM);
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const editingCategory = categories.find((item) => item.id === editingId);

  const reload = async () => {
    const data = await voucherLineCategoryApi.listCategories();
    onChange(data);
  };

  const resetFormState = () => {
    setAddingFor(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startAdd = (type: VoucherType) => {
    setEditingId(null);
    setAddingFor(type);
    setForm({
      ...EMPTY_FORM,
      sort_order: (categories.filter((item) => item.voucher_type === type).length + 1) * 10,
    });
    setFeedback("");
  };

  const startEdit = (category: VoucherLineCategory) => {
    setAddingFor(null);
    setEditingId(category.id);
    setForm(categoryToForm(category));
    setFeedback("");
  };

  const validateForm = (): boolean => {
    if (!form.code.trim() || !form.name_ar.trim()) {
      setFeedback("الكود والاسم مطلوبان.");
      return false;
    }
    return true;
  };

  const submitAdd = async () => {
    if (!addingFor || !validateForm()) return;

    setIsSaving(true);
    setFeedback("");
    try {
      await voucherLineCategoryApi.createCategory(addingFor, form);
      await reload();
      resetFormState();
      setFeedback("تمت إضافة النوع.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "فشل الإضافة.");
    } finally {
      setIsSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!editingId || !validateForm()) return;

    setIsSaving(true);
    setFeedback("");
    try {
      await voucherLineCategoryApi.updateCategory(editingId, form);
      await reload();
      resetFormState();
      setFeedback("تم حفظ التعديلات.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "فشل التعديل.");
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
      setFeedback(
        category.is_active ? "تم تعطيل النوع." : "تم تفعيل النوع.",
      );
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
          تصنيفات عامة لكل نوع سند — تظهر في أسطر السند وتُستخدم في التقارير. يمكن
          إضافتها وتعديلها وتعطيلها. منفصلة عن كود الحساب.
        </p>
      </div>

      {VOUCHER_TYPES.map((type) => {
        const rows = categories
          .filter((item) => item.voucher_type === type)
          .sort((a, b) => a.sort_order - b.sort_order || a.name_ar.localeCompare(b.name_ar));

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
                disabled={isSaving || Boolean(editingId)}
                className="rounded-md border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-800 disabled:opacity-50"
              >
                + إضافة نوع
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-right text-slate-700">
                    <th className="border border-slate-200 p-2">الكود</th>
                    <th className="border border-slate-200 p-2">الاسم</th>
                    <th className="border border-slate-200 p-2">ترتيب</th>
                    <th className="border border-slate-200 p-2">يتطلب عدداً</th>
                    <th className="border border-slate-200 p-2">الحالة</th>
                    <th className="border border-slate-200 p-2">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className={`odd:bg-white even:bg-slate-50/60 ${
                        editingId === row.id ? "ring-2 ring-inset ring-blue-300" : ""
                      }`}
                    >
                      <td className="border border-slate-100 p-2 font-mono text-xs">
                        {row.code}
                      </td>
                      <td className="border border-slate-100 p-2">{row.name_ar}</td>
                      <td className="border border-slate-100 p-2 font-mono text-xs">
                        {row.sort_order}
                      </td>
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
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            disabled={isSaving || Boolean(addingFor)}
                            className="rounded-md border border-blue-300 px-2 py-1 text-xs text-blue-800 disabled:opacity-50"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(row)}
                            disabled={isSaving || editingId === row.id}
                            className="rounded-md border border-amber-300 px-2 py-1 text-xs text-amber-800 disabled:opacity-50"
                          >
                            {row.is_active ? "تعطيل" : "تفعيل"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
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
              <CategoryFormPanel
                title="إضافة نوع جديد"
                form={form}
                isSaving={isSaving}
                submitLabel="حفظ النوع"
                onFormChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
                onSubmit={() => void submitAdd()}
                onCancel={resetFormState}
              />
            )}

            {editingCategory?.voucher_type === type && (
              <CategoryFormPanel
                title={`تعديل: ${editingCategory.name_ar}`}
                form={form}
                isSaving={isSaving}
                submitLabel="حفظ التعديلات"
                onFormChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
                onSubmit={() => void submitEdit()}
                onCancel={resetFormState}
              />
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
