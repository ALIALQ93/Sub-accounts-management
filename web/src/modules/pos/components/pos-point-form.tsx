"use client";

import { useEffect, useMemo, useState } from "react";
import type { BranchOption } from "@/modules/branches/services/branch-api";
import { PatternAllowedSection } from "@/modules/invoices/components/pattern-allowed-section";
import type {
  InvoicePatternListItem,
  MaterialCategoryOption,
  MaterialOption,
} from "@/modules/invoices/types";
import type { Warehouse } from "@/modules/materials/types";
import type {
  PosPaymentMethodFormValues,
  PosPointFormValues,
} from "@/modules/pos/types";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import { CustomerSearchField } from "@/modules/vouchers/components/customer-search-field";
import type { Account, Customer } from "@/modules/vouchers/types";

export const EMPTY_POS_POINT_VALUES: PosPointFormValues = {
  point_code: "",
  name_ar: "",
  name_en: "",
  branch_id: "",
  warehouse_id: "",
  invoice_pattern_id: "",
  default_customer_id: "",
  default_debtor_account_id: "",
  default_creditor_account_id: "",
  receipt_header: "",
  receipt_footer: "",
  allow_price_override: false,
  allow_line_discount: true,
  require_customer: false,
  is_active: true,
  sort_order: 0,
  payment_methods: [
    {
      account_id: "",
      label_ar: "",
      label_en: "",
      is_default: true,
      is_active: true,
    },
  ],
  allowed_material_ids: [],
  allowed_category_ids: [],
};

