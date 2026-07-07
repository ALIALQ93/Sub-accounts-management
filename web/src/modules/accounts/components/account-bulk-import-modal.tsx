"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import {
  BULK_ACCOUNT_IMPORT_COLUMNS,
  BULK_ACCOUNT_IMPORT_MAX_ROWS,
  buildBulkImportTemplateCsv,
  createEmptyBulkImportRow,
  parseBulkAccountPaste,
  resolveBulkRowCurrencyId,
  validateBulkAccountRows,
  type BulkAccountImportRow,
} from "@/modules/accounts/utils/bulk-import-accounts";
import { generateAccountCode } from "@/modules/accounts/utils/generate-account-code";
import type { Currency } from "@/modules/currencies/types";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account } from "@/modules/vouchers/types";

interface AccountBulkImportModalProps {
  open: boolean;
  accounts: Account[];
  accountsWithMovements?: ReadonlySet<string>;
  currencies: Currency[];
  isSaving: boolean;
  onClose: () => void;
  onImported: () => Promise<void>;
}

const STARTER_ROWS = 8;

function createStarterRows(): BulkAccountImportRow[] {
  return Array.from({ length: STARTER_ROWS }, () => createEmptyBulkImportRow());
}

export function AccountBulkImportModal({
  open,
  accounts,
  accountsWithMovements,
  currencies,
  isSaving,
  onClose,
  onImported,
}: AccountBulkImportModalProps) {
  const [rows, setRows] = useState<BulkAccountImportRow[]>(() => createStarterRows());
  const [validatedRows, setValidatedRows] = useState<BulkAccountImportRow[] | null>(
    null,
  );
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
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
    setFeedback("");
    setError("");
  };

  const handleClose = () => {
    if (isImporting) return;
    resetState();
    onClose();
  };

  const updateRow = (
    rowId: string,
    key: keyof BulkAccountImportRow,
    value: string | boolean,
  ) => {
    setValidatedRows(null);
    setFeedback("");
    setError("");
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
    if (rows.length >= BULK_ACCOUNT_IMPORT_MAX_ROWS) {
      setError(`الحد الأقصى ${BULK_ACCOUNT_IMPORT_MAX_ROWS} صف في الدفعة.`);
      return;
    }
    setValidatedRows(null);
    setRows((current) => [...current, createEmptyBulkImportRow()]);
  };

  const clearRows = () => {
    setValidatedRows(null);
    setFeedback("");
    setError("");
    setRows(createStarterRows());
  };

  const handlePasteFromClipboard = async () => {
    setError("");
    setFeedback("");
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setError("الحافظة فارغة.");
        return;
      }
      const parsed = parseBulkAccountPaste(text);
      if (parsed.length === 0) {
        setError("لم يُعثر على صفوف صالحة في اللصق.");
        return;
      }
      setRows(parsed);
      setValidatedRows(null);
      setFeedback(`تم لصق ${parsed.length} صف. اضغط «تحقق» قبل الاستيراد.`);
    } catch {
      setError("تعذّر قراءة الحافظة. تأكد من السماح للمتصفح بالوصول إليها.");
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([buildBulkImportTemplateCsv()], {
      type: "text/tab-separated-values;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "accounts-import-template.tsv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleValidate = () => {
    setError("");
    setFeedback("");
    const nonEmptyRows = rows.filter(
      (row) =>
        row.name_ar.trim() ||
        row.parent_code.trim() ||
        row.name_en.trim() ||
        row.sub_code.trim() ||
        row.currency_code.trim(),
    );

    if (nonEmptyRows.length === 0) {
      setError("أدخل صفاً واحداً على الأقل.");
      setValidatedRows([]);
      return;
    }

    if (nonEmptyRows.length > BULK_ACCOUNT_IMPORT_MAX_ROWS) {
      setError(`الحد الأقصى ${BULK_ACCOUNT_IMPORT_MAX_ROWS} صف في الدفعة.`);
      return;
    }

    const validated = validateBulkAccountRows(
      nonEmptyRows,
      accounts,
      currencies,
      accountsWithMovements,
    );
    setValidatedRows(validated);
    setRows(validated);

    const validCount = validated.filter((row) => row.errors.length === 0).length;
    const errorCount = validated.length - validCount;
    if (errorCount === 0) {
      setFeedback(`✓ ${validCount} حساب جاهز للاستيراد.`);
    } else {
      setFeedback(`جاهز: ${validCount} — أخطاء: ${errorCount}`);
    }
  };

  const handleImport = async () => {
    setError("");
    setFeedback("");

    const sourceRows = validatedRows ?? rows;
    const validated = validateBulkAccountRows(
      sourceRows.filter((row) => row.name_ar.trim() || row.parent_code.trim()),
      accounts,
      currencies,
      accountsWithMovements,
    );
    setValidatedRows(validated);
    setRows(validated);

    const importable = validated.filter((row) => row.errors.length === 0);
    if (importable.length === 0) {
      setError("لا توجد صفوف صالحة للاستيراد. نفّذ «تحقق» وأصلح الأخطاء.");
      return;
    }

    setIsImporting(true);
    let workingAccounts = [...accounts];
    let importedCount = 0;

    try {
      for (const row of importable) {
        const parent = workingAccounts.find(
          (account) => account.code === row.parent_code,
        );
        if (!parent) {
          throw new Error(`تعذّر العثور على الأب «${row.parent_code}».`);
        }

        const code = generateAccountCode(parent, workingAccounts);
        const currencyId = resolveBulkRowCurrencyId(
          row,
          workingAccounts,
          currencies,
        );

        const created = await voucherApi.createAccount({
          code,
          sub_code: row.sub_code || null,
          name_ar: row.name_ar,
          name_en: row.name_en || null,
          parent_id: parent.id,
          currency_id: currencyId,
          is_postable: row.is_postable,
          is_active: true,
        });

        workingAccounts = [...workingAccounts, created];
        importedCount += 1;
      }

      await onImported();
      setFeedback(`تم استيراد ${importedCount} حساب بنجاح.`);
      resetState();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message}${importedCount > 0 ? ` (تم استيراد ${importedCount} قبل التوقف)` : ""}`
          : "فشل الاستيراد.",
      );
      if (importedCount > 0) {
        await onImported();
      }
    } finally {
      setIsImporting(false);
    }
  };

  const busy = isSaving || isImporting;

  return (
    <Modal
      open={open}
      size="xl"
      title="إضافة حسابات دفعة واحدة"
      description="انسخ من Excel والصق، أو عدّل الجدول مباشرة. يُمنع تكرار الاسم العربي على مستوى الدليل كله."
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
          <table className="min-w-[980px] w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="border border-slate-200 p-2 text-center">#</th>
                {BULK_ACCOUNT_IMPORT_COLUMNS.map((column) => (
                  <th key={column.key} className="border border-slate-200 p-2 text-right">
                    {column.label}
                    {column.required ? " *" : ""}
                  </th>
                ))}
                <th className="border border-slate-200 p-2 text-right">كود متوقع</th>
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
                  {BULK_ACCOUNT_IMPORT_COLUMNS.map((column) => (
                    <td key={column.key} className="border border-slate-100 p-1">
                      {column.key === "is_postable" ? (
                        <select
                          value={row.is_postable ? "yes" : "no"}
                          disabled={busy}
                          onChange={(event) =>
                            updateRow(row.id, "is_postable", event.target.value === "yes")
                          }
                          className="w-full rounded border border-slate-200 px-2 py-1.5"
                        >
                          <option value="yes">نعم</option>
                          <option value="no">لا</option>
                        </select>
                      ) : (
                        <input
                          value={String(row[column.key] ?? "")}
                          disabled={busy}
                          onChange={(event) =>
                            updateRow(row.id, column.key, event.target.value)
                          }
                          className="w-full rounded border border-slate-200 px-2 py-1.5"
                          dir={
                            column.key === "name_en" ||
                            column.key === "parent_code" ||
                            column.key === "sub_code" ||
                            column.key === "currency_code"
                              ? "ltr"
                              : undefined
                          }
                        />
                      )}
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
          <p>
            الأعمدة بالترتيب: اسم عربي، اسم EN، كود الأب، كود فرعي، عملة (IQD/USD…)،
            قابل للترحيل (نعم/لا).
          </p>
          <p className="mt-1">
            كود الحساب في النظام يُولَّد تلقائياً. الحد الأقصى {BULK_ACCOUNT_IMPORT_MAX_ROWS}{" "}
            صف.
          </p>
        </div>

        {feedback && (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {feedback}
          </p>
        )}
        {error && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

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
              {isImporting ? "جاري الاستيراد..." : `استيراد ${validRows.length || ""}`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
