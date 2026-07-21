import type {
  MaterialCategory,
  MaterialKind,
  MaterialListItem,
  UnitCatalogItem,
} from "@/modules/materials/types";

export const BULK_MATERIAL_IMPORT_MAX_ROWS = 200;

export interface BulkMaterialImportRow {
  id: string;
  name_ar: string;
  name_en: string;
  category_code: string;
  material_code: string;
  material_kind: string;
  purchase_price: string;
  sale_price: string;
  base_unit_code: string;
  preview_code: string;
  resolved_kind: MaterialKind;
  errors: string[];
}

export interface BulkCategoryImportRow {
  id: string;
  category_code: string;
  name_ar: string;
  name_en: string;
  parent_code: string;
  errors: string[];
}

export interface BulkMaterialImportColumn {
  key: keyof Pick<
    BulkMaterialImportRow,
    | "name_ar"
    | "name_en"
    | "category_code"
    | "material_code"
    | "material_kind"
    | "purchase_price"
    | "sale_price"
    | "base_unit_code"
  >;
  label: string;
  required?: boolean;
}

export interface BulkCategoryImportColumn {
  key: keyof Pick<
    BulkCategoryImportRow,
    "category_code" | "name_ar" | "name_en" | "parent_code"
  >;
  label: string;
  required?: boolean;
}

export const BULK_MATERIAL_IMPORT_COLUMNS: BulkMaterialImportColumn[] = [
  { key: "name_ar", label: "اسم عربي", required: true },
  { key: "name_en", label: "اسم EN" },
  { key: "category_code", label: "رمز الصنف" },
  { key: "material_code", label: "رمز المادة" },
  { key: "material_kind", label: "النوع" },
  { key: "purchase_price", label: "شراء" },
  { key: "sale_price", label: "بيع" },
  { key: "base_unit_code", label: "وحدة الأساس", required: true },
];

export const BULK_CATEGORY_IMPORT_COLUMNS: BulkCategoryImportColumn[] = [
  { key: "category_code", label: "رمز الصنف", required: true },
  { key: "name_ar", label: "اسم عربي", required: true },
  { key: "name_en", label: "اسم EN" },
  { key: "parent_code", label: "رمز الأب" },
];

export function createEmptyBulkMaterialRow(): BulkMaterialImportRow {
  return {
    id: crypto.randomUUID(),
    name_ar: "",
    name_en: "",
    category_code: "",
    material_code: "",
    material_kind: "",
    purchase_price: "",
    sale_price: "",
    base_unit_code: "",
    preview_code: "",
    resolved_kind: "normal",
    errors: [],
  };
}

export function createEmptyBulkCategoryRow(): BulkCategoryImportRow {
  return {
    id: crypto.randomUUID(),
    category_code: "",
    name_ar: "",
    name_en: "",
    parent_code: "",
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

function isMaterialHeaderRow(cells: string[]): boolean {
  const first = (cells[0] ?? "").trim().toLowerCase();
  return (
    first.includes("اسم") ||
    first.includes("name") ||
    first === "name_ar" ||
    first.includes("عربي")
  );
}

function isCategoryHeaderRow(cells: string[]): boolean {
  const first = (cells[0] ?? "").trim().toLowerCase();
  return (
    first.includes("رمز") ||
    first.includes("code") ||
    first === "category_code" ||
    first.includes("اسم")
  );
}

export function parseMaterialKind(value: string): MaterialKind | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "normal";
  if (
    ["عادية", "عادي", "normal", "n", "simple"].includes(normalized)
  ) {
    return "normal";
  }
  if (
    ["تجميعية", "تجميعي", "composite", "c", "bom", "kit"].includes(normalized)
  ) {
    return "composite";
  }
  return null;
}

export function parseBulkMaterialPaste(text: string): BulkMaterialImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsedLines = lines
    .map(parseDelimitedLine)
    .filter((cells) => cells.some((cell) => cell.length > 0));

  const dataLines =
    parsedLines.length > 0 && isMaterialHeaderRow(parsedLines[0])
      ? parsedLines.slice(1)
      : parsedLines;

  return dataLines.slice(0, BULK_MATERIAL_IMPORT_MAX_ROWS).map((cells) => ({
    id: crypto.randomUUID(),
    name_ar: cells[0] ?? "",
    name_en: cells[1] ?? "",
    category_code: (cells[2] ?? "").toUpperCase(),
    material_code: (cells[3] ?? "").toUpperCase(),
    material_kind: cells[4] ?? "",
    purchase_price: cells[5] ?? "",
    sale_price: cells[6] ?? "",
    base_unit_code: (cells[7] ?? "").toUpperCase(),
    preview_code: "",
    resolved_kind: "normal",
    errors: [],
  }));
}

export function parseBulkCategoryPaste(text: string): BulkCategoryImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsedLines = lines
    .map(parseDelimitedLine)
    .filter((cells) => cells.some((cell) => cell.length > 0));

  const dataLines =
    parsedLines.length > 0 && isCategoryHeaderRow(parsedLines[0])
      ? parsedLines.slice(1)
      : parsedLines;

  return dataLines.slice(0, BULK_MATERIAL_IMPORT_MAX_ROWS).map((cells) => ({
    id: crypto.randomUUID(),
    category_code: (cells[0] ?? "").toUpperCase(),
    name_ar: cells[1] ?? "",
    name_en: cells[2] ?? "",
    parent_code: (cells[3] ?? "").toUpperCase(),
    errors: [],
  }));
}

