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
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--brand-navy)]">
            تخصيصات اغلاق الحركات
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            يمكن تخصيص جزء من المبلغ المفتوح — الدفع الجزئي مسموح.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={addAllocation}
          disabled={readOnly}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          اضافة تخصيص
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="data-table min-w-[1100px]">
          <thead>
            <tr>
              <th>مرجع الحركة</th>
              {showDimensions && (
                <>
                  <th>CC</th>
                  <th>فرع</th>
                  <th>جانب</th>
                  <th>استحقاق</th>
                </>
              )}
              <th>المفتوح</th>
              <th>المبلغ المخصص</th>
              <th>الباقي</th>
              <th>ملاحظة</th>
              <th>إجراء</th>
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
                <tr key={allocation.id}>
                  <td>
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
                      <td className="text-xs">
                        {movement?.cost_center_code ?? "—"}
                      </td>
                      <td className="text-xs">
                        {movement?.branch_code ?? "—"}
                      </td>
                      <td className="text-xs">
                        {movement?.open_side === "debit"
                          ? "مدين"
                          : movement?.open_side === "credit"
                            ? "دائن"
                            : "—"}
                      </td>
                      <td className="text-xs">
                        {movement?.due_date ?? "—"}
                        {movement?.is_overdue ? (
                          <span className="ms-1 text-[var(--danger)]">متأخر</span>
                        ) : null}
                      </td>
                    </>
                  )}
                  <td className="font-mono tabular-nums text-xs text-slate-600">
                    {openAmount != null ? openAmount.toFixed(2) : "—"}
                  </td>
                  <td className="font-mono">
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
                        className="w-full rounded-md border border-slate-300 px-2 py-1 tabular-nums outline-none focus:border-blue-900"
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
                  <td className="font-mono tabular-nums text-xs">
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
                  <td>
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
                  <td>
                    <button
                      type="button"
                      onClick={() => removeAllocation(allocation.id)}
                      disabled={readOnly}
                      className="btn btn-sm btn-outline text-[var(--danger)] disabled:opacity-50"
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
                  className="p-4 text-center text-slate-500"
                >
                  لا توجد تخصيصات بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-2 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-3">
        <p className="font-mono tabular-nums text-slate-700">
          إجمالي التخصيصات: {allocationTotal.toFixed(2)}
        </p>
        <p className="font-mono tabular-nums text-slate-700">
          إجمالي المفتوح للأسطر: {openTotal.toFixed(2)}
        </p>
        <p className="font-mono tabular-nums text-amber-800">
          متبقٍ بعد التخصيص: {remainingOpen.toFixed(2)}
        </p>
      </div>
    </section>
  );
}
