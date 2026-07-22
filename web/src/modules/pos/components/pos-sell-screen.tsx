"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useNotifications } from "@/components/notifications";
import { invoiceApi } from "@/modules/invoices/services/invoice-api";
import { materialApi } from "@/modules/materials/services/material-api";
import type { MaterialUnit } from "@/modules/materials/types";
import type { InvoicePattern, MaterialOption } from "@/modules/invoices/types";
import { filterMaterialsForPattern } from "@/modules/invoices/utils/material-filter";
import type { PosCartLine, PosPointDetail } from "@/modules/pos/types";
import { CustomerSearchField } from "@/modules/vouchers/components/customer-search-field";
import type { Customer } from "@/modules/vouchers/types";

interface PosSellScreenProps {
  point: PosPointDetail;
  materials: MaterialOption[];
  pattern: InvoicePattern;
  patternAllowedMaterialIds: string[];
  patternAllowedCategoryIds: string[];
  customers: Customer[];
}

function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMoney(value: number): string {
  return value.toLocaleString("ar-SY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function lineTotal(line: PosCartLine): number {
  return Math.max(0, line.quantity * line.unit_price - (line.discount_amount || 0));
}

export function PosSellScreen({
  point,
  materials,
  pattern,
  patternAllowedMaterialIds,
  patternAllowedCategoryIds,
  customers,
}: PosSellScreenProps) {
  const { notifySuccess, notifyError } = useNotifications();
  const unitsCache = useRef(new Map<string, MaterialUnit[]>());

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [customerId, setCustomerId] = useState(point.default_customer_id ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(() => {
    const active = point.payment_methods.filter((m) => m.is_active);
    const def = active.find((m) => m.is_default) ?? active[0];
    return def?.id ?? "";
  });
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  const catalog = useMemo(() => {
    const active = materials.filter((m) => m.is_active);
    const byPattern = filterMaterialsForPattern(
      active,
      patternAllowedMaterialIds,
      patternAllowedCategoryIds,
    );
    const byPoint = filterMaterialsForPattern(
      byPattern,
      point.allowed_material_ids,
      point.allowed_category_ids,
    );
    const q = search.trim().toLowerCase();
    if (!q) return byPoint;
    return byPoint.filter(
      (m) =>
        m.material_code.toLowerCase().includes(q) ||
        m.name_ar.toLowerCase().includes(q) ||
        (m.barcode ?? "").toLowerCase().includes(q),
    );
  }, [
    materials,
    patternAllowedMaterialIds,
    patternAllowedCategoryIds,
    point.allowed_material_ids,
    point.allowed_category_ids,
    search,
  ]);

  const activePayments = useMemo(
    () => point.payment_methods.filter((m) => m.is_active),
    [point.payment_methods],
  );

  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity * line.unit_price, 0),
    [cart],
  );
  const discountTotal = useMemo(
    () => cart.reduce((sum, line) => sum + (line.discount_amount || 0), 0),
    [cart],
  );
  const total = Math.max(0, subtotal - discountTotal);

  const loadUnits = useCallback(async (materialId: string) => {
    const cached = unitsCache.current.get(materialId);
    if (cached) return cached;
    const units = await materialApi.listMaterialUnits(materialId);
    unitsCache.current.set(materialId, units);
    return units;
  }, []);

  const addMaterial = async (material: MaterialOption) => {
    setError("");
    setSuccessMessage("");
    try {
      const units = await loadUnits(material.id);
      const base =
        units.find((u) => u.is_base_unit && u.is_active) ??
        units.find((u) => u.is_active) ??
        units[0];
      if (!base) {
        setError(`لا توجد وحدة للمادة ${material.material_code}.`);
        return;
      }

      const unitPrice =
        base.sale_price != null && base.sale_price > 0
          ? Number(base.sale_price)
          : Number(material.sale_price ?? 0);

      setCart((prev) => {
        const existing = prev.find(
          (line) =>
            line.material_id === material.id &&
            line.material_unit_id === base.id,
        );
        if (existing) {
          return prev.map((line) =>
            line.key === existing.key
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          );
        }
        const line: PosCartLine = {
          key: `${material.id}-${base.id}-${Date.now()}`,
          material_id: material.id,
          material_unit_id: base.id,
          material_code: material.material_code,
          name_ar: material.name_ar,
          unit_code: base.unit_code,
          quantity: 1,
          unit_price: unitPrice,
          discount_amount: 0,
        };
        return [...prev, line];
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "فشل إضافة المادة إلى السلة.",
      );
    }
  };

  const updateLine = (key: string, patch: Partial<PosCartLine>) => {
    setCart((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  };

  const removeLine = (key: string) => {
    setCart((prev) => prev.filter((line) => line.key !== key));
  };

  const checkout = async () => {
    if (cart.length === 0) {
      setError("أضف مواداً إلى السلة أولاً.");
      return;
    }
    if (point.require_customer && !customerId) {
      setError("اختيار العميل مطلوب لهذه النقطة.");
      return;
    }

    const payment = activePayments.find((m) => m.id === paymentMethodId);
    const debtorAccountId =
      payment?.account_id ||
      point.default_debtor_account_id ||
      pattern.default_debtor_account_id;
    const creditorAccountId =
      point.default_creditor_account_id || pattern.default_creditor_account_id;

    if (!debtorAccountId) {
      setError("حدّد طريقة دفع أو حساب مدين افتراضي للنقطة.");
      return;
    }

    setIsCheckingOut(true);
    setError("");
    setSuccessMessage("");
    try {
      const saved = await invoiceApi.saveInvoice({
        pattern_id: point.invoice_pattern_id,
        invoice_date: todayIsoDate(),
        branch_id: point.branch_id,
        cost_center_id: pattern.default_cost_center_id,
        customer_id: customerId || null,
        vendor_id: null,
        creditor_account_id: creditorAccountId,
        debtor_account_id: debtorAccountId,
        cost_account_id: pattern.default_cost_account_id,
        inventory_account_id: pattern.default_inventory_account_id,
        discount_account_id: pattern.default_discount_account_id,
        extra_account_id: pattern.default_extra_account_id,
        settlement_mode: "cash",
        payment_terms_days: null,
        currency_id: pattern.default_currency_id,
        exchange_rate: null,
        receipt_no: null,
        sales_rep_id: null,
        description: `بيع نقطة ${point.point_code}`,
        pos_point_id: point.id,
        materialLines: cart.map((line, index) => ({
          line_no: index + 1,
          branch_id: point.branch_id,
          cost_center_id: pattern.default_cost_center_id,
          warehouse_id: point.warehouse_id,
          material_id: line.material_id,
          material_unit_id: line.material_unit_id,
          quantity: line.quantity,
          unit_price: line.unit_price,
          line_description: null,
          discount_amount: point.allow_line_discount
            ? line.discount_amount || 0
            : 0,
        })),
        accountLines: [],
      });

      await invoiceApi.postInvoice(saved.id);
      setCart([]);
      setSuccessMessage(`تم إصدار الفاتورة ${saved.invoice_no}`);
      notifySuccess(`تم البيع — فاتورة ${saved.invoice_no}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "فشل إتمام عملية البيع.";
      setError(message);
      notifyError(message);
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="flex min-h-[calc(100vh-8rem)] flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 md:p-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="font-mono text-xs font-semibold text-[var(--brand-gold)]">
            {point.point_code}
          </p>
          <h1 className="text-lg font-bold text-[var(--brand-navy)]">
            {point.name_ar}
          </h1>
          <p className="text-xs text-slate-600">
            المستودع: {point.warehouse_name_ar ?? point.warehouse_code ?? "—"}
            {point.branch_name_ar ? ` · الفرع: ${point.branch_name_ar}` : ""}
          </p>
        </div>
        <Link href="/pos" className="btn btn-outline">
          رجوع
        </Link>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
        <section className="flex min-h-[24rem] flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالرمز أو الاسم أو الباركود..."
            className="mb-3 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="grid flex-1 auto-rows-max grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
            {catalog.map((material) => (
              <button
                key={material.id}
                type="button"
                onClick={() => void addMaterial(material)}
                className="flex flex-col rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-start transition hover:border-[var(--brand-navy)] hover:bg-[var(--brand-navy)]/5"
              >
                <span className="font-mono text-[11px] text-slate-500">
                  {material.material_code}
                </span>
                <span className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
                  {material.name_ar}
                </span>
                <span className="mt-auto pt-2 font-mono text-sm font-bold text-[var(--brand-navy)]">
                  {formatMoney(Number(material.sale_price ?? 0))}
                </span>
              </button>
            ))}
            {catalog.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-slate-500">
                لا توجد مواد مطابقة.
              </p>
            )}
          </div>
        </section>

        <section className="flex min-h-[24rem] flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-slate-800">السلة</h2>
          <div className="flex-1 space-y-2 overflow-y-auto">
            {cart.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">
                السلة فارغة — اختر مواداً من القائمة.
              </p>
            )}
            {cart.map((line) => (
              <div
                key={line.key}
                className="rounded-md border border-slate-200 bg-slate-50/50 p-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {line.name_ar}
                    </p>
                    <p className="font-mono text-[11px] text-slate-500">
                      {line.material_code} · {line.unit_code}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="text-xs text-rose-700 hover:underline"
                  >
                    حذف
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs text-slate-600">
                    الكمية
                    <div className="mt-1 flex items-center gap-1">
                      <button
                        type="button"
                        className="h-8 w-8 rounded border border-slate-300 bg-white text-sm font-bold"
                        onClick={() =>
                          updateLine(line.key, {
                            quantity: Math.max(1, line.quantity - 1),
                          })
                        }
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        className="h-8 w-full rounded border border-slate-300 px-2 text-center text-sm"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.key, {
                            quantity: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                      />
                      <button
                        type="button"
                        className="h-8 w-8 rounded border border-slate-300 bg-white text-sm font-bold"
                        onClick={() =>
                          updateLine(line.key, {
                            quantity: line.quantity + 1,
                          })
                        }
                      >
                        +
                      </button>
                    </div>
                  </label>
                  <label className="text-xs text-slate-600">
                    السعر
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={!point.allow_price_override}
                      className="mt-1 h-8 w-full rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
                      value={line.unit_price}
                      onChange={(e) =>
                        updateLine(line.key, {
                          unit_price: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </label>
                  {point.allow_line_discount && (
                    <label className="col-span-2 text-xs text-slate-600">
                      خصم السطر
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="mt-1 h-8 w-full rounded border border-slate-300 px-2 text-sm"
                        value={line.discount_amount}
                        onChange={(e) =>
                          updateLine(line.key, {
                            discount_amount: Math.max(
                              0,
                              Number(e.target.value) || 0,
                            ),
                          })
                        }
                      />
                    </label>
                  )}
                </div>
                <p className="mt-2 text-end font-mono text-sm font-semibold text-[var(--brand-navy)]">
                  {formatMoney(lineTotal(line))}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">المجموع الفرعي</span>
              <span className="font-mono font-medium">{formatMoney(subtotal)}</span>
            </div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">الخصم</span>
                <span className="font-mono font-medium text-rose-700">
                  −{formatMoney(discountTotal)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-[var(--brand-navy)]">
              <span>الإجمالي</span>
              <span className="font-mono">{formatMoney(total)}</span>
            </div>

            <CustomerSearchField
              label="العميل"
              customers={customers}
              value={customerId}
              required={point.require_customer}
              onChange={(id) => setCustomerId(id)}
            />

            {activePayments.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700">
                  طريقة الدفع
                </p>
                <div className="flex flex-wrap gap-2">
                  {activePayments.map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethodId(method.id)}
                      className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                        paymentMethodId === method.id
                          ? "border-[var(--brand-navy)] bg-[var(--brand-navy)] text-white"
                          : "border-slate-300 bg-white text-slate-800 hover:border-[var(--brand-navy)]"
                      }`}
                    >
                      {method.label_ar}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-rose-700">{error}</p>}
            {successMessage && (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {successMessage}
              </p>
            )}

            <button
              type="button"
              disabled={isCheckingOut || cart.length === 0}
              onClick={() => void checkout()}
              className="btn btn-primary w-full justify-center py-3 text-base disabled:opacity-60"
            >
              {isCheckingOut ? "جاري الإصدار..." : "إتمام البيع"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
