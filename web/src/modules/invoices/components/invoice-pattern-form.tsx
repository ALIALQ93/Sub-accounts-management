"use client";

import { useMemo } from "react";
import type { BranchOption, InvoicePatternFormValues, WarehouseOption } from "@/modules/invoices/services/invoice-pattern-api";
import {
  COMMERCIAL_KIND_OPTIONS,
  DIRECTION_OPTIONS,
  NUMBERING_RESET_OPTIONS,
  SETTLEMENT_MODE_OPTIONS,
} from "@/modules/invoices/utils/invoice-kind-config";
import { formatInvoiceNo } from "@/modules/invoices/utils/format-invoice-no";
import type { Currency } from "@/modules/currencies/types";
import type { Account, CostCenter } from "@/modules/vouchers/types";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import { PatternAllowedSection } from "@/modules/invoices/components/pattern-allowed-section";
import type { InvoicePatternConditionsFormValues } from "@/modules/invoices/services/invoice-pattern-api";
import type { InvoicePatternListItem, MaterialCategoryOption, MaterialOption } from "@/modules/invoices/types";
import {
  PRICING_CONSUMED_MODE_LABELS,
  PRICING_COST_MODE_LABELS,
  PRICING_MATERIAL_MODE_LABELS,
  defaultPricingConsumedMode,
  defaultPricingCostMode,
  defaultPricingMaterialMode,
  isInboundCommercialKind,
} from "@/modules/invoices/utils/pricing-modes";

