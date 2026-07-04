import { generateCostCenterCode } from "@/modules/cost-centers/utils/generate-cost-center-code";
import type { CostCenter } from "@/modules/vouchers/types";

export const BULK_COST_CENTER_IMPORT_MAX_ROWS = 150;

export interface BulkCostCenterImportRow {
  id: string;
  name_ar: string;
  name_en: string;
  sub_code: string;
  preview_code: string;
  errors: string[];
}

export interface BulkCostCenterImportColumn {
  key: keyof Pick<BulkCostCenterImportRow, "name_ar" | "name_en" | "sub_code">;
  label: string;
  required?: boolean;
}

export const BULK_COST_CENTER_IMPORT_COLUMNS: BulkCostCenterImportColumn[] = [
  { key: "name_ar", label: "اسم عربي", required: true },
  { key: "name_en", label: "اسم EN" },
  { key: "sub_code", label: "كود فرعي" },
];

export function createEmptyBulkCostCenterRow(): BulkCostCenterImportRow {
  return {
    id: crypto.randomUUID(),
    name_ar: "",
    name_en: "",
    sub_code: "",
    preview_code: "",
    errors: [],
  };
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function parseDelimitedLine(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t").map((cell) => cell.trim());
  }
  return line.split(",").map((cell) => cell.trim());
}

function isHeaderRow(cells: string[]): boolean {
  const first = (cells[0] ?? "").trim().toLowerCase();
  return (
    first.includes("اسم") ||
    first.includes("name") ||
    first === "name_ar" ||
    first.includes("عربي")
  );
}

export function parseBulkCostCenterPaste(text: string): BulkCostCenterImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsedLines = lines.map(parseDelimitedLine).filter((cells) =>
    cells.some((cell) => cell.length > 0),
  );

  const dataLines =
    parsedLines.length > 0 && isHeaderRow(parsedLines[0])
      ? parsedLines.slice(1)
      : parsedLines;

  return dataLines.slice(0, BULK_COST_CENTER_IMPORT_MAX_ROWS).map((cells) => ({
    id: crypto.randomUUID(),
    name_ar: cells[0] ?? "",
    name_en: cells[1] ?? "",
    sub_code: cells[2] ?? "",
    preview_code: "",
    errors: [],
  }));
}

function assignPreviewCodes(
  rows: BulkCostCenterImportRow[],
  existingCenters: CostCenter[],
): BulkCostCenterImportRow[] {
  let working = [...existingCenters];

  return rows.map((row) => {
    if (!row.name_ar.trim() || row.errors.length > 0) {
      return { ...row, preview_code: "" };
    }

    const preview_code = generateCostCenterCode(working);
    working = [
      ...working,
      {
        id: row.id,
        code: preview_code,
        name_ar: row.name_ar,
        name_en: row.name_en || null,
        sub_code: row.sub_code || null,
        is_active: true,
      },
    ];

    return { ...row, preview_code };
  });
}

export function validateBulkCostCenterRows(
  rows: BulkCostCenterImportRow[],
  existingCenters: CostCenter[],
): BulkCostCenterImportRow[] {
  const existingNames = new Set(
    existingCenters.map((center) => normalizeName(center.name_ar).toLowerCase()),
  );
  const batchNames = new Map<string, number>();
  const batchSubCodes = new Map<string, number>();

  const validated = rows.map((row) => {
    const errors: string[] = [];
    const nameAr = normalizeName(row.name_ar);
    const nameEn = row.name_en.trim();
    const subCode = row.sub_code.trim();

    if (!nameAr) {
      errors.push("الاسم العربي مطلوب.");
    } else {
      const nameKey = nameAr.toLowerCase();
      if (existingNames.has(nameKey)) {
        errors.push("اسم عربي موجود مسبقاً في النظام.");
      }
      const batchCount = (batchNames.get(nameKey) ?? 0) + 1;
      batchNames.set(nameKey, batchCount);
      if (batchCount > 1) {
        errors.push("تكرار الاسم العربي داخل الدفعة.");
      }
    }

    if (nameEn.length > 200) {
      errors.push("الاسم الإنجليزي طويل جداً.");
    }

    if (subCode.length > 30) {
      errors.push("الكود الفرعي يتجاوز 30 حرفاً.");
    } else if (subCode) {
      const subKey = subCode.toLowerCase();
      const subCount = (batchSubCodes.get(subKey) ?? 0) + 1;
      batchSubCodes.set(subKey, subCount);
      if (subCount > 1) {
        errors.push("تكرار الكود الفرعي داخل الدفعة.");
      }
    }

    return {
      ...row,
      name_ar: nameAr,
      name_en: nameEn,
      sub_code: subCode,
      errors,
      preview_code: "",
    };
  });

  return assignPreviewCodes(validated, existingCenters);
}

export function buildBulkCostCenterTemplateCsv(): string {
  const header = BULK_COST_CENTER_IMPORT_COLUMNS.map((column) => column.label).join(
    "\t",
  );
  const sample = ["مشروع أ", "Project A", "PRJ-A"].join("\t");
  return `${header}\n${sample}\n`;
}
