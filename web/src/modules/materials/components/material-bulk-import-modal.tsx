"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { materialApi } from "@/modules/materials/services/material-api";
import { materialCategoryApi } from "@/modules/materials/services/material-category-api";
import { unitApi } from "@/modules/materials/services/unit-api";
import type {
  MaterialCategory,
  MaterialFormValues,
  MaterialListItem,
  MaterialUnitFormValues,
  UnitCatalogItem,
} from "@/modules/materials/types";
import {
  BULK_CATEGORY_IMPORT_COLUMNS,
  BULK_MATERIAL_IMPORT_COLUMNS,
  BULK_MATERIAL_IMPORT_MAX_ROWS,
  buildBulkCategoryTemplateCsv,
  buildBulkMaterialTemplateCsv,
  createEmptyBulkCategoryRow,
  createEmptyBulkMaterialRow,
  parseBulkCategoryPaste,
  parseBulkMaterialPaste,
  validateBulkCategoryRows,
  validateBulkMaterialRows,
  type BulkCategoryImportRow,
  type BulkMaterialImportRow,
} from "@/modules/materials/utils/bulk-import-materials";

interface MaterialBulkImportModalProps {
  open: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onImported: () => Promise<void> | void;
}

type ImportTab = "materials" | "categories";

const STARTER_ROWS = 6;

function createMaterialStarterRows(): BulkMaterialImportRow[] {
  return Array.from({ length: STARTER_ROWS }, () => createEmptyBulkMaterialRow());
}

function createCategoryStarterRows(): BulkCategoryImportRow[] {
  return Array.from({ length: STARTER_ROWS }, () => createEmptyBulkCategoryRow());
}

function emptyMaterialForm(
  overrides: Partial<MaterialFormValues>,
): MaterialFormValues {
  return {
    material_code: "",
    name_ar: "",
    name_en: "",
    category_id: "",
    material_kind: "normal",
    purchase_price: 0,
    sale_price: 0,
    inventory_account_id: "",
    min_stock: 0,
    max_stock: 0,
    barcode: "",
    manufacturer: "",
    supplier_name: "",
    color: "",
    size: "",
    weight: null,
    notes: "",
    has_expiry_date: false,
    require_expiry_on_inbound: false,
    require_expiry_on_outbound: false,
    has_serial_number: false,
    require_serial_on_inbound: false,
    require_serial_on_outbound: false,
    is_active: true,
    ...overrides,
  };
}

