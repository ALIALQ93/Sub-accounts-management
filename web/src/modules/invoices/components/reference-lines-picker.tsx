"use client";

import { useEffect, useState } from "react";
import type { InvoiceMaterialLine } from "@/modules/invoices/types";

export interface ReferenceLinePickRow {
  line: InvoiceMaterialLine;
  selected: boolean;
  loadQty: number;
}

interface ReferenceLinesPickerProps {
  open: boolean;
  lines: InvoiceMaterialLine[];
  onClose: () => void;
  onConfirm: (selected: Array<{ line: InvoiceMaterialLine; quantity: number }>) => void;
}

export function ReferenceLinesPicker({
  open,
  lines,
  onClose,
  onConfirm,
}: ReferenceLinesPickerProps) {
  const [rows, setRows] = useState<ReferenceLinePickRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setRows(
      lines.map((line) => ({
        line,
        selected: true,
        loadQty: line.quantity,
      })),
    );
  }, [open, lines]);

  if (!open) return null;

  const toggle = (lineId: string, patch: Partial<Pick<ReferenceLinePickRow, "selected" | "loadQty">>) => {
    setRows((current) =>
      current.map((row) =>
        row.line.id === lineId ? { ...row, ...patch } : row,
      ),
    );
  };

  const handleConfirm = () => {
    const selected = rows
      .filter((row) => row.selected && row.loadQty > 0)
      .map((row) => ({ line: row.line, quantity: row.loadQty }));
    onConfirm(selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">اختيار أسطر من المرجع</h2>
          <p className="text-xs text-slate-600">
            حدّد الأسطر والكميات — لا تتجاوز كمية الفاتورة المرجعية.
          </p>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr className="text-right text-slate-700">
                <th className="border border-slate-200 p-2">تحميل</th>
                <th className="border border-slate-200 p-2">#</th>
                <th className="border border-slate-200 p-2">المادة</th>
                <th className="border border-slate-200 p-2">الوحدة</th>
                <th className="border border-slate-200 p-2">كمية المرجع</th>
                <th className="border border-slate-200 p-2">كمية التحميل</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.line.id} className="odd:bg-white even:bg-slate-50/60">
                  <td className="border border-slate-100 p-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={(e) =>
                        toggle(row.line.id, { selected: e.target.checked })
                      }
                    />
                  </td>
                  <td className="border border-slate-100 p-2">{row.line.line_no}</td>
                  <td className="border border-slate-100 p-2">
                    {row.line.material_name_ar ?? row.line.material_id}
                  </td>
                  <td className="border border-slate-100 p-2">
                    {row.line.unit_name_ar ?? "—"}
                  </td>
                  <td className="border border-slate-100 p-2 font-mono">
                    {row.line.quantity}
                  </td>
                  <td className="border border-slate-100 p-2">
                    <input
                      type="number"
                      min={0}
                      max={row.line.quantity}
                      step="any"
                      disabled={!row.selected}
                      className="w-full rounded-md border border-slate-300 px-2 py-1"
                      value={row.loadQty}
                      onChange={(e) =>
                        toggle(row.line.id, {
                          loadQty: Math.min(
                            row.line.quantity,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-md bg-blue-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            تحميل المحدد
          </button>
        </div>
      </div>
    </div>
  );
}
