"use client";

import type { VoucherAllocation } from "@/modules/vouchers/types";

interface VoucherAllocationsProps {
  allocations: VoucherAllocation[];
  readOnly: boolean;
  visible: boolean;
  onChange: (allocations: VoucherAllocation[]) => void;
}

export function VoucherAllocations({
  allocations,
  readOnly,
  visible,
  onChange,
}: VoucherAllocationsProps) {
  if (!visible) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
        تبويب التخصيصات يظهر فقط في وضع اغلاق الحركات `invoice` لسندات القبض/الدفع.
      </section>
    );
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

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">تخصيصات اغلاق الحركات</h2>
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
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr className="text-right text-slate-700">
              <th className="border-b border-slate-200 p-2">مرجع الحركة</th>
              <th className="border-b border-slate-200 p-2">المبلغ المخصص</th>
              <th className="border-b border-slate-200 p-2">ملاحظة</th>
              <th className="border-b border-slate-200 p-2">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((allocation) => (
              <tr key={allocation.id} className="odd:bg-white even:bg-slate-50/60">
                <td className="border-b border-slate-100 p-2">
                  <input
                    value={allocation.target_reference ?? ""}
                    onChange={(event) =>
                      updateAllocation(allocation.id, {
                        target_reference: event.target.value,
                      })
                    }
                    disabled={readOnly}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-blue-900"
                    placeholder="INV-2026-0001"
                  />
                </td>
                <td className="border-b border-slate-100 p-2 font-mono">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={allocation.applied_amount}
                    onChange={(event) =>
                      updateAllocation(allocation.id, {
                        applied_amount: Number(event.target.value),
                      })
                    }
                    disabled={readOnly}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-blue-900"
                  />
                </td>
                <td className="border-b border-slate-100 p-2">
                  <input
                    value={allocation.note ?? ""}
                    onChange={(event) =>
                      updateAllocation(allocation.id, { note: event.target.value })
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
            ))}
            {allocations.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="border-b border-slate-100 p-4 text-center text-slate-500"
                >
                  لا توجد تخصيصات بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 rounded-md bg-slate-50 p-3 font-mono text-sm text-slate-700">
        إجمالي التخصيصات: {allocationTotal.toFixed(2)}
      </p>
    </section>
  );
}
