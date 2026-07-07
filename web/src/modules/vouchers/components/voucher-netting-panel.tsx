"use client";

import type { ReactNode } from "react";
import type { BranchOption } from "@/modules/branches/services/branch-api";
import type { CostCenter, VoucherNettingLine } from "@/modules/vouchers/types";
import { buildEmptyNettingLine } from "@/modules/vouchers/utils/validate-voucher-netting";

interface VoucherNettingPanelProps {
  lines: VoucherNettingLine[];
  costCenters: CostCenter[];
  branches: BranchOption[];
  readOnly: boolean;
  onChange: (lines: VoucherNettingLine[]) => void;
}

function resolveIncludesCashDefault(
  ccId: string | null | undefined,
  costCenters: CostCenter[],
): boolean {
  if (!ccId) return false;
  const center = costCenters.find((item) => item.id === ccId);
  return center?.netting_includes_cash_default ?? false;
}

export function VoucherNettingPanel({
  lines,
  costCenters,
  branches,
  readOnly,
  onChange,
}: VoucherNettingPanelProps) {
  const ccLines = lines.filter((line) => line.netting_kind === "cc");
  const branchLines = lines.filter((line) => line.netting_kind === "branch");

  const updateLine = (id: string, patch: Partial<VoucherNettingLine>) => {
    onChange(
      lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  };

  const removeLine = (id: string) => {
    onChange(lines.filter((line) => line.id !== id));
  };

  const addLine = (kind: VoucherNettingLine["netting_kind"]) => {
    onChange([...lines, buildEmptyNettingLine(kind)]);
  };

  const nettingTotal = lines.reduce(
    (sum, line) => sum + Number(line.amount || 0),
    0,
  );

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-amber-950">مقاصة CC / فرع</h2>
          <p className="mt-0.5 text-xs text-amber-900/80">
            تسوية بين مراكز كلف أو فروع — يتطلب{" "}
            <code className="text-[10px]">patch_settlement_foundation.sql</code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => addLine("cc")}
            disabled={readOnly}
            className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 disabled:opacity-50"
          >
            + مقاصة CC
          </button>
          <button
            type="button"
            onClick={() => addLine("branch")}
            disabled={readOnly}
            className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 disabled:opacity-50"
          >
            + مقاصة فرع
          </button>
        </div>
      </div>

      {ccLines.length > 0 && (
        <NettingTable
          title="مقاصة مراكز الكلف"
          readOnly={readOnly}
          lines={ccLines}
          renderFrom={(line) => (
            <select
              value={line.from_cc_id ?? ""}
              onChange={(event) => {
                const fromCcId = event.target.value || null;
                updateLine(line.id, {
                  from_cc_id: fromCcId,
                  includes_cash: resolveIncludesCashDefault(
                    fromCcId,
                    costCenters,
                  ),
                });
              }}
              disabled={readOnly}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">من CC</option>
              {costCenters.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.code}
                </option>
              ))}
            </select>
          )}
          renderTo={(line) => (
            <select
              value={line.to_cc_id ?? ""}
              onChange={(event) =>
                updateLine(line.id, {
                  to_cc_id: event.target.value || null,
                })
              }
              disabled={readOnly}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">إلى CC</option>
              {costCenters.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.code}
                </option>
              ))}
            </select>
          )}
          onAmountChange={(line, amount) =>
            updateLine(line.id, { amount })
          }
          onIncludesCashChange={(line, includesCash) =>
            updateLine(line.id, { includes_cash: includesCash })
          }
          onNoteChange={(line, note) => updateLine(line.id, { note })}
          onRemove={(line) => removeLine(line.id)}
        />
      )}

      {branchLines.length > 0 && (
        <NettingTable
          title="مقاصة الفروع"
          readOnly={readOnly}
          lines={branchLines}
          className="mt-4"
          renderFrom={(line) => (
            <select
              value={line.from_branch_id ?? ""}
              onChange={(event) =>
                updateLine(line.id, {
                  from_branch_id: event.target.value || null,
                })
              }
              disabled={readOnly}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">من فرع</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branch_code}
                </option>
              ))}
            </select>
          )}
          renderTo={(line) => (
            <select
              value={line.to_branch_id ?? ""}
              onChange={(event) =>
                updateLine(line.id, {
                  to_branch_id: event.target.value || null,
                })
              }
              disabled={readOnly}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">إلى فرع</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branch_code}
                </option>
              ))}
            </select>
          )}
          onAmountChange={(line, amount) =>
            updateLine(line.id, { amount })
          }
          onIncludesCashChange={(line, includesCash) =>
            updateLine(line.id, { includes_cash: includesCash })
          }
          onNoteChange={(line, note) => updateLine(line.id, { note })}
          onRemove={(line) => removeLine(line.id)}
        />
      )}

      {lines.length === 0 && (
        <p className="text-sm text-amber-900/70">
          لا توجد أسطر مقاصة — أضف مقاصة CC أو فرع عند الحاجة.
        </p>
      )}

      {lines.length > 0 && (
        <p className="mt-3 font-mono tabular-nums text-sm text-amber-950">
          إجمالي المقاصة: {nettingTotal.toFixed(2)}
        </p>
      )}
    </section>
  );
}

