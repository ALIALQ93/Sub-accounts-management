"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PermissionGate } from "@/components/permission-gate";
import { useNotifications } from "@/components/notifications";
import { useAuth } from "@/modules/auth/auth-context";
import { costCenterApi } from "@/modules/cost-centers/services/cost-center-api";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import { InvoicePatternForm } from "@/modules/invoices/components/invoice-pattern-form";
import { InvoicesNav } from "@/modules/invoices/components/invoices-nav";
import {
  invoicePatternApi,
  patternToFormValues,
  type BranchOption,
  type InvoicePatternFormValues,
  type WarehouseOption,
} from "@/modules/invoices/services/invoice-pattern-api";
import { materialApi } from "@/modules/invoices/services/material-api";
import type { Currency } from "@/modules/currencies/types";
import type {
  InvoicePattern,
  MaterialCategoryOption,
  MaterialOption,
  InvoicePatternListItem,
} from "@/modules/invoices/types";
import type { Account, CostCenter } from "@/modules/vouchers/types";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";

export default function EditInvoicePatternPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { notifySuccess, notifyError } = useNotifications();
  const canEdit = hasPermission("invoices.settings");

  const [pattern, setPattern] = useState<InvoicePattern | null>(null);
  const [values, setValues] = useState<InvoicePatternFormValues | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [categories, setCategories] = useState<MaterialCategoryOption[]>([]);
  const [inputPatterns, setInputPatterns] = useState<InvoicePatternListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const id = params.id;

    const load = async () => {
      try {
        const [
          patternData,
          conditionsData,
          allowedMaterialIds,
          allowedCategoryIds,
          branchesData,
          warehousesData,
          currenciesData,
          centersData,
          accountsData,
          materialsData,
          categoriesData,
          patternsData,
        ] = await Promise.all([
          invoicePatternApi.getInvoicePattern(id),
          invoicePatternApi.getPatternConditions(id),
          invoicePatternApi.listAllowedMaterialIds(id),
          invoicePatternApi.listAllowedCategoryIds(id),
          invoicePatternApi.listBranches(),
          invoicePatternApi.listWarehouses(),
          currencyApi.listCurrencies(),
          costCenterApi.listCostCenters(),
          voucherApi.listAccounts(),
          materialApi.listMaterials(),
          materialApi.listMaterialCategories(),
          invoicePatternApi.listInvoicePatterns(),
        ]);
        if (!cancelled) {
          setPattern(patternData);
          setValues(
            patternToFormValues(
              patternData,
              conditionsData,
              allowedMaterialIds,
              allowedCategoryIds,
            ),
          );
          setBranches(branchesData);
          setWarehouses(warehousesData);
          setCurrencies(currenciesData);
          setCostCenters(centersData);
          setAccounts(accountsData);
          setMaterials(materialsData);
          setCategories(categoriesData);
          setInputPatterns(patternsData);
        }
      } catch (err) {
        if (!cancelled) {
          notifyError(
            err instanceof Error ? err.message : "فشل تحميل نمط الفاتورة.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id, notifyError]);

  const onSubmit = async () => {
    if (!values || !pattern) return;
    if (!values.name_ar.trim()) {
      setError("الاسم العربي مطلوب.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await invoicePatternApi.updateInvoicePattern(pattern.id, values);
      notifySuccess("تم حفظ نمط الفاتورة.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حفظ النمط.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <InvoicesNav />

      <section>
        <h1 className="text-xl font-bold text-slate-900">
          {pattern ? pattern.name_ar : "تعديل نمط الفاتورة"}
        </h1>
        <p className="text-xs text-slate-600">
          تعديل التعريف والقيم الافتراضية وقواعد الترقيم.
        </p>
      </section>

      <section className="rounded-xl border-2 border-slate-300 bg-white p-3 md:p-4">
        {isLoading && (
          <p className="text-sm text-slate-600">جاري تحميل النمط...</p>
        )}

        {!isLoading && values && (
          <InvoicePatternForm
            mode="edit"
            values={values}
            patternNo={pattern?.pattern_no}
            branches={branches}
            warehouses={warehouses}
            currencies={currencies}
            costCenters={costCenters}
            accounts={accounts}
            materials={materials}
            categories={categories}
            inputPatterns={inputPatterns}
            isSaving={isSaving}
            disabled={!canEdit}
            error={error}
            onChange={setValues}
            onSubmit={() => void onSubmit()}
            onCancel={() => router.push("/invoices/patterns")}
          />
        )}

        {!isLoading && !values && (
          <p className="text-sm text-red-600">لم يُعثر على النمط المطلوب.</p>
        )}
      </section>
    </main>
  );
}