interface PosPointFormProps {
  mode: "create" | "edit";
  initialValues: PosPointFormValues;
  branches: BranchOption[];
  warehouses: Warehouse[];
  patterns: InvoicePatternListItem[];
  materials: MaterialOption[];
  categories: MaterialCategoryOption[];
  accounts: Account[];
  customers: Customer[];
  canEdit: boolean;
  isSaving: boolean;
  error: string;
  onSubmit: (values: PosPointFormValues) => void;
  onCancel?: () => void;
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className ?? ""}`}>
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100";

function emptyPaymentRow(isDefault = false): PosPaymentMethodFormValues {
  return {
    account_id: "",
    label_ar: "",
    label_en: "",
    is_default: isDefault,
    is_active: true,
  };
}

export function PosPointForm({
  mode,
  initialValues,
  branches,
  warehouses,
  patterns,
  materials,
  categories,
  accounts,
  customers,
  canEdit,
  isSaving,
  error,
  onSubmit,
  onCancel,
}: PosPointFormProps) {
  const [values, setValues] = useState<PosPointFormValues>(initialValues);
  const formDisabled = !canEdit || isSaving;

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  const update = (patch: Partial<PosPointFormValues>) => {
    setValues((prev) => ({ ...prev, ...patch }));
  };

  const salePatterns = useMemo(
    () =>
      patterns.filter(
        (pattern) => pattern.commercial_kind === "sale" && pattern.is_active,
      ),
    [patterns],
  );

  const branchWarehouses = useMemo(
    () =>
      warehouses.filter(
        (warehouse) =>
          warehouse.is_active &&
          (!values.branch_id || warehouse.branch_id === values.branch_id),
      ),
    [warehouses, values.branch_id],
  );

  const setPaymentRow = (
    index: number,
    patch: Partial<PosPaymentMethodFormValues>,
  ) => {
    setValues((prev) => {
      let nextRows = prev.payment_methods.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      );
      if (patch.is_default === true) {
        nextRows = nextRows.map((row, i) => ({
          ...row,
          is_default: i === index,
        }));
      }
      return { ...prev, payment_methods: nextRows };
    });
  };

  const addPaymentRow = () => {
    setValues((prev) => ({
      ...prev,
      payment_methods: [
        ...prev.payment_methods,
        emptyPaymentRow(prev.payment_methods.length === 0),
      ],
    }));
  };

  const removePaymentRow = (index: number) => {
    setValues((prev) => {
      const next = prev.payment_methods.filter((_, i) => i !== index);
      if (next.length === 0) return { ...prev, payment_methods: [emptyPaymentRow(true)] };
      if (!next.some((row) => row.is_default)) {
        next[0] = { ...next[0], is_default: true };
      }
      return { ...prev, payment_methods: next };
    });
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canEdit) return;
        onSubmit(values);
      }}
    >
      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <h2 className="mb-3 text-sm font-bold text-slate-800">بيانات النقطة</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="رمز النقطة *">
            <input
              className={`${inputClass} font-mono uppercase`}
              disabled={formDisabled}
              value={values.point_code}
              onChange={(e) => update({ point_code: e.target.value })}
              required
            />
          </Field>
          <Field label="ترتيب العرض">
            <input
              type="number"
              className={inputClass}
              disabled={formDisabled}
              value={values.sort_order}
              onChange={(e) =>
                update({ sort_order: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label="الاسم العربي *">
            <input
              className={inputClass}
              disabled={formDisabled}
              value={values.name_ar}
              onChange={(e) => update({ name_ar: e.target.value })}
              required
            />
          </Field>
          <Field label="الاسم الإنجليزي">
            <input
              className={inputClass}
              disabled={formDisabled}
              value={values.name_en}
              onChange={(e) => update({ name_en: e.target.value })}
            />
          </Field>
          <Field label="الفرع *">
            <select
              className={inputClass}
              disabled={formDisabled}
              value={values.branch_id}
              onChange={(e) => {
                const branchId = e.target.value;
                const stillValid = warehouses.some(
                  (w) =>
                    w.id === values.warehouse_id && w.branch_id === branchId,
                );
                update({
                  branch_id: branchId,
                  warehouse_id: stillValid ? values.warehouse_id : "",
                });
              }}
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
          </Field>
          <Field label="المستودع *">
            <select
              className={inputClass}
              disabled={formDisabled || !values.branch_id}
              value={values.warehouse_id}
              onChange={(e) => update({ warehouse_id: e.target.value })}
              required
            >
              <option value="">— اختر مستودعاً —</option>
              {branchWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.warehouse_code} — {warehouse.name_ar}
                </option>
              ))}
            </select>
          </Field>
          <Field label="نمط فاتورة البيع *" className="md:col-span-2">
            <select
              className={inputClass}
              disabled={formDisabled}
              value={values.invoice_pattern_id}
              onChange={(e) => update({ invoice_pattern_id: e.target.value })}
              required
            >
              <option value="">— اختر نمطاً —</option>
              {salePatterns.map((pattern) => (
                <option key={pattern.id} value={pattern.id}>
                  {pattern.pattern_no} — {pattern.name_ar}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <h2 className="mb-3 text-sm font-bold text-slate-800">العميل والحسابات</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <CustomerSearchField
              label="العميل الافتراضي"
              customers={customers}
              value={values.default_customer_id}
              disabled={formDisabled}
              onChange={(id) => update({ default_customer_id: id })}
            />
          </div>
          <AccountSearchField
            label="حساب المدين الافتراضي (صندوق/بنك)"
            accounts={accounts}
            value={values.default_debtor_account_id}
            disabled={formDisabled}
            onChange={(id) => update({ default_debtor_account_id: id })}
          />
          <AccountSearchField
            label="حساب الدائن الافتراضي (إيراد)"
            accounts={accounts}
            value={values.default_creditor_account_id}
            disabled={formDisabled}
            onChange={(id) => update({ default_creditor_account_id: id })}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <h2 className="mb-3 text-sm font-bold text-slate-800">رأس وتذييل الإيصال</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="رأس الإيصال">
            <textarea
              className={`${inputClass} min-h-24`}
              disabled={formDisabled}
              value={values.receipt_header}
              onChange={(e) => update({ receipt_header: e.target.value })}
            />
          </Field>
          <Field label="تذييل الإيصال">
            <textarea
              className={`${inputClass} min-h-24`}
              disabled={formDisabled}
              value={values.receipt_footer}
              onChange={(e) => update({ receipt_footer: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <h2 className="mb-3 text-sm font-bold text-slate-800">خيارات البيع</h2>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.allow_price_override}
              onChange={(e) =>
                update({ allow_price_override: e.target.checked })
              }
            />
            السماح بتعديل السعر
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.allow_line_discount}
              onChange={(e) =>
                update({ allow_line_discount: e.target.checked })
              }
            />
            السماح بخصم السطر
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.require_customer}
              onChange={(e) => update({ require_customer: e.target.checked })}
            />
            إلزام اختيار عميل
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.is_active}
              onChange={(e) => update({ is_active: e.target.checked })}
            />
            نشط
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-800">طرق التحصيل</h2>
          {canEdit && (
            <button
              type="button"
              disabled={formDisabled}
              onClick={addPaymentRow}
              className="btn btn-outline btn-sm"
            >
              إضافة طريقة
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-md border border-slate-300 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-start font-medium">التسمية</th>
                <th className="px-3 py-2 text-start font-medium">الحساب</th>
                <th className="px-3 py-2 text-center font-medium">افتراضي</th>
                <th className="px-3 py-2 text-center font-medium">نشط</th>
                <th className="px-3 py-2 text-center font-medium">حذف</th>
              </tr>
            </thead>
            <tbody>
              {values.payment_methods.map((row, index) => (
                <tr key={index} className="border-t border-slate-200">
                  <td className="px-3 py-2">
                    <input
                      className={inputClass}
                      disabled={formDisabled}
                      value={row.label_ar}
                      placeholder="نقد / بطاقة…"
                      onChange={(e) =>
                        setPaymentRow(index, { label_ar: e.target.value })
                      }
                    />
                  </td>
                  <td className="min-w-[16rem] px-3 py-2">
                    <AccountSearchField
                      label=""
                      hideLabel
                      accounts={accounts}
                      value={row.account_id}
                      disabled={formDisabled}
                      onChange={(id) =>
                        setPaymentRow(index, { account_id: id })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="radio"
                      name="pos-default-payment"
                      disabled={formDisabled}
                      checked={row.is_default}
                      onChange={() =>
                        setPaymentRow(index, { is_default: true })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      disabled={formDisabled}
                      checked={row.is_active}
                      onChange={(e) =>
                        setPaymentRow(index, { is_active: e.target.checked })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      disabled={formDisabled}
                      onClick={() => removePaymentRow(index)}
                      className="text-xs text-rose-700 hover:underline disabled:opacity-50"
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <PatternAllowedSection
        materials={materials}
        categories={categories}
        allowedMaterialIds={values.allowed_material_ids}
        allowedCategoryIds={values.allowed_category_ids}
        disabled={formDisabled}
        onChange={(patch) => update(patch)}
      />

      {error && <p className="text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="btn btn-outline"
          >
            إلغاء
          </button>
        )}
        {canEdit && (
          <button
            type="submit"
            disabled={isSaving}
            className="btn btn-primary"
          >
            {isSaving
              ? "جاري الحفظ..."
              : mode === "create"
                ? "إنشاء نقطة البيع"
                : "حفظ التعديلات"}
          </button>
        )}
      </div>
    </form>
  );
}

export function detailToFormValues(
  detail: {
    point_code: string;
    name_ar: string;
    name_en: string | null;
    branch_id: string;
    warehouse_id: string;
    invoice_pattern_id: string;
    default_customer_id: string | null;
    default_debtor_account_id: string | null;
    default_creditor_account_id: string | null;
    receipt_header: string | null;
    receipt_footer: string | null;
    allow_price_override: boolean;
    allow_line_discount: boolean;
    require_customer: boolean;
    is_active: boolean;
    sort_order: number;
    payment_methods: Array<{
      id?: string;
      account_id: string;
      label_ar: string;
      label_en: string | null;
      is_default: boolean;
      is_active: boolean;
    }>;
    allowed_material_ids: string[];
    allowed_category_ids: string[];
  },
): PosPointFormValues {
  return {
    point_code: detail.point_code,
    name_ar: detail.name_ar,
    name_en: detail.name_en ?? "",
    branch_id: detail.branch_id,
    warehouse_id: detail.warehouse_id,
    invoice_pattern_id: detail.invoice_pattern_id,
    default_customer_id: detail.default_customer_id ?? "",
    default_debtor_account_id: detail.default_debtor_account_id ?? "",
    default_creditor_account_id: detail.default_creditor_account_id ?? "",
    receipt_header: detail.receipt_header ?? "",
    receipt_footer: detail.receipt_footer ?? "",
    allow_price_override: detail.allow_price_override,
    allow_line_discount: detail.allow_line_discount,
    require_customer: detail.require_customer,
    is_active: detail.is_active,
    sort_order: detail.sort_order,
    payment_methods:
      detail.payment_methods.length > 0
        ? detail.payment_methods.map((row) => ({
            id: row.id,
            account_id: row.account_id,
            label_ar: row.label_ar,
            label_en: row.label_en ?? "",
            is_default: row.is_default,
            is_active: row.is_active,
          }))
        : [emptyPaymentRow(true)],
    allowed_material_ids: [...detail.allowed_material_ids],
    allowed_category_ids: [...detail.allowed_category_ids],
  };
}