interface NettingTableProps {
  title: string;
  lines: VoucherNettingLine[];
  readOnly: boolean;
  className?: string;
  renderFrom: (line: VoucherNettingLine) => ReactNode;
  renderTo: (line: VoucherNettingLine) => ReactNode;
  onAmountChange: (line: VoucherNettingLine, amount: number) => void;
  onIncludesCashChange: (line: VoucherNettingLine, value: boolean) => void;
  onNoteChange: (line: VoucherNettingLine, note: string) => void;
  onRemove: (line: VoucherNettingLine) => void;
}

function NettingTable({
  title,
  lines,
  readOnly,
  className = "",
  renderFrom,
  renderTo,
  onAmountChange,
  onIncludesCashChange,
  onNoteChange,
  onRemove,
}: NettingTableProps) {
  return (
    <div className={className}>
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-white/70">
            <tr className="text-right text-slate-700">
              <th className="border-b border-amber-200 p-2">من</th>
              <th className="border-b border-amber-200 p-2">إلى</th>
              <th className="border-b border-amber-200 p-2">المبلغ</th>
              <th className="border-b border-amber-200 p-2">يشمل نقداً</th>
              <th className="border-b border-amber-200 p-2">ملاحظة</th>
              <th className="border-b border-amber-200 p-2">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="odd:bg-white even:bg-amber-50/30">
                <td className="border-b border-amber-100 p-2">{renderFrom(line)}</td>
                <td className="border-b border-amber-100 p-2">{renderTo(line)}</td>
                <td className="border-b border-amber-100 p-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.amount}
                    onChange={(event) =>
                      onAmountChange(line, Math.max(0, Number(event.target.value)))
                    }
                    disabled={readOnly}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 font-mono tabular-nums"
                  />
                </td>
                <td className="border-b border-amber-100 p-2 text-center">
                  <input
                    type="checkbox"
                    checked={line.includes_cash}
                    onChange={(event) =>
                      onIncludesCashChange(line, event.target.checked)
                    }
                    disabled={readOnly}
                  />
                </td>
                <td className="border-b border-amber-100 p-2">
                  <input
                    value={line.note ?? ""}
                    onChange={(event) => onNoteChange(line, event.target.value)}
                    disabled={readOnly}
                    className="w-full rounded-md border border-slate-300 px-2 py-1"
                    placeholder="ملاحظة"
                  />
                </td>
                <td className="border-b border-amber-100 p-2">
                  <button
                    type="button"
                    onClick={() => onRemove(line)}
                    disabled={readOnly}
                    className="btn btn-sm btn-outline text-[var(--danger)] disabled:opacity-50"
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
