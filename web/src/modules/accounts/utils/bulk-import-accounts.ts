import type { Currency } from "@/modules/currencies/types";
import { getDefaultCurrencyId } from "@/modules/accounts/utils/compute-account-balances";
import { generateAccountCode } from "@/modules/accounts/utils/generate-account-code";
import type { Account } from "@/modules/vouchers/types";

export const BULK_ACCOUNT_IMPORT_MAX_ROWS = 200;

export interface BulkAccountImportRow {
  id: string;
  name_ar: string;
  name_en: string;
  parent_code: string;
  sub_code: string;
  currency_code: string;
  is_postable: boolean;
  preview_code: string;
  errors: string[];
}

export interface BulkAccountImportColumn {
  key: keyof Pick<
    BulkAccountImportRow,
    "name_ar" | "name_en" | "parent_code" | "sub_code" | "currency_code" | "is_postable"
  >;
  label: string;
  required?: boolean;
}

export const BULK_ACCOUNT_IMPORT_COLUMNS: BulkAccountImportColumn[] = [
  { key: "name_ar", label: "اسم عربي", required: true },
  { key: "name_en", label: "اسم EN" },
  { key: "parent_code", label: "كود الأب", required: true },
  { key: "sub_code", label: "كود فرعي" },
  { key: "currency_code", label: "عملة" },
  { key: "is_postable", label: "قابل للترحيل" },
];

export function createEmptyBulkImportRow(): BulkAccountImportRow {
  return {
    id: crypto.randomUUID(),
    name_ar: "",
    name_en: "",
    parent_code: "",
    sub_code: "",
    currency_code: "",
    is_postable: true,
    preview_code: "",
    errors: [],
  };
}