function parsePrice(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const normalized = trimmed.replace(/,/g, "");
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

export function validateBulkMaterialRows(
  rows: BulkMaterialImportRow[],
  materials: MaterialListItem[],
  categories: MaterialCategory[],
  units: UnitCatalogItem[],
): BulkMaterialImportRow[] {
  const categoryByCode = new Map(
    categories.map((category) => [
      category.category_code.toUpperCase(),
      category,
    ]),
  );
  const materialByCode = new Map(
    materials.map((material) => [
      material.material_code.toUpperCase(),
      material,
    ]),
  );
  const unitCodes = new Set(
    units.map((unit) => unit.unit_code.toUpperCase()),
  );

  const batchCodes = new Map<string, number>();
  const batchNames = new Map<string, number>();
  for (const row of rows) {
    const code = row.material_code.trim().toUpperCase();
    const name = normalizeName(row.name_ar);
    if (code) batchCodes.set(code, (batchCodes.get(code) ?? 0) + 1);
    if (name) batchNames.set(name, (batchNames.get(name) ?? 0) + 1);
  }

  return rows.map((row) => {
    const errors: string[] = [];
    const nameAr = normalizeName(row.name_ar);
    const categoryCode = row.category_code.trim().toUpperCase();
    const materialCode = row.material_code.trim().toUpperCase();
    const unitCode = row.base_unit_code.trim().toUpperCase();
    const kind = parseMaterialKind(row.material_kind);
    const purchase = parsePrice(row.purchase_price);
    const sale = parsePrice(row.sale_price);

    if (!nameAr) {
      errors.push("الاسم العربي مطلوب.");
    } else if (nameAr.length > 200) {
      errors.push("الاسم العربي يتجاوز 200 حرف.");
    }

    if (nameAr && (batchNames.get(nameAr) ?? 0) > 1) {
      errors.push("الاسم مكرر ضمن الدفعة.");
    }

    if (categoryCode && !categoryByCode.has(categoryCode)) {
      errors.push(`الصنف «${categoryCode}» غير موجود.`);
    }

    if (materialCode) {
      if (materialByCode.has(materialCode)) {
        errors.push(`رمز المادة «${materialCode}» موجود مسبقاً.`);
      }
      if ((batchCodes.get(materialCode) ?? 0) > 1) {
        errors.push("رمز المادة مكرر ضمن الدفعة.");
      }
    }

    if (kind == null) {
      errors.push("نوع المادة غير معروف (عادية/تجميعية).");
    }

    if (purchase == null) {
      errors.push("سعر الشراء غير صالح.");
    }
    if (sale == null) {
      errors.push("سعر البيع غير صالح.");
    }

    if (!unitCode) {
      errors.push("وحدة الأساس مطلوبة.");
    }

    // Missing unit codes are allowed — they will be created as PCS fallback on import.
    void unitCodes;

    return {
      ...row,
      name_ar: nameAr,
      name_en: row.name_en.trim(),
      category_code: categoryCode,
      material_code: materialCode,
      base_unit_code: unitCode,
      preview_code: materialCode,
      resolved_kind: kind ?? "normal",
      errors,
    };
  });
}

export function validateBulkCategoryRows(
  rows: BulkCategoryImportRow[],
  categories: MaterialCategory[],
): BulkCategoryImportRow[] {
  const categoryByCode = new Map(
    categories.map((category) => [
      category.category_code.toUpperCase(),
      category,
    ]),
  );

  const batchCodes = new Map<string, number>();
  for (const row of rows) {
    const code = row.category_code.trim().toUpperCase();
    if (code) batchCodes.set(code, (batchCodes.get(code) ?? 0) + 1);
  }

  return rows.map((row) => {
    const errors: string[] = [];
    const categoryCode = row.category_code.trim().toUpperCase();
    const nameAr = normalizeName(row.name_ar);
    const parentCode = row.parent_code.trim().toUpperCase();

    if (!categoryCode) {
      errors.push("رمز الصنف مطلوب.");
    } else if (categoryByCode.has(categoryCode)) {
      errors.push(`رمز الصنف «${categoryCode}» موجود مسبقاً.`);
    } else if ((batchCodes.get(categoryCode) ?? 0) > 1) {
      errors.push("رمز الصنف مكرر ضمن الدفعة.");
    }

    if (!nameAr) {
      errors.push("الاسم العربي مطلوب.");
    } else if (nameAr.length > 200) {
      errors.push("الاسم العربي يتجاوز 200 حرف.");
    }

    if (parentCode) {
      const parentInDb = categoryByCode.has(parentCode);
      const parentInBatch = rows.some(
        (item) =>
          item.id !== row.id &&
          item.category_code.trim().toUpperCase() === parentCode,
      );
      if (!parentInDb && !parentInBatch) {
        errors.push(`رمز الأب «${parentCode}» غير موجود.`);
      }
      if (parentCode === categoryCode) {
        errors.push("لا يمكن أن يكون الصنف أباً لنفسه.");
      }
    }

    return {
      ...row,
      category_code: categoryCode,
      name_ar: nameAr,
      name_en: row.name_en.trim(),
      parent_code: parentCode,
      errors,
    };
  });
}

export function buildBulkMaterialTemplateCsv(): string {
  const header = BULK_MATERIAL_IMPORT_COLUMNS.map((column) => column.label).join(
    "\t",
  );
  const sample = [
    "مادة تجريبية",
    "Sample Material",
    "CAT01",
    "",
    "عادية",
    "10",
    "15",
    "PCS",
  ].join("\t");
  return `${header}\n${sample}`;
}

export function buildBulkCategoryTemplateCsv(): string {
  const header = BULK_CATEGORY_IMPORT_COLUMNS.map((column) => column.label).join(
    "\t",
  );
  const sample = ["CAT01", "صنف تجريبي", "Sample Category", ""].join("\t");
  return `${header}\n${sample}`;
}
