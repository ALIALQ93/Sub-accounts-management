"use client";

import type { BranchOption } from "@/modules/branches/services/branch-api";
import type { CostCenter, OpenMovementFilters, OpenSide } from "@/modules/vouchers/types";

interface CloseMovementFiltersBarProps {
  filters: OpenMovementFilters;
  branches: BranchOption[];
  costCenters: CostCenter[];
  defaultOpenSide: OpenSide;
  onChange: (filters: OpenMovementFilters) => void;
  disabled?: boolean;
}

const SIDE_OPTIONS: Array<{ value: OpenSide | "all"; label: string }> = [
  { value: "all", label: "الكل" },
  { value: "debit", label: "مدين" },
  { value: "credit", label: "دائن" },
];

export function CloseMovementFiltersBar({
  filters,
  branches,
  costCenters,
  defaultOpenSide,
  onChange,
  disabled = false,
}: CloseMovementFiltersBarProps) {
  const patch = (next: Partial<OpenMovementFilters>) => {
    onChange({ ...filters, ...next });
  };

  return (
    <section className="rounded-lg border border-violet-200 bg-violet-50/50 p-4">
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-violet-950">فلاتر الحركات المفتوحة</h2>
        <p className="mt-0.5 text-xs text-violet-900/80">
          من <code className="text-[10px]">open_items_view</code> — فرع، CC، مدين/دائن،
          استحقاق
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">الفرع</span>
          <select
            value={filters.branchId ?? ""}
            onChange={(event) =>
              patch({ branchId: event.target.value || undefined })
            }
            disabled={disabled}
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="">كل الفروع</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.branch_code} — {branch.name_ar}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">مركز الكلف</span>
          <select
            value={filters.costCenterId ?? ""}
            onChange={(event) =>
              patch({ costCenterId: event.target.value || undefined })
            }
            disabled={disabled}
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="">كل المراكز</option>
            {costCenters.map((center) => (
              <option key={center.id} value={center.id}>
                {center.code} — {center.name_ar}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">جانب الرصيد</span>
          <select
            value={filters.openSide ?? defaultOpenSide}
            onChange={(event) =>
              patch({
                openSide: event.target.value as OpenSide | "all",
              })
            }
            disabled={disabled}
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          >
            {SIDE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col justify-end gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.eligibleOnly ?? false}
              onChange={(event) =>
                patch({ eligibleOnly: event.target.checked || undefined })
              }
              disabled={disabled}
            />
            <span>مؤهل للتسديد فقط</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.overdueOnly ?? false}
              onChange={(event) =>
                patch({ overdueOnly: event.target.checked || undefined })
              }
              disabled={disabled}
            />
            <span>متأخر الاستحقاق فقط</span>
          </label>
        </div>
      </div>
    </section>
  );
}
