"use client";

import { downloadCsv } from "@/lib/export-csv";

interface ExportCsvButtonProps {
  filename: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  disabled?: boolean;
  label?: string;
}

export function ExportCsvButton({
  filename,
  headers,
  rows,
  disabled = false,
  label = "تصدير Excel (CSV)",
}: ExportCsvButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || rows.length === 0}
      onClick={() => downloadCsv(filename, headers, rows)}
      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
