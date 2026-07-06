"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionGate } from "@/components/permission-gate";
import { useNotifications } from "@/components/notifications";
import { useAuth } from "@/modules/auth/auth-context";
import { costCenterApi } from "@/modules/cost-centers/services/cost-center-api";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import { InvoicePatternForm } from "@/modules/invoices/components/invoice-pattern-form";
import { InvoicesNav } from "@/modules/invoices/components/invoices-nav";
import {
  DEFAULT_INVOICE_PATTERN_FORM,
  invoicePatternApi,
  type BranchOption,
  type InvoicePatternFormValues,
  type WarehouseOption,
} from "@/modules/invoices/services/invoice-pattern-api";
import { materialApi } from "@/modules/invoices/services/material-api";
import type { Currency } from "@/modules/currencies/types";
import type { MaterialCategoryOption, MaterialOption, InvoicePatternListItem } from "@/modules/invoices/types";
import type { Account, CostCenter } from "@/modules/vouchers/types";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";

export default function NewInvoicePatternPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { notifySuccess, notifyError } = useNotifications();
  const canEdit = hasPermission("invoices.settings");

  const [values, setValues] = useState<InvoicePatternFormValues>(
    DEFAULT_INVOICE_PATTERN_FORM,
  );
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

    const load = async () => {
      try {
        const [
          branchesData,
          warehousesData,
          currenciesData,
          centersData,
          accountsData,
          materialsData,
          categoriesData,
          patternsData,
        ] = await Promise.all([
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
            err instanceof Error ? err.message : "فشل تحميل بيانات النموذج.",
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
  }, [notifyError]);

  const onSubmit = async () => {
    if (!values.name_ar.trim()) {
      setError("الاسم العربي مطلوب.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const created = await invoicePatternApi.createInvoicePattern(values);
      notifySuccess("تم إنشاء نمط الفاتورة.");
      router.push(`/invoices/patterns/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إنشاء النمط.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <main className="flex w-full flex-col gap-4">
        <InvoicesNav />
        <p className="text-sm text-slate-600">ليس لديك صلاحية إنشاء أنماط الفواتير.</p>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col gap-4">
      <InvoicesNav />

      <section>
        <h1 className="text-xl font-bold text-slate-900">نمط فاتورة جديد</h1>
        <p className="text-xs text-slate-600">
          حدّد النوع التجاري والسلوك الافتراضي وقواعد الترقيم.
        </p>
      </section>

      <PermissionGate permission="invoices.settings">
        <section className="rounded-xl border-2 border-slate-300 bg-white p-3 md:p-4">
          {isLoading ? (
            <p className="text-sm text-slate-600">جاري تحميل النموذج...</p>
          ) : (
            <InvoicePatternForm
              mode="create"
              values={values}
              branches={branches}
              warehouses={warehouses}
              currencies={currencies}
              costCenters={costCenters}
              accounts={accounts}
              materials={materials}
              categories={categories}
              inputPatterns={inputPatterns}
              isSaving={isSaving}
              error={error}
              onChange={setValues}
              onSubmit={() => void onSubmit()}
              onCancel={() => router.push("/invoices/patterns")}
            />
          )}
        </section>
      </PermissionGate>
    </main>
  );
}