interface InvoicePatternFormProps {
  mode: "create" | "edit";
  values: InvoicePatternFormValues;
  patternNo?: number;
  branches: BranchOption[];
  warehouses: WarehouseOption[];
  currencies: Currency[];
  costCenters: CostCenter[];
  accounts: Account[];
  materials: MaterialOption[];
  categories: MaterialCategoryOption[];
  inputPatterns: InvoicePatternListItem[];
  isSaving: boolean;
  disabled?: boolean;
  error: string;
  onChange: (values: InvoicePatternFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <h2 className="mb-3 text-sm font-bold text-slate-800">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
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

export function InvoicePatternForm({
  mode,
  values,
  patternNo,
  branches,
  warehouses,
  currencies,
  costCenters,
  accounts,
  materials,
  categories,
  inputPatterns,
  isSaving,
  disabled = false,
  error,
  onChange,
  onSubmit,
  onCancel,
}: InvoicePatternFormProps) {
  const formDisabled = disabled || isSaving;

  const numberingPreview = useMemo(() => {
    const year = new Date().getFullYear();
    return formatInvoiceNo(
      values.numbering_prefix || "INV",
      values.numbering_include_year,
      year,
      values.numbering_start,
      values.numbering_padding,
    );
  }, [
    values.numbering_prefix,
    values.numbering_include_year,
    values.numbering_start,
    values.numbering_padding,
  ]);

  const activeBranches = branches.filter((b) => b.is_active);
  const activeWarehouses = warehouses.filter((w) => w.is_active);
  const activeCurrencies = currencies.filter((c) => c.is_active);
  const activeCostCenters = costCenters.filter((c) => c.is_active);

  const update = (patch: Partial<InvoicePatternFormValues>) => {
    onChange({ ...values, ...patch });
  };

  const onCommercialKindChange = (kind: string) => {
    const option = COMMERCIAL_KIND_OPTIONS.find((o) => o.value === kind);
    const isReturn = kind === "return_sale" || kind === "return_purchase";
    update({
      commercial_kind: kind,
      direction: option?.direction ?? values.direction,
      is_return: isReturn,
      is_opening_stock: kind === "opening_stock",
      warehouse_movement:
        kind !== "opening_stock" ? values.warehouse_movement : true,
      reference_settings: isReturn
        ? {
            ...values.reference_settings,
            enabled: true,
            require_reference: true,
            load_expiry_date: true,
            load_serial_number: true,
          }
        : values.reference_settings,
    });
  };

  const updateConditions = (patch: Partial<InvoicePatternConditionsFormValues>) => {
    onChange({ ...values, conditions: { ...values.conditions, ...patch } });
  };

  const conditionFlags: Array<{ key: keyof InvoicePatternConditionsFormValues; label: string }> = [
    { key: "require_party", label: "إلزام الطرف (عميل/مورد)" },
    { key: "require_sales_rep", label: "إلزام مندوب المبيعات" },
    { key: "require_cost_center", label: "إلزام مركز الكلفة" },
    { key: "require_warehouse", label: "إلزام المستودع" },
    { key: "require_receipt_no", label: "إلزام رقم الإيصال" },
    { key: "prevent_duplicate_receipt_no", label: "منع تكرار رقم الإيصال" },
    { key: "require_payment_terms", label: "إلزام شروط السداد" },
    { key: "require_color", label: "إلزام اللون" },
    { key: "require_size", label: "إلزام المقاس" },
    { key: "require_source", label: "إلزام المصدر" },
    { key: "require_caliber", label: "إلزام العيار" },
  ];

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {mode === "edit" && patternNo !== undefined && (
        <p className="text-sm text-slate-600">
          رقم النمط: <span className="font-mono font-medium">{patternNo}</span>
        </p>
      )}

      <Section title="التعريف">
        <Field label="الاسم العربي *">
          <input
            required
            disabled={formDisabled}
            className={inputClass}
            value={values.name_ar}
            onChange={(e) => update({ name_ar: e.target.value })}
          />
        </Field>
        <Field label="الاسم الإنجليزي">
          <input
            disabled={formDisabled}
            dir="ltr"
            className={inputClass}
            value={values.name_en}
            onChange={(e) => update({ name_en: e.target.value })}
          />
        </Field>
        <Field label="النوع التجاري *">
          <select
            required
            disabled={formDisabled}
            className={inputClass}
            value={values.commercial_kind}
            onChange={(e) => onCommercialKindChange(e.target.value)}
          >
            {COMMERCIAL_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="الاتجاه *">
          <select
            required
            disabled={formDisabled}
            className={inputClass}
            value={values.direction}
            onChange={(e) =>
              update({ direction: e.target.value as InvoicePatternFormValues["direction"] })
            }
          >
            {DIRECTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ترتيب العرض">
          <input
            type="number"
            disabled={formDisabled}
            className={inputClass}
            value={values.sort_order}
            onChange={(e) => update({ sort_order: Number(e.target.value) || 0 })}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-4 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.is_active}
              onChange={(e) => update({ is_active: e.target.checked })}
            />
            نشط
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              disabled
              checked={values.is_return}
              readOnly
            />
            مرتجع (يُشتق من النوع التجاري)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              disabled
              checked={values.is_opening_stock}
              readOnly
            />
            بضاعة أول مدة
          </label>
        </div>
      </Section>

      <Section title="القيم الافتراضية">
        <Field label="الفرع الافتراضي">
          <select
            disabled={formDisabled}
            className={inputClass}
            value={values.default_branch_id ?? ""}
            onChange={(e) =>
              update({ default_branch_id: e.target.value || null })
            }
          >
            <option value="">— بدون —</option>
            {activeBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.branch_code} — {branch.name_ar}
              </option>
            ))}
          </select>
        </Field>
        <Field label="مركز الكلفة الافتراضي">
          <select
            disabled={formDisabled}
            className={inputClass}
            value={values.default_cost_center_id ?? ""}
            onChange={(e) =>
              update({ default_cost_center_id: e.target.value || null })
            }
          >
            <option value="">— بدون —</option>
            {activeCostCenters.map((center) => (
              <option key={center.id} value={center.id}>
                {center.code} — {center.name_ar}
              </option>
            ))}
          </select>
        </Field>
        <Field label="العملة الافتراضية">
          <select
            disabled={formDisabled}
            className={inputClass}
            value={values.default_currency_id ?? ""}
            onChange={(e) =>
              update({ default_currency_id: e.target.value || null })
            }
          >
            <option value="">— بدون —</option>
            {activeCurrencies.map((currency) => (
              <option key={currency.id} value={currency.id}>
                {currency.code} — {currency.name_ar}
              </option>
            ))}
          </select>
        </Field>
        <Field label="المستودع الافتراضي">
          <select
            disabled={formDisabled}
            className={inputClass}
            value={values.default_warehouse_id ?? ""}
            onChange={(e) =>
              update({ default_warehouse_id: e.target.value || null })
            }
          >
            <option value="">— بدون —</option>
            {activeWarehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.warehouse_code} — {warehouse.name_ar}
              </option>
            ))}
          </select>
        </Field>
        <Field label="مستودع الوجهة (مناقلة)">
          <select
            disabled={formDisabled}
            className={inputClass}
            value={values.target_warehouse_id ?? ""}
            onChange={(e) =>
              update({ target_warehouse_id: e.target.value || null })
            }
          >
            <option value="">— بدون —</option>
            {activeWarehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.warehouse_code} — {warehouse.name_ar}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {values.commercial_kind === "transfer_out" && (
        <Section title="ربط المناقلة">
          <Field label="نمط الإدخال المقترن" className="md:col-span-2">
            <select
              disabled={formDisabled}
              className={inputClass}
              value={values.paired_input_pattern_id ?? ""}
              onChange={(e) =>
                update({ paired_input_pattern_id: e.target.value || null })
              }
            >
              <option value="">— بدون —</option>
              {inputPatterns
                .filter((p) => p.commercial_kind === "transfer_in" && p.is_active)
                .map((pattern) => (
                  <option key={pattern.id} value={pattern.id}>
                    {pattern.name_ar}
                  </option>
                ))}
            </select>
          </Field>
        </Section>
      )}

      <PatternAllowedSection
        materials={materials}
        categories={categories}
        allowedMaterialIds={values.allowed_material_ids}
        allowedCategoryIds={values.allowed_category_ids}
        disabled={formDisabled}
        onChange={(patch) => update(patch)}
      />

      <Section title="المرجع">
        <div className="flex flex-wrap items-center gap-4 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.reference_settings.enabled}
              onChange={(e) =>
                update({
                  reference_settings: {
                    ...values.reference_settings,
                    enabled: e.target.checked,
                  },
                })
              }
            />
            تفعيل ربط بفاتورة مرجعية
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled || !values.reference_settings.enabled}
              checked={values.reference_settings.require_reference}
              onChange={(e) =>
                update({
                  reference_settings: {
                    ...values.reference_settings,
                    require_reference: e.target.checked,
                  },
                })
              }
            />
            إجبار اختيار مرجع
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled || !values.reference_settings.enabled}
              checked={values.reference_settings.lock_reference}
              onChange={(e) =>
                update({
                  reference_settings: {
                    ...values.reference_settings,
                    lock_reference: e.target.checked,
                  },
                })
              }
            />
            قفل المرجع بعد التحميل
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled || !values.reference_settings.enabled}
              checked={values.reference_settings.allow_partial_load}
              onChange={(e) =>
                update({
                  reference_settings: {
                    ...values.reference_settings,
                    allow_partial_load: e.target.checked,
                  },
                })
              }
            />
            السماح بالتحميل الجزئي
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled || !values.reference_settings.enabled}
              checked={values.reference_settings.match_reference}
              onChange={(e) =>
                update({
                  reference_settings: {
                    ...values.reference_settings,
                    match_reference: e.target.checked,
                  },
                })
              }
            />
            مطابقة الفاتورة مع المرجع
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled || !values.reference_settings.enabled}
              checked={values.reference_settings.allow_multiple_references}
              onChange={(e) =>
                update({
                  reference_settings: {
                    ...values.reference_settings,
                    allow_multiple_references: e.target.checked,
                  },
                })
              }
            />
            مراجع متعددة
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.reference_settings.hide_closed_references}
              onChange={(e) =>
                update({
                  reference_settings: {
                    ...values.reference_settings,
                    hide_closed_references: e.target.checked,
                  },
                })
              }
            />
            إخفاء المراجع المغلقة
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.reference_settings.allow_manual_reference_close}
              onChange={(e) =>
                update({
                  reference_settings: {
                    ...values.reference_settings,
                    allow_manual_reference_close: e.target.checked,
                  },
                })
              }
            />
            إغلاق المرجع يدوياً
          </label>
        </div>
        <Field label="حد عمر المرجع (أيام — فارغ = بدون حد)">
          <input
            type="number"
            min={0}
            disabled={formDisabled || !values.reference_settings.enabled}
            className={inputClass}
            value={values.reference_settings.max_reference_age_days ?? ""}
            onChange={(e) =>
              update({
                reference_settings: {
                  ...values.reference_settings,
                  max_reference_age_days: e.target.value
                    ? Number(e.target.value)
                    : null,
                },
              })
            }
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          {(
            [
              ["load_party", "تحميل الطرف"],
              ["load_warehouse", "تحميل المستودع"],
              ["load_material_lines", "تحميل أسطر المواد"],
              ["load_cost_center", "تحميل مركز الكلفة"],
              ["load_unit_price", "تحميل السعر"],
              ["load_payment_terms", "تحميل شروط الدفع"],
              ["load_receipt_no", "تحميل رقم الإيصال"],
              ["load_invoice_date", "تحميل تاريخ الفاتورة"],
              ["load_discount_extra", "تحميل الحسم / الإضافي"],
              ["load_net_unit_price", "تحميل السعر الصافي (بعد الخصم)"],
              ["load_expiry_date", "تحميل تاريخ انتهاء الصلاحية"],
              ["load_serial_number", "تحميل الرقم التسلسلي"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={formDisabled || !values.reference_settings.enabled}
                checked={values.reference_settings[key]}
                onChange={(e) =>
                  update({
                    reference_settings: {
                      ...values.reference_settings,
                      [key]: e.target.checked,
                    },
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </Section>

      <Section title="الحسابات الافتراضية">
        <AccountSearchField
          label="حساب الدائن الافتراضي"
          accounts={accounts}
          value={values.default_creditor_account_id ?? ""}
          onChange={(id) => update({ default_creditor_account_id: id || null })}
          disabled={formDisabled}
        />
        <AccountSearchField
          label="حساب المدين الافتراضي"
          accounts={accounts}
          value={values.default_debtor_account_id ?? ""}
          onChange={(id) => update({ default_debtor_account_id: id || null })}
          disabled={formDisabled}
        />
        <AccountSearchField
          label="حساب التكلفة"
          accounts={accounts}
          value={values.default_cost_account_id ?? ""}
          onChange={(id) => update({ default_cost_account_id: id || null })}
          disabled={formDisabled}
        />
        <AccountSearchField
          label="حساب المخزون"
          accounts={accounts}
          value={values.default_inventory_account_id ?? ""}
          onChange={(id) => update({ default_inventory_account_id: id || null })}
          disabled={formDisabled}
        />
        <AccountSearchField
          label="حساب المناقلة (وسيط)"
          accounts={accounts}
          value={values.transfer_transit_account_id ?? ""}
          onChange={(id) => update({ transfer_transit_account_id: id || null })}
          disabled={formDisabled}
        />
      </Section>

      {values.warehouse_movement && (
        <Section title="التسعير والتكلفة">
          <Field label="السعر المحمّل من بطاقة المادة">
            <select
              disabled={formDisabled}
              className={inputClass}
              value={values.pricing_material_mode ?? defaultPricingMaterialMode(values.commercial_kind)}
              onChange={(e) =>
                update({
                  pricing_material_mode: e.target.value || null,
                })
              }
            >
              {Object.entries(PRICING_MATERIAL_MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-slate-500 md:col-span-2">
            يُحمَّل السعر تلقائياً عند اختيار المادة/الوحدة. المستخدم ذو صلاحية تعديل
            الفاتورة يستطيع تغيير السعر يدوياً في السطر.
          </p>

          {isInboundCommercialKind(values.commercial_kind) && (
            <>
              <Field label="تأثير السطر على تكلفة المخزون (إدخال)">
                <select
                  disabled={formDisabled}
                  className={inputClass}
                  value={values.pricing_cost_mode ?? defaultPricingCostMode()}
                  onChange={(e) =>
                    update({
                      pricing_cost_mode: e.target.value || null,
                    })
                  }
                >
                  {Object.entries(PRICING_COST_MODE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex flex-wrap items-center gap-4 md:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={formDisabled}
                    checked={values.line_adjustments_affect_material_cost}
                    onChange={(e) =>
                      update({
                        line_adjustments_affect_material_cost: e.target.checked,
                      })
                    }
                  />
                  خصم/إضافي السطر يدخل في تكلفة الوحدة (عند «صافي السطر»)
                </label>
              </div>
              <p className="text-xs text-slate-500 md:col-span-2">
                ينطبق على فواتير الإدخال: مشتريات، مرتجع مبيعات، بضاعة أول مدة، مناقلة
                واردة. عند «إجمالي السطر» تُحسب التكلفة من الكمية × السعر دون خصم/إضافي.
              </p>
            </>
          )}

          {!isInboundCommercialKind(values.commercial_kind) && (
            <>
              <Field label="استهلاك التكلفة عند الإخراج">
                <select
                  disabled={formDisabled}
                  className={inputClass}
                  value={
                    values.pricing_consumed_mode ?? defaultPricingConsumedMode()
                  }
                  onChange={(e) =>
                    update({
                      pricing_consumed_mode: e.target.value || null,
                    })
                  }
                >
                  {Object.entries(PRICING_CONSUMED_MODE_LABELS).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <p className="text-xs text-slate-500 md:col-span-2">
                ينطبق على فواتير الإخراج: مبيعات، مرتجع مشتريات، مناقلة صادرة. «تكلفة
                الدفعة» تُستخدم عند تفعيل فصل التكلفة بالصلاحية أو التسلسلي في إعدادات
                المخزون.
              </p>
            </>
          )}
        </Section>
      )}

      <Section title="التخفيض">
        <div className="flex flex-wrap items-center gap-4 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.discount_enabled}
              onChange={(e) => update({ discount_enabled: e.target.checked })}
            />
            تفعيل سياسة الخصم التجاري
          </label>
        </div>
        <Field label="أقصى نسبة خصم (%)">
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            disabled={formDisabled || !values.discount_enabled}
            className={inputClass}
            value={values.max_discount_percent ?? ""}
            onChange={(e) =>
              update({
                max_discount_percent: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </Field>
        <Field label="يطبَّق الخصم على">
          <select
            disabled={formDisabled || !values.discount_enabled}
            className={inputClass}
            value={values.discount_applies_to ?? "line"}
            onChange={(e) =>
              update({
                discount_applies_to: e.target.value as "line" | "invoice",
              })
            }
          >
            <option value="line">سطر المادة</option>
            <option value="invoice">إجمالي الفاتورة</option>
          </select>
        </Field>
        <AccountSearchField
          label="حساب الحسميات الافتراضي"
          accounts={accounts}
          value={values.default_discount_account_id ?? ""}
          onChange={(id) => update({ default_discount_account_id: id || null })}
          disabled={formDisabled || !values.discount_enabled}
        />
        <p className="text-xs text-slate-500 md:col-span-2">
          الخصم التجاري يختلف عن التدوير (تقريب العملة). التحقق من حدود الخصم على مستوى
          الفاتورة يُضاف عند إدخال مبالغ الخصم في الأسطر.
        </p>
      </Section>

      <Section title="إضافي السطر">
        <div className="flex flex-wrap items-center gap-4 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.line_extra_enabled}
              onChange={(e) => update({ line_extra_enabled: e.target.checked })}
            />
            تفعيل حقول الإضافي على أسطر المواد
          </label>
        </div>
        <AccountSearchField
          label="حساب الإضافي الافتراضي"
          accounts={accounts}
          value={values.default_extra_account_id ?? ""}
          onChange={(id) => update({ default_extra_account_id: id || null })}
          disabled={formDisabled || !values.line_extra_enabled}
        />
        <p className="text-xs text-slate-500 md:col-span-2">
          الإضافي يُدخل كنسبة أو مبلغ ثابت لكل سطر. تأثير الخصم/الإضافي على تكلفة
          المخزون يُضبط في قسم «التسعير والتكلفة» لفواتير الإدخال.
        </p>
      </Section>

      <Section title="تتبع الصلاحية والتسلسلي">
        <div className="flex flex-wrap items-center gap-4 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled || !values.warehouse_movement}
              checked={values.track_expiry_on_lines}
              onChange={(e) => update({ track_expiry_on_lines: e.target.checked })}
            />
            إظهار تاريخ انتهاء الصلاحية على الأسطر
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled || !values.warehouse_movement}
              checked={values.track_serial_on_lines}
              onChange={(e) => update({ track_serial_on_lines: e.target.checked })}
            />
            إظهار الرقم التسلسلي على الأسطر
          </label>
        </div>
        <p className="text-xs text-slate-500 md:col-span-2">
          الإجبار ونوع التتبع (إدخال/إخراج) يُضبط من بطاقة المادة. هنا يُحدَّد فقط إظهار
          الحقول في فواتير هذا النمط — والقيم تُدخل يدوياً في كل سطر.
        </p>
      </Section>

      <Section title="توفر المخزون">
        <div className="flex flex-wrap items-center gap-4 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled || !values.warehouse_movement}
              checked={values.enforce_stock_availability}
              onChange={(e) =>
                update({ enforce_stock_availability: e.target.checked })
              }
            />
            منع ترحيل الإخراج إذا الكمية تتجاوز الرصيد المتاح (مادة + مستودع)
          </label>
        </div>
        <p className="text-xs text-slate-500 md:col-span-2">
          ينطبق على المبيعات، مرتجع المشتريات، والمناقلة الصادرة. يتحقق من الرصيد الإجمالي
          ودفعات الصلاحية والأرقام التسلسلية المتوفرة في المخزون.
        </p>
      </Section>

      <Section title="الحجز">
        <p className="text-xs text-amber-800 md:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          الحجز غير فعّال حالياً على الرصيد المتاح: يُكتب في الجدول عند حفظ المسودة
          لكن لا يُطرح من الكمية القابلة للبيع، ولا يوجد مسار إلغاء فاتورة يحرّر
          الحجز. الخيارات معطّلة حتى يُنفَّذ التأثير الفعلي.
        </p>
        <div className="flex flex-wrap items-center gap-4 md:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input
              type="checkbox"
              disabled
              checked={values.reservation_enabled}
              readOnly
            />
            تفعيل حجز الكميات قبل التسليم
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input
              type="checkbox"
              disabled
              checked={values.reserve_on_save}
              readOnly
            />
            حجز عند حفظ المسودة
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input
              type="checkbox"
              disabled
              checked={values.release_on_cancel}
              readOnly
            />
            تحرير الحجز عند الإلغاء
          </label>
        </div>
        <Field label="مدة الحجز (أيام)">
          <input
            type="number"
            min={1}
            disabled
            className={inputClass}
            value={values.reservation_days ?? ""}
            readOnly
          />
        </Field>
      </Section>

      <Section title="التدوير (تقريب العملة)">
        <div className="flex flex-wrap items-center gap-4 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.rounding_enabled}
              onChange={(e) => update({ rounding_enabled: e.target.checked })}
            />
            تفعيل التدوير على هذا النمط
          </label>
        </div>
        <Field label="هدف التدوير">
          <select
            disabled={formDisabled || !values.rounding_enabled}
            className={inputClass}
            value={values.rounding_target ?? "invoice_total"}
            onChange={(e) =>
              update({
                rounding_target: e.target
                  .value as InvoicePatternFormValues["rounding_target"],
              })
            }
          >
            <option value="invoice_total">إجمالي الفاتورة</option>
            <option value="line_amount">مبلغ السطر</option>
            <option value="both">الاثنان معاً</option>
          </select>
        </Field>
        <Field label="أسلوب التقريب">
          <select
            disabled={formDisabled || !values.rounding_enabled}
            className={inputClass}
            value={values.rounding_mode ?? "nearest"}
            onChange={(e) =>
              update({
                rounding_mode: e.target
                  .value as InvoicePatternFormValues["rounding_mode"],
              })
            }
          >
            <option value="nearest">أقرب قيمة</option>
            <option value="up">تقريب لأعلى</option>
            <option value="down">تقريب لأسفل</option>
          </select>
        </Field>
        <Field label="خطوة التقريب (فارغ = 1)">
          <input
            type="number"
            min={0.0001}
            step="any"
            disabled={formDisabled || !values.rounding_enabled}
            className={inputClass}
            value={values.rounding_step ?? ""}
            onChange={(e) =>
              update({
                rounding_step: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </Field>
        <p className="text-xs text-slate-500 md:col-span-2">
          التدوير تقني لتناسب فئات العملة — يختلف عن الخصم التجاري في تبويب التخفيض.
        </p>
      </Section>

      <Section title="شروط النمط">
        <div className="flex flex-wrap items-center gap-4 md:col-span-2">
          {conditionFlags.map((flag) => (
            <label key={flag.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={formDisabled}
                checked={values.conditions[flag.key]}
                onChange={(e) => updateConditions({ [flag.key]: e.target.checked })}
              />
              {flag.label}
            </label>
          ))}
        </div>
      </Section>

      <Section title="السلوك والتسوية">
        <Field label="نمط التسوية الافتراضي">
          <select
            disabled={formDisabled}
            className={inputClass}
            value={values.default_settlement_mode}
            onChange={(e) =>
              update({
                default_settlement_mode: e.target
                  .value as InvoicePatternFormValues["default_settlement_mode"],
              })
            }
          >
            {SETTLEMENT_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="أيام السداد الافتراضية">
          <input
            type="number"
            min={0}
            disabled={formDisabled || !values.payment_terms_enabled}
            className={inputClass}
            value={values.default_payment_terms_days ?? ""}
            onChange={(e) =>
              update({
                default_payment_terms_days: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
          />
        </Field>
        <div className="flex flex-wrap items-center gap-4 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.generate_journal}
              onChange={(e) => update({ generate_journal: e.target.checked })}
            />
            توليد قيد يومية
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.auto_post}
              onChange={(e) => update({ auto_post: e.target.checked })}
            />
            ترحيل تلقائي
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.warehouse_movement}
              onChange={(e) => update({ warehouse_movement: e.target.checked })}
            />
            حركة مخزون
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.cc_on_goods}
              onChange={(e) => update({ cc_on_goods: e.target.checked })}
            />
            مركز كلفة على المواد
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.load_party_currency}
              onChange={(e) => update({ load_party_currency: e.target.checked })}
            />
            تحميل عملة الطرف تلقائياً
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.cc_on_party}
              onChange={(e) => update({ cc_on_party: e.target.checked })}
            />
            مركز كلفة على الطرف
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={formDisabled}
              checked={values.payment_terms_enabled}
              onChange={(e) =>
                update({ payment_terms_enabled: e.target.checked })
              }
            />
            تفعيل شروط السداد
          </label>
        </div>
      </Section>

      <Section title="الترقيم">
        <Field label="البادئة">
          <input
            disabled={formDisabled}
            className={inputClass}
            value={values.numbering_prefix}
            onChange={(e) => update({ numbering_prefix: e.target.value })}
          />
        </Field>
        <Field label="عدد الخانات">
          <input
            type="number"
            min={1}
            max={8}
            disabled={formDisabled}
            className={inputClass}
            value={values.numbering_padding}
            onChange={(e) =>
              update({ numbering_padding: Number(e.target.value) || 4 })
            }
          />
        </Field>
        <Field label="بداية الترقيم">
          <input
            type="number"
            min={1}
            disabled={formDisabled}
            className={inputClass}
            value={values.numbering_start}
            onChange={(e) =>
              update({ numbering_start: Number(e.target.value) || 1 })
            }
          />
        </Field>
        <Field label="إعادة ضبط الترقيم">
          <select
            disabled={formDisabled}
            className={inputClass}
            value={values.numbering_reset}
            onChange={(e) =>
              update({
                numbering_reset: e.target
                  .value as InvoicePatternFormValues["numbering_reset"],
              })
            }
          >
            {NUMBERING_RESET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            disabled={formDisabled}
            checked={values.numbering_include_year}
            onChange={(e) =>
              update({ numbering_include_year: e.target.checked })
            }
          />
          تضمين السنة في رقم الفاتورة
        </label>
        <p className="text-sm text-slate-600 md:col-span-2">
          معاينة الرقم التالي:{" "}
          <span className="font-mono font-medium text-blue-900" dir="ltr">
            {numberingPreview}
          </span>
        </p>
      </Section>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={formDisabled}
          className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSaving ? "جاري الحفظ..." : mode === "create" ? "إنشاء النمط" : "حفظ التعديلات"}
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}
