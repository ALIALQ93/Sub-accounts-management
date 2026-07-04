"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { useAuth } from "@/modules/auth/auth-context";
import { VoucherListActions } from "@/modules/vouchers/components/voucher-list-actions";
import { canEditVoucherFromList } from "@/modules/vouchers/components/voucher-view-mode-bar";
import { StatusChip } from "@/modules/vouchers/components/status-chip";
import { VouchersNav } from "@/modules/vouchers/components/vouchers-nav";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { VoucherListItem, VoucherType } from "@/modules/vouchers/types";
import {
  CLOSE_MOVEMENTS_VOUCHER_CONFIG,
  CLOSE_MOVEMENTS_VOUCHER_TYPES,
  getSettlementModeLabel,
  getVoucherTypeLabel,
  VOUCHER_TYPE_CONFIG,
  VOUCHER_TYPES,
} from "@/modules/vouchers/utils/voucher-type-config";

type ListFilter = VoucherType | "all" | "close-movements";

export default function VouchersListPage() {
  const { hasPermission, isAdmin, authDisabled } = useAuth();
  const [items, setItems] = useState<VoucherListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState<ListFilter>("all");

  const loadVouchers = useCallback(async () => {
    setError("");
    try {
      const data = await voucherApi.listVouchers();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل السندات.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVouchers();
  }, [loadVouchers]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type");
    const settlement = params.get("settlement");
    if (settlement === "invoice") {
      setTypeFilter("close-movements");
      return;
    }
    if (type === "receipt" || type === "payment" || type === "settlement") {
      setTypeFilter(type);
    }
  }, []);

  const closeMovementsCount = items.filter(
    (item) =>
      item.settlement_mode === "invoice" &&
      (item.voucher_type === "receipt" || item.voucher_type === "payment"),
  ).length;

  const filteredItems =
    typeFilter === "all"
      ? items
      : typeFilter === "close-movements"
        ? items.filter(
            (item) =>
              item.settlement_mode === "invoice" &&
              (item.voucher_type === "receipt" || item.voucher_type === "payment"),
          )
        : items.filter((item) => item.voucher_type === typeFilter);

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">السندات</h1>
          <p className="text-xs text-slate-600">
            كل نوع سند له نافذة إنشاء مستقلة وترقيم تلقائي.
          </p>
        </div>
      </section>

      <VouchersNav />

      <section className="grid gap-3 md:grid-cols-3">
        {VOUCHER_TYPES.map((type) => {
          const config = VOUCHER_TYPE_CONFIG[type];
          return (
            <PermissionGate key={type} permission="vouchers.create">
              <Link
                href={config.newRoute}
                className={`block rounded-xl border p-4 transition hover:shadow-md ${config.colorClass}`}
              >
                <p className="font-semibold">{config.labelAr}</p>
                <p className="mt-1 text-xs opacity-90">{config.descriptionAr}</p>
                <p className="mt-3 text-sm font-medium">+ إنشاء جديد</p>
              </Link>
            </PermissionGate>
          );
        })}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">إغلاق الحركات</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {CLOSE_MOVEMENTS_VOUCHER_TYPES.map((type) => {
            const config = CLOSE_MOVEMENTS_VOUCHER_CONFIG[type];
            return (
              <PermissionGate key={type} permission="vouchers.create">
                <Link
                  href={config.newRoute}
                  className={`block rounded-xl border p-4 transition hover:shadow-md ${config.colorClass}`}
                >
                  <p className="font-semibold">{config.labelAr}</p>
                  <p className="mt-1 text-xs opacity-90">{config.descriptionAr}</p>
                  <p className="mt-3 text-sm font-medium">+ إنشاء جديد</p>
                </Link>
              </PermissionGate>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border-2 border-slate-300 bg-white p-3 md:p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <FilterButton
            active={typeFilter === "all"}
            onClick={() => setTypeFilter("all")}
          >
            الكل ({items.length})
          </FilterButton>
          {VOUCHER_TYPES.map((type) => (
            <FilterButton
              key={type}
              active={typeFilter === type}
              onClick={() => setTypeFilter(type)}
            >
              {getVoucherTypeLabel(type)} (
              {items.filter((item) => item.voucher_type === type).length})
            </FilterButton>
          ))}
          <FilterButton
            active={typeFilter === "close-movements"}
            onClick={() => setTypeFilter("close-movements")}
          >
            إغلاق حركات ({closeMovementsCount})
          </FilterButton>
        </div>

        {isLoading && <p className="text-sm text-slate-600">جاري تحميل السندات...</p>}
        {!isLoading && error && <p className="text-sm text-rose-700">{error}</p>}

        {!isLoading && !error && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[1040px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border border-slate-200 p-2">رقم السند</th>
                  <th className="border border-slate-200 p-2">النوع</th>
                  <th className="border border-slate-200 p-2">العملة</th>
                  <th className="border border-slate-200 p-2">قيمة السند</th>
                  <th className="border border-slate-200 p-2">وضع التسوية</th>
                  <th className="border border-slate-200 p-2">التاريخ</th>
                  <th className="border border-slate-200 p-2">الحالة</th>
                  <th className="border border-slate-200 p-2 text-center">مرفقات</th>
                  <th className="border border-slate-200 p-2">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const canEdit =
                    authDisabled || hasPermission("vouchers.edit");
                  const showEdit = canEditVoucherFromList(
                    item.status,
                    isAdmin,
                    canEdit,
                  );
                  const voucherHref = showEdit
                    ? `/vouchers/${item.id}`
                    : `/vouchers/${item.id}?mode=view`;

                  return (
                  <tr key={item.id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border border-slate-100 p-2 font-mono">
                      <Link
                        href={voucherHref}
                        className="font-medium text-blue-900 hover:underline"
                        title={showEdit ? "تعديل السند" : "عرض السند"}
                      >
                        {item.voucher_no}
                      </Link>
                    </td>
                    <td className="border border-slate-100 p-2">
                      {getVoucherTypeLabel(item.voucher_type)}
                    </td>
                    <td className="border border-slate-100 p-2 font-mono text-xs">
                      {item.currency_code ?? "—"}
                    </td>
                    <td className="border border-slate-100 p-2">
                      <VoucherAmountCell item={item} />
                    </td>
                    <td className="border border-slate-100 p-2">
                      {getSettlementModeLabel(item.settlement_mode)}
                    </td>
                    <td className="border border-slate-100 p-2">{item.voucher_date}</td>
                    <td className="border border-slate-100 p-2">
                      <StatusChip status={item.status} />
                    </td>
                    <td className="border border-slate-100 p-2 text-center">
                      <VoucherAttachmentBadge count={item.attachment_count} />
                    </td>
                    <td className="border border-slate-100 p-2">
                      <VoucherListActions
                        item={item}
                        onUpdated={loadVouchers}
                      />
                    </td>
                  </tr>
                  );
                })}

                {filteredItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="border border-slate-100 p-4 text-center text-slate-500"
                    >
                      لا توجد سندات في هذا التصنيف.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function VoucherAmountCell({ item }: { item: VoucherListItem }) {
  if (item.total_amount <= 0) {
    return <span className="text-slate-400">—</span>;
  }

  const formatted = item.total_amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="font-mono text-xs tabular-nums">
      <span className="font-medium text-slate-900">
        {formatted}
        {item.currency_code ? ` ${item.currency_code}` : ""}
      </span>
      {item.total_amount_base > 0 &&
        item.currency_code &&
        item.exchange_rate &&
        item.exchange_rate !== 1 && (
          <span className="mt-0.5 block text-[10px] text-slate-500">
            أساسي:{" "}
            {item.total_amount_base.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        )}
    </div>
  );
}

function VoucherAttachmentBadge({ count }: { count: number }) {
  if (count <= 0) {
    return <span className="text-slate-300">—</span>;
  }

  return (
    <span
      className="inline-flex items-center justify-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
      title={`${count} مرفق`}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
      </svg>
      {count}
    </span>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm ${
        active
          ? "bg-blue-900 text-white"
          : "border border-slate-300 text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
