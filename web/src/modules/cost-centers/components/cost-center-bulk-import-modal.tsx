"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { useNotifications } from "@/components/notifications";
import {
  costCenterApi,
  type CostCenterBulkInsertRow,
} from "@/modules/cost-centers/services/cost-center-api";
import {
  BULK_COST_CENTER_IMPORT_COLUMNS,
  BULK_COST_CENTER_IMPORT_MAX_ROWS,
  buildBulkCostCenterTemplateCsv,
  createEmptyBulkCostCenterRow,
  parseBulkCostCenterPaste,
  validateBulkCostCenterRows,
  type BulkCostCenterImportRow,
} from "@/modules/cost-centers/utils/bulk-import-cost-centers";
import type { CostCenter } from "@/modules/vouchers/types";

interface CostCenterBulkImportModalProps {
  open: boolean;
  centers: CostCenter[];
  isSaving: boolean;
  onClose: () => void;
  onImported: () => Promise<void>;
}

const STARTER_ROWS = 8;

function createStarterRows(): BulkCostCenterImportRow[] {
  return Array.from({ length: STARTER_ROWS }, () => createEmptyBulkCostCenterRow());
}

export function CostCenterBulkImportModal({
  open,
  centers,
  isSaving,
  onClose,
  onImported,
}: CostCenterBulkImportModalProps) {
  const { notifySuccess, notifyError, notifyWarning, notifyInfo } = useNotifications();
  const [rows, setRows] = useState<BulkCostCenterImportRow[]>(() => createStarterRows());
  const [validatedRows, setValidatedRows] = useState<BulkCostCenterImportRow[] | null>(
    null,
  );
  const [isImporting, setIsImporting] = useState(false);

  const displayRows = validatedRows ?? rows;
  const validRows = useMemo(
    () => displayRows.filter((row) => row.errors.length === 0 && row.name_ar.trim()),
    [displayRows],
  );
  const invalidRows = useMemo(
    () => displayRows.filter((row) => row.errors.length > 0),
    [displayRows],
  );

  const resetState = () => {
    setRows(createStarterRows());
    setValidatedRows(null);
  };

  const handleClose = () => {
    if (isImporting) return;
    resetState();
    onClose();
  };

  const updateRow = (
    rowId: string,
    key: keyof Pick<BulkCostCenterImportRow, "name_ar" | "name_en" | "sub_code">,
    value: string,
  ) => {
    setValidatedRows(null);
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [key]: value,
              preview_code: "",
              errors: [],
            }
          : row,
      ),
    );
  };

  const addRow = () => {
    if (rows.length >= BULK_COST_CENTER_IMPORT_MAX_ROWS) {
      notifyError(`الحد الأقصى ${BULK_COST_CENTER_IMPORT_MAX_ROWS} صف في الدفعة.`);
      return;
    }
    setValidatedRows(null);
    setRows((current) => [...current, createEmptyBulkCostCenterRow()]);
  };

  const clearRows = () => {
    setValidatedRows(null);
    setRows(createStarterRows());
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        notifyError("الحافظة فارغة.");
        return;
      }
      const parsed = parseBulkCostCenterPaste(text);
      if (parsed.length === 0) {
        notifyError("لم يُعثر على صفوف صالحة في اللصق.");
        return;
      }
      setRows(parsed);
      setValidatedRows(null);
      notifyInfo(`تم لصق ${parsed.length} صف. اضغط «تحقق» قبل الاستيراد.`);
    } catch {
      notifyError("تعذّر قراءة الحافظة. تأكد من السماح للمتصفح بالوصول إليها.");
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([buildBulkCostCenterTemplateCsv()], {
      type: "text/tab-separated-values;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "cost-centers-import-template.tsv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleValidate = () => {
    const nonEmptyRows = rows.filter(
      (row) => row.name_ar.trim() || row.name_en.trim() || row.sub_code.trim(),
    );

    if (nonEmptyRows.length === 0) {
      notifyError("أدخل صفاً واحداً على الأقل.");
      setValidatedRows([]);
      return;
    }

    if (nonEmptyRows.length > BULK_COST_CENTER_IMPORT_MAX_ROWS) {
      notifyError(`الحد الأقصى ${BULK_COST_CENTER_IMPORT_MAX_ROWS} صف في الدفعة.`);
      return;
    }

    const validated = validateBulkCostCenterRows(nonEmptyRows, centers);
    setValidatedRows(validated);
    setRows(validated);

    const validCount = validated.filter((row) => row.errors.length === 0).length;
    const errorCount = validated.length - validCount;
    if (errorCount === 0) {
      notifySuccess(`${validCount} مركز كلفة جاهز للاستيراد.`);
    } else {
      notifyWarning(`${validCount} جاهز — ${errorCount} بأخطاء`);
    }
  };

  const handleImport = async () => {
    const sourceRows = validatedRows ?? rows;
    const validated = validateBulkCostCenterRows(
      sourceRows.filter(
        (row) => row.name_ar.trim() || row.name_en.trim() || row.sub_code.trim(),
      ),
      centers,
    );
    setValidatedRows(validated);
    setRows(validated);

    const importable = validated.filter((row) => row.errors.length === 0);
    if (importable.length === 0) {
      notifyError("لا توجد صفوف صالحة للاستيراد. نفّذ «تحقق» وأصلح الأخطاء.");
      return;
    }

    const payload: CostCenterBulkInsertRow[] = importable.map((row) => ({
      name_ar: row.name_ar,
      name_en: row.name_en || null,
      sub_code: row.sub_code || null,
    }));

    setIsImporting(true);
    try {
      const created = await costCenterApi.createCostCentersBulk(payload);
      await onImported();
      notifySuccess(`تم إضافة ${created.length} مركز كلفة بنجاح.`);
      resetState();
      onClose();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "فشل الاستيراد.");
    } finally {
      setIsImporting(false);
    }
  };

  const busy = isSaving || isImporting;

  return (
    <Modal
      open={open}
      size="xl"
      title="إضافة مراكز كلفة دفعة واحدة"
      description="انسخ من Excel والصق، أو عدّل الجدول مباشرة. كود النظام (CC-xxx) يُولَّد تلقائياً لكل صف."
      onClose={handleClose}
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handlePasteFromClipboard()}
            className="rounded-md bg-blue-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            لصق من Excel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleDownloadTemplate}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-60"
          >
            تحميل قالب
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={addRow}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-60"
          >
            + صف
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={clearRows}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-60"
          >
            مسح الكل
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-[720px] w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="border border-slate-200 p-2 text-center">#</th>
                {BULK_COST_CENTER_IMPORT_COLUMNS.map((column) => (
                  <th key={column.key} className="border border-slate-200 p-2 text-right">
                    {column.label}
                    {column.required ? " *" : ""}
                  </th>
                ))}
                <th className="border border-slate-200 p-2 text-right">كود النظام</th>
                <th className="border border-slate-200 p-2 text-right">التحقق</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, index) => (
                <tr
                  key={row.id}
                  className={
                    row.errors.length > 0
                      ? "bg-rose-50/80"
                      : row.name_ar.trim()
                        ? "bg-emerald-50/40"
                        : "bg-white"
                  }
                >
                  <td className="border border-slate-100 p-2 text-center text-slate-500">
                    {index + 1}
                  </td>
                  {BULK_COST_CENTER_IMPORT_COLUMNS.map((column) => (
                    <td key={column.key} className="border border-slate-100 p-1">
                      <input
                        value={String(row[column.key] ?? "")}
                        disabled={busy}
                        onChange={(event) =>
                          updateRow(row.id, column.key, event.target.value)
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1.5"
                        dir={
                          column.key === "name_en" || column.key === "sub_code"
                            ? "ltr"
                            : undefined
                        }
                      />
                    </td>
                  ))}
                  <td className="border border-slate-100 p-2 font-mono text-slate-700">
                    {row.preview_code || "—"}
                  </td>
                  <td className="border border-slate-100 p-2 text-rose-700">
                    {row.errors.length > 0 ? (
                      <ul className="space-y-1">
                        {row.errors.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    ) : row.name_ar.trim() ? (
                      <span className="text-emerald-700">✓</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p>الأعمدة بالترتيب: اسم عربي، اسم EN، كود فرعي (اختياري).</p>
          <p className="mt-1">
            الحد الأقصى {BULK_COST_CENTER_IMPORT_MAX_ROWS} صف. لا يُسمح بتكرار الاسم
            العربي داخل الدفعة أو مع مراكز موجودة.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            جاهز للاستيراد: {validRows.length}
            {invalidRows.length > 0 ? ` — أخطاء: ${invalidRows.length}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm disabled:opacity-60"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleValidate}
              className="rounded-md border border-amber-300 px-4 py-2 text-sm text-amber-900 disabled:opacity-60"
            >
              تحقق
            </button>
            <button
              type="button"
              disabled={busy || validRows.length === 0}
              onClick={() => void handleImport()}
              className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {isImporting ? "جاري الإضافة..." : `إضافة ${validRows.length || ""}`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