function normalizeAccountName(name: string): string {
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

function parsePostable(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (["نعم", "yes", "true", "1", "y"].includes(normalized)) return true;
  if (["لا", "no", "false", "0", "n"].includes(normalized)) return false;
  return true;
}

function parsePostableLabel(value: boolean): string {
  return value ? "نعم" : "لا";
}

export function parseBulkAccountPaste(text: string): BulkAccountImportRow[] {
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

  return dataLines.slice(0, BULK_ACCOUNT_IMPORT_MAX_ROWS).map((cells) => ({
    id: crypto.randomUUID(),
    name_ar: cells[0] ?? "",
    name_en: cells[1] ?? "",
    parent_code: cells[2] ?? "",
    sub_code: cells[3] ?? "",
    currency_code: (cells[4] ?? "").toUpperCase(),
    is_postable: parsePostable(cells[5] ?? ""),
    preview_code: "",
    errors: [],
  }));
}

export function validateBulkAccountRows(
  rows: BulkAccountImportRow[],
  accounts: Account[],
  currencies: Currency[],
  accountsWithMovements?: ReadonlySet<string>,
): BulkAccountImportRow[] {
  const activeCurrencies = currencies.filter((currency) => currency.is_active);
  const currencyByCode = new Map(
    activeCurrencies.map((currency) => [currency.code.toUpperCase(), currency]),
  );
  const accountByCode = new Map(accounts.map((account) => [account.code, account]));

  const existingNames = new Set(
    accounts.map((account) =>
      normalizeAccountName(account.name_ar).toLocaleLowerCase("ar"),
    ),
  );

  const batchNameCounts = new Map<string, number>();
  for (const row of rows) {
    const normalized = normalizeAccountName(row.name_ar).toLocaleLowerCase("ar");
    if (!normalized) continue;
    batchNameCounts.set(normalized, (batchNameCounts.get(normalized) ?? 0) + 1);
  }

  const simulatedAccounts: Account[] = [...accounts];

  return rows.map((row) => {
    const errors: string[] = [];
    const nameAr = normalizeAccountName(row.name_ar);
    const normalizedName = nameAr.toLocaleLowerCase("ar");
    const parentCode = row.parent_code.trim();
    const subCode = row.sub_code.trim();
    const currencyCode = row.currency_code.trim().toUpperCase();

    if (!nameAr) {
      errors.push("اسم الحساب بالعربية مطلوب.");
    } else if (nameAr.length > 200) {
      errors.push("اسم الحساب يتجاوز 200 حرف.");
    }

    if (nameAr && existingNames.has(normalizedName)) {
      errors.push("اسم الحساب موجود مسبقاً في الدليل.");
    }

    if (nameAr && (batchNameCounts.get(normalizedName) ?? 0) > 1) {
      errors.push("اسم الحساب مكرر ضمن الدفعة.");
    }

    if (!parentCode) {
      errors.push("كود الأب مطلوب.");
    } else if (!accountByCode.has(parentCode)) {
      errors.push(`كود الأب «${parentCode}» غير موجود.`);
    } else {
      const parent = accountByCode.get(parentCode)!;
      if (!parent.is_active) {
        errors.push("الحساب الأب غير نشط.");
      } else if (accountsWithMovements?.has(parent.id)) {
        errors.push(
          `الحساب الأب «${parentCode}» عليه حركة محاسبية — لا يمكن إضافة فرع تحته.`,
        );
      }
    }

    if (subCode.length > 30) {
      errors.push("الكود الفرعي يتجاوز 30 حرفاً.");
    }

    if (row.name_en.trim().length > 200) {
      errors.push("الاسم الإنجليزي يتجاوز 200 حرف.");
    }

    if (currencyCode && !currencyByCode.has(currencyCode)) {
      errors.push(`عملة «${currencyCode}» غير معروفة.`);
    }

    let previewCode = "";
    if (errors.length === 0 && parentCode) {
      const parent = accountByCode.get(parentCode)!;
      previewCode = generateAccountCode(parent, simulatedAccounts);
      simulatedAccounts.push({
        id: row.id,
        code: previewCode,
        parent_id: parent.id,
        name_ar: nameAr,
        name_en: row.name_en.trim() || null,
        currency_id:
          (currencyCode ? currencyByCode.get(currencyCode)?.id : null) ??
          getDefaultCurrencyId(activeCurrencies, parent.id, simulatedAccounts),
        is_postable: row.is_postable,
        is_active: true,
      } as Account);
    }

    return {
      ...row,
      name_ar: nameAr,
      name_en: row.name_en.trim(),
      parent_code: parentCode,
      sub_code: subCode,
      currency_code: currencyCode,
      preview_code: previewCode,
      errors,
    };
  });
}

export function buildBulkImportTemplateCsv(): string {
  const header = BULK_ACCOUNT_IMPORT_COLUMNS.map((column) => column.label).join("\t");
  const sample = [
    "صندوق فرع بغداد",
    "Baghdad Cash",
    "101",
    "C-01",
    "IQD",
    "نعم",
  ].join("\t");
  return `${header}\n${sample}`;
}

export function rowsToClipboardText(rows: BulkAccountImportRow[]): string {
  const header = BULK_ACCOUNT_IMPORT_COLUMNS.map((column) => column.label).join("\t");
  const body = rows
    .filter((row) => row.name_ar || row.parent_code)
    .map((row) =>
      [
        row.name_ar,
        row.name_en,
        row.parent_code,
        row.sub_code,
        row.currency_code,
        parsePostableLabel(row.is_postable),
      ].join("\t"),
    )
    .join("\n");
  return body ? `${header}\n${body}` : header;
}

export function resolveBulkRowCurrencyId(
  row: BulkAccountImportRow,
  accounts: Account[],
  currencies: Currency[],
): string {
  const parent = accounts.find((account) => account.code === row.parent_code);
  if (!parent) return "";

  const activeCurrencies = currencies.filter((currency) => currency.is_active);
  const currency = row.currency_code
    ? activeCurrencies.find(
        (item) => item.code.toUpperCase() === row.currency_code.toUpperCase(),
      )
    : undefined;

  return (
    currency?.id ??
    getDefaultCurrencyId(activeCurrencies, parent.id, accounts) ??
    ""
  );
}