export function MaterialBulkImportModal({
  open,
  isSaving = false,
  onClose,
  onImported,
}: MaterialBulkImportModalProps) {
  const [tab, setTab] = useState<ImportTab>("materials");
  const [materials, setMaterials] = useState<MaterialListItem[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [units, setUnits] = useState<UnitCatalogItem[]>([]);
  const [isLoadingRefs, setIsLoadingRefs] = useState(false);

  const [materialRows, setMaterialRows] = useState<BulkMaterialImportRow[]>(() =>
    createMaterialStarterRows(),
  );
  const [validatedMaterialRows, setValidatedMaterialRows] = useState<
    BulkMaterialImportRow[] | null
  >(null);

  const [categoryRows, setCategoryRows] = useState<BulkCategoryImportRow[]>(() =>
    createCategoryStarterRows(),
  );
  const [validatedCategoryRows, setValidatedCategoryRows] = useState<
    BulkCategoryImportRow[] | null
  >(null);

  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const reloadRefs = useCallback(async () => {
    const [materialsData, categoriesData, unitsData] = await Promise.all([
      materialApi.listMaterials(),
      materialCategoryApi.listCategories(),
      unitApi.listUnits(),
    ]);
    setMaterials(materialsData);
    setCategories(categoriesData);
    setUnits(unitsData);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setIsLoadingRefs(true);
    void reloadRefs()
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "فشل تحميل بيانات التحقق.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRefs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, reloadRefs]);

  const displayMaterialRows = validatedMaterialRows ?? materialRows;
  const displayCategoryRows = validatedCategoryRows ?? categoryRows;

  const validMaterialRows = useMemo(
    () =>
      displayMaterialRows.filter(
        (row) => row.errors.length === 0 && row.name_ar.trim(),
      ),
    [displayMaterialRows],
  );
  const validCategoryRows = useMemo(
    () =>
      displayCategoryRows.filter(
        (row) =>
          row.errors.length === 0 &&
          row.category_code.trim() &&
          row.name_ar.trim(),
      ),
    [displayCategoryRows],
  );

  const resetState = () => {
    setTab("materials");
    setMaterialRows(createMaterialStarterRows());
    setValidatedMaterialRows(null);
    setCategoryRows(createCategoryStarterRows());
    setValidatedCategoryRows(null);
    setFeedback("");
    setError("");
  };

  const handleClose = () => {
    if (isImporting) return;
    resetState();
    onClose();
  };

  const handlePaste = async () => {
    setError("");
    setFeedback("");
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setError("الحافظة فارغة.");
        return;
      }
      if (tab === "materials") {
        const parsed = parseBulkMaterialPaste(text);
        if (parsed.length === 0) {
          setError("لم يُعثر على صفوف صالحة في اللصق.");
          return;
        }
        setMaterialRows(parsed);
        setValidatedMaterialRows(null);
        setFeedback(`تم لصق ${parsed.length} صف. اضغط «تحقق» قبل الاستيراد.`);
      } else {
        const parsed = parseBulkCategoryPaste(text);
        if (parsed.length === 0) {
          setError("لم يُعثر على صفوف صالحة في اللصق.");
          return;
        }
        setCategoryRows(parsed);
        setValidatedCategoryRows(null);
        setFeedback(`تم لصق ${parsed.length} صف. اضغط «تحقق» قبل الاستيراد.`);
      }
    } catch {
      setError("تعذّر قراءة الحافظة. تأكد من السماح للمتصفح بالوصول إليها.");
    }
  };

  const handleDownloadTemplate = () => {
    const content =
      tab === "materials"
        ? buildBulkMaterialTemplateCsv()
        : buildBulkCategoryTemplateCsv();
    const blob = new Blob([content], {
      type: "text/tab-separated-values;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      tab === "materials"
        ? "materials-import-template.tsv"
        : "categories-import-template.tsv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleValidate = () => {
    setError("");
    setFeedback("");

    if (tab === "materials") {
      const nonEmpty = materialRows.filter(
        (row) =>
          row.name_ar.trim() ||
          row.material_code.trim() ||
          row.base_unit_code.trim(),
      );
      if (nonEmpty.length === 0) {
        setError("أدخل صفاً واحداً على الأقل.");
        setValidatedMaterialRows([]);
        return;
      }
      if (nonEmpty.length > BULK_MATERIAL_IMPORT_MAX_ROWS) {
        setError(`الحد الأقصى ${BULK_MATERIAL_IMPORT_MAX_ROWS} صف في الدفعة.`);
        return;
      }
      const validated = validateBulkMaterialRows(
        nonEmpty,
        materials,
        categories,
        units,
      );
      setValidatedMaterialRows(validated);
      setMaterialRows(validated);
      const validCount = validated.filter((row) => row.errors.length === 0).length;
      const errorCount = validated.length - validCount;
      setFeedback(
        errorCount === 0
          ? `✓ ${validCount} مادة جاهزة للاستيراد.`
          : `جاهز: ${validCount} — أخطاء: ${errorCount}`,
      );
      return;
    }

    const nonEmpty = categoryRows.filter(
      (row) => row.category_code.trim() || row.name_ar.trim(),
    );
    if (nonEmpty.length === 0) {
      setError("أدخل صفاً واحداً على الأقل.");
      setValidatedCategoryRows([]);
      return;
    }
    if (nonEmpty.length > BULK_MATERIAL_IMPORT_MAX_ROWS) {
      setError(`الحد الأقصى ${BULK_MATERIAL_IMPORT_MAX_ROWS} صف في الدفعة.`);
      return;
    }
    const validated = validateBulkCategoryRows(nonEmpty, categories);
    setValidatedCategoryRows(validated);
    setCategoryRows(validated);
    const validCount = validated.filter((row) => row.errors.length === 0).length;
    const errorCount = validated.length - validCount;
    setFeedback(
      errorCount === 0
        ? `✓ ${validCount} صنف جاهز للاستيراد.`
        : `جاهز: ${validCount} — أخطاء: ${errorCount}`,
    );
  };

  const resolveOrCreateUnit = async (
    unitCode: string,
    cache: Map<string, UnitCatalogItem>,
  ): Promise<UnitCatalogItem> => {
    const code = unitCode.trim().toUpperCase() || "PCS";
    const existing = cache.get(code);
    if (existing) return existing;

    const created = await unitApi.createUnit({
      unit_code: code,
      name_ar: code === "PCS" ? "قطعة" : code,
      name_en: code === "PCS" ? "Piece" : code,
      is_active: true,
    });
    cache.set(created.unit_code.toUpperCase(), created);
    return created;
  };

  const handleImportMaterials = async () => {
    const source = validatedMaterialRows ?? materialRows;
    const validated = validateBulkMaterialRows(
      source.filter(
        (row) =>
          row.name_ar.trim() ||
          row.material_code.trim() ||
          row.base_unit_code.trim(),
      ),
      materials,
      categories,
      units,
    );
    setValidatedMaterialRows(validated);
    setMaterialRows(validated);

    const importable = validated.filter((row) => row.errors.length === 0);
    if (importable.length === 0) {
      setError("لا توجد صفوف صالحة للاستيراد. نفّذ «تحقق» وأصلح الأخطاء.");
      return;
    }

    const categoryByCode = new Map(
      categories.map((category) => [
        category.category_code.toUpperCase(),
        category,
      ]),
    );
    const unitCache = new Map(
      units.map((unit) => [unit.unit_code.toUpperCase(), unit]),
    );

    setIsImporting(true);
    setError("");
    let successCount = 0;
    try {
      for (const row of importable) {
        const unit = await resolveOrCreateUnit(row.base_unit_code, unitCache);
        const categoryId = row.category_code
          ? (categoryByCode.get(row.category_code)?.id ?? "")
          : "";
        const materialCode =
          row.material_code ||
          (await materialApi.suggestNextMaterialCode(categoryId || null));

        const payload = emptyMaterialForm({
          material_code: materialCode,
          name_ar: row.name_ar,
          name_en: row.name_en,
          category_id: categoryId,
          material_kind: row.resolved_kind,
          purchase_price: Number(row.purchase_price || 0) || 0,
          sale_price: Number(row.sale_price || 0) || 0,
        });

        const baseUnit: MaterialUnitFormValues = {
          unit_id: unit.id,
          unit_code: unit.unit_code,
          name_ar: unit.name_ar,
          name_en: unit.name_en ?? "",
          is_base_unit: true,
          conversion_op: "multiply",
          conversion_factor: 1,
          factor_to_base: 1,
          purchase_price: payload.purchase_price,
          sale_price: payload.sale_price,
          semi_wholesale_price: null,
          wholesale_price: null,
          is_active: true,
        };

        await materialApi.createMaterial(payload, baseUnit);
        successCount += 1;
      }

      await onImported();
      await reloadRefs();
      setFeedback(`تم استيراد ${successCount} مادة بنجاح.`);
      setMaterialRows(createMaterialStarterRows());
      setValidatedMaterialRows(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? `فشل بعد استيراد ${successCount} مادة: ${err.message}`
          : "فشل الاستيراد.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportCategories = async () => {
    const source = validatedCategoryRows ?? categoryRows;
    const validated = validateBulkCategoryRows(
      source.filter(
        (row) => row.category_code.trim() || row.name_ar.trim(),
      ),
      categories,
    );
    setValidatedCategoryRows(validated);
    setCategoryRows(validated);

    const importable = validated.filter((row) => row.errors.length === 0);
    if (importable.length === 0) {
      setError("لا توجد صفوف صالحة للاستيراد. نفّذ «تحقق» وأصلح الأخطاء.");
      return;
    }

    // Parents first: rows without parent, then dependents.
    const remaining = [...importable];
    const createdByCode = new Map(
      categories.map((category) => [
        category.category_code.toUpperCase(),
        category.id,
      ]),
    );

    setIsImporting(true);
    setError("");
    let successCount = 0;
    try {
      let guard = remaining.length + 2;
      while (remaining.length > 0 && guard > 0) {
        guard -= 1;
        const nextIndex = remaining.findIndex((row) => {
          if (!row.parent_code) return true;
          return createdByCode.has(row.parent_code);
        });
        if (nextIndex < 0) {
          throw new Error(
            "تعذّر ترتيب الأصناف حسب الأب — تحقق من رموز الآباء.",
          );
        }
        const [row] = remaining.splice(nextIndex, 1);
        const created = await materialCategoryApi.createCategory({
          category_code: row.category_code,
          name_ar: row.name_ar,
          name_en: row.name_en,
          parent_id: row.parent_code
            ? (createdByCode.get(row.parent_code) ?? "")
            : "",
          is_active: true,
        });
        createdByCode.set(created.category_code.toUpperCase(), created.id);
        successCount += 1;
      }

      await onImported();
      await reloadRefs();
      setFeedback(`تم استيراد ${successCount} صنف بنجاح.`);
      setCategoryRows(createCategoryStarterRows());
      setValidatedCategoryRows(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? `فشل بعد استيراد ${successCount} صنف: ${err.message}`
          : "فشل الاستيراد.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const busy = isSaving || isImporting || isLoadingRefs;

  return (
    <Modal
      open={open}
      size="xl"
      title="استيراد جماعي"
      description="الصق من Excel أو عدّل الجدول، ثم تحقق واستورد. الحد الأقصى 200 صف."
      onClose={handleClose}
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setTab("materials")}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === "materials"
                ? "bg-[var(--brand-navy)] text-white"
                : "border border-slate-300 text-slate-700"
            }`}
          >
            مواد
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setTab("categories")}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === "categories"
                ? "bg-[var(--brand-navy)] text-white"
                : "border border-slate-300 text-slate-700"
            }`}
          >
            أصناف
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handlePaste()}
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
            onClick={handleValidate}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-60"
          >
            تحقق
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void (tab === "materials"
                ? handleImportMaterials()
                : handleImportCategories())
            }
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            {isImporting ? "جاري الاستيراد..." : "استيراد"}
          </button>
        </div>

        {isLoadingRefs && (
          <p className="text-sm text-slate-600">جاري تحميل البيانات المرجعية...</p>
        )}
        {error && <p className="text-sm text-rose-700">{error}</p>}
        {feedback && !error && (
          <p className="text-sm text-emerald-800">{feedback}</p>
        )}

        {tab === "materials" ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-[980px] w-full border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  {BULK_MATERIAL_IMPORT_COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      className="border-b border-slate-200 px-2 py-2 text-right font-medium"
                    >
                      {column.label}
                      {column.required ? " *" : ""}
                    </th>
                  ))}
                  <th className="border-b border-slate-200 px-2 py-2 text-right font-medium">
                    أخطاء
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayMaterialRows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      row.errors.length > 0 ? "bg-rose-50/60" : undefined
                    }
                  >
                    {(
                      [
                        "name_ar",
                        "name_en",
                        "category_code",
                        "material_code",
                        "material_kind",
                        "purchase_price",
                        "sale_price",
                        "base_unit_code",
                      ] as const
                    ).map((key) => (
                      <td key={key} className="border-b border-slate-100 p-1">
                        <input
                          value={row[key]}
                          disabled={busy}
                          onChange={(event) => {
                            setValidatedMaterialRows(null);
                            setMaterialRows((current) =>
                              current.map((item) =>
                                item.id === row.id
                                  ? {
                                      ...item,
                                      [key]: event.target.value,
                                      errors: [],
                                    }
                                  : item,
                              ),
                            );
                          }}
                          className="w-full rounded border border-slate-200 px-2 py-1"
                        />
                      </td>
                    ))}
                    <td className="border-b border-slate-100 px-2 py-1 text-rose-700">
                      {row.errors.join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-2 py-2 text-[11px] text-slate-500">
              جاهز: {validMaterialRows.length} / {displayMaterialRows.length}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-[720px] w-full border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  {BULK_CATEGORY_IMPORT_COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      className="border-b border-slate-200 px-2 py-2 text-right font-medium"
                    >
                      {column.label}
                      {column.required ? " *" : ""}
                    </th>
                  ))}
                  <th className="border-b border-slate-200 px-2 py-2 text-right font-medium">
                    أخطاء
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayCategoryRows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      row.errors.length > 0 ? "bg-rose-50/60" : undefined
                    }
                  >
                    {(
                      [
                        "category_code",
                        "name_ar",
                        "name_en",
                        "parent_code",
                      ] as const
                    ).map((key) => (
                      <td key={key} className="border-b border-slate-100 p-1">
                        <input
                          value={row[key]}
                          disabled={busy}
                          onChange={(event) => {
                            setValidatedCategoryRows(null);
                            setCategoryRows((current) =>
                              current.map((item) =>
                                item.id === row.id
                                  ? {
                                      ...item,
                                      [key]: event.target.value,
                                      errors: [],
                                    }
                                  : item,
                              ),
                            );
                          }}
                          className="w-full rounded border border-slate-200 px-2 py-1"
                        />
                      </td>
                    ))}
                    <td className="border-b border-slate-100 px-2 py-1 text-rose-700">
                      {row.errors.join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-2 py-2 text-[11px] text-slate-500">
              جاهز: {validCategoryRows.length} / {displayCategoryRows.length}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
