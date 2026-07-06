"use client";

import type {
  OpenMovement,
  VoucherAllocation,
} from "@/modules/vouchers/types";
import { capAppliedAmount } from "@/modules/vouchers/utils/validate-voucher-allocations";
import { formatOpenMovementLabel } from "@/modules/vouchers/utils/open-movement-utils";

interface VoucherAllocationsProps {
  allocations: VoucherAllocation[];
  openMovements: OpenMovement[];
  openAmountByLineId?: Record<string, number>;
  readOnly: boolean;
  visible: boolean;
  showDimensions?: boolean;
  onChange: (allocations: VoucherAllocation[]) => void;
}

function resolveOpenAmount(
  journalLineId: string,
  openMovements: OpenMovement[],
  openAmountByLineId?: Record<string, number>,
): number | undefined {
  if (openAmountByLineId?.[journalLineId] != null) {
    return openAmountByLineId[journalLineId];
  }

  return openMovements.find(
    (movement) => movement.target_journal_line_id === journalLineId,
  )?.open_amount;
}

export function VoucherAllocations({
  allocations,
  openMovements,
  openAmountByLineId,
  readOnly,
  visible,
  showDimensions = false,
  onChange,
}: VoucherAllocationsProps) {
  if (!visible) {
    return null;
  }

  const addAllocation = () => {
    onChange([
      ...allocations,
      {
        id: crypto.randomUUID(),
        voucher_id: "draft",
        target_journal_line_id: "",
        target_reference: "",
        applied_amount: 0,
        note: "",
      },
    ]);
  };

  const updateAllocation = (id: string, patch: Partial<VoucherAllocation>) => {
    onChange(
      allocations.map((allocation) =>
        allocation.id === id ? { ...allocation, ...patch } : allocation,
      ),
    );
  };

  const removeAllocation = (id: string) => {
    onChange(allocations.filter((allocation) => allocation.id !== id));
  };

  const allocationTotal = allocations.reduce(
    (sum, allocation) => sum + Number(allocation.applied_amount || 0),
    0,
  );

  const openTotal = allocations.reduce((sum, allocation) => {
    if (!allocation.target_journal_line_id) return sum;
    const openAmount = resolveOpenAmount(
      allocation.target_journal_line_id,
      openMovements,
      openAmountByLineId,
    );
    return sum + (openAmount ?? 0);
  }, 0);

  const remainingOpen = Math.max(0, openTotal - allocationTotal);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            تخصيصات اغلاق الحركات
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            يمكن تخصيص جزء من المبلغ المفتوح — الدفع الجزئي مسموح.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-blue-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={addAllocation}
          disabled={readOnly}
        >
          اضافة تخصيص
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr className="text-right text-slate-700">
              <th className="border-b border-slate-200 p-2">مرجع الحركة</th>
              {showDimensions && (
                <>
                  <th className="border-b border-slate-200 p-2">CC</th>
                  <th className="border-b border-slate-200 p-2">فرع</th>
                  <th className="border-b border-slate-200 p-2">جانب</th>
                  <th className="border-b border-slate-200 p-2">استحقاق</th>
                </>
              )}
              <th className="border-b border-slate-200 p-2">المفتوح</th>
              <th className="border-b border-slate-200 p-2">المبلغ المخصص</th>
              <th className="border-b border-slate-200 p-2">الباقي</th>
              <th className="border-b border-slate-200 p-2">ملاحظة</th>
              <th className="border-b border-slate-200 p-2">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((allocation) => {
              const openAmount = allocation.target_journal_line_id
                ? resolveOpenAmount(
                    allocation.target_journal_line_id,
                    openMovements,
                    openAmountByLineId,
                  )
                : undefined;
              const applied = Number(allocation.applied_amount || 0);
              const lineRemaining =
                openAmount != null ? Math.max(0, openAmount - applied) : null;

              const movement = allocation.target_journal_line_id
                ? openMovements.find(
                    (item) =>
                      item.target_journal_line_id ===
                      allocation.target_journal_line_id,
                  )
                : undefined;

              return (
                <tr
                  key={allocation.id}
                  className="odd:bg-white even:bg-slate-50/60"
                >
                  <td className="border-b border-slate-100 p-2">
                    <select
                      value={allocation.target_journal_line_id ?? ""}
                      onChange={(event) => {
                        const selected = openMovements.find(
                          (item) =>
                            item.target_journal_line_id === event.target.value,
                        );
                        const maxOpen = resolveOpenAmount(
                          event.target.value,
                          openMovements,
                          openAmountByLineId,
                        );
                        updateAllocation(allocation.id, {
                          target_journal_line_id: event.target.value,
                          target_reference: selected?.entry_no ?? "",
                          applied_amount: maxOpen ?? 0,
                        });
                      }}
                      disabled={readOnly}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-blue-900"
                    >
                      <option value="">اختر حركة مفتوحة</option>
                      {openMovements.map((item) => (
                        <option
                          key={item.target_journal_line_id}
                          value={item.target_journal_line_id}
                        >
                          {formatOpenMovementLabel(item)}
                        </option>
                      ))}
                    </select>
                  </td>
                  {showDimensions && (
                    <>
                      <td className="border-b border-slate-100 p-2 text-xs">
                        {movement?.cost_center_code ?? "—"}
                      </td>
                      <td className="border-b border-slate-100 p-2 text-xs">
                        {movement?.branch_code ?? "—"}
                      </td>
                      <td className="border-b border-slate-100 p-2 text-xs">
                        {movement?.open_side === "debit"
                          ? "مدين"
                          : movement?.open_side === "credit"
                            ? "دائن"
                            : "—"}
                      </td>
                      <td className="border-b border-slate-100 p-2 text-xs">
                        {movement?.due_date ?? "—"}
                        {movement?.is_overdue ? (
                          <span className="ms-1 text-rose-700">متأخر</span>
                        ) : null}
                      </td>
                    </>
                  )}
                  <td className="border-b border-slate-100 p-2 font-mono text-xs text-slate-600">
                    {openAmount != null ? openAmount.toFixed(2) : "—"}
                  </td>
                  <td className="border-b border-slate-100 p-2 font-mono">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={openAmount}
                        step="0.01"
                        value={allocation.applied_amount}
                        onChange={(event) =>
                          updateAllocation(allocation.id, {
                            applied_amount: capAppliedAmount(
                              Number(event.target.value),
                              openAmount,
                            ),
                          })
                        }
                        disabled={readOnly}
                        className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-blue-900"
                      />
                      {openAmount != null && !readOnly && applied < openAmount && (
                        <button
                          type="button"
                          title="تخصيص كامل"
                          onClick={() =>
                            updateAllocation(allocation.id, {
                              applied_amount: openAmount,
                            })
                          }
                          className="shrink-0 rounded border border-slate-300 px-1.5 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
                        >
                          كامل
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="border-b border-slate-100 p-2 font-mono text-xs">
                    {lineRemaining != null ? (
                      <span
                        className={
                          lineRemaining > 0.001
                            ? "text-amber-700"
                            : "text-emerald-700"
                        }
                      >
                        {lineRemaining.toFixed(2)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="border-b border-slate-100 p-2">
                    <input
                      value={allocation.note ?? ""}
                      onChange={(event) =>
                        updateAllocation(allocation.id, {
                          note: event.target.value,
                        })
                      }
                      disabled={readOnly}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-blue-900"
                      placeholder="ملاحظة"
                    />
                  </td>
                  <td className="border-b border-slate-100 p-2">
                    <button
                      type="button"
                      onClick={() => removeAllocation(allocation.id)}
                      disabled={readOnly}
                      className="rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 disabled:opacity-50"
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              );
            })}
            {allocations.length === 0 && (
              <tr>
                <td
                  colSpan={showDimensions ? 10 : 6}
                  className="border-b border-slate-100 p-4 text-center text-slate-500"
                >
                  لا توجد تخصيصات بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-2 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-3">
        <p className="font-mono text-slate-700">
          إجمالي التخصيصات: {allocationTotal.toFixed(2)}
        </p>
        <p className="font-mono text-slate-700">
          إجمالي المفتوح للأسطر: {openTotal.toFixed(2)}
        </p>
        <p className="font-mono text-amber-800">
          متبقٍ بعد التخصيص: {remainingOpen.toFixed(2)}
        </p>
      </div>
    </section>
  );
}
