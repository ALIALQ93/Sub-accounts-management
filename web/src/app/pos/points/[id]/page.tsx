"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useNotifications } from "@/components/notifications";
import { useAuth } from "@/modules/auth/auth-context";
import { branchApi, type BranchOption } from "@/modules/branches/services/branch-api";
import {
  detailToFormValues,
  PosPointForm,
} from "@/modules/pos/components/pos-point-form";
import { posApi } from "@/modules/pos/services/pos-api";
import type { PosPointFormValues } from "@/modules/pos/types";
import { invoicePatternApi } from "@/modules/invoices/services/invoice-pattern-api";
import { materialApi } from "@/modules/materials/services/material-api";
import { warehouseApi } from "@/modules/materials/services/warehouse-api";
import type { Warehouse } from "@/modules/materials/types";
import type {
  InvoicePatternListItem,
  MaterialCategoryOption,
  MaterialOption,
} from "@/modules/invoices/types";
import type { Account, Customer } from "@/modules/vouchers/types";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";

export default function EditPosPointPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { notifySuccess, notifyError } = useNotifications();
  const canEdit = hasPermission("pos.settings");

  const [title, setTitle] = useState("تعديل نقطة البيع");
  const [formValues, setFormValues] = useState<PosPointFormValues | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [patterns, setPatterns] = useState<InvoicePatternListItem[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [categories, setCategories] = useState<MaterialCategoryOption[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const id = params.id;

    const load = async () => {
      try {
        const [
          detail,
          branchesData,
          warehousesData,
          patternsData,
          materialsData,
          categoriesData,
          accountsData,
          customersData,
        ] = await Promise.all([
          posApi.getPointDetail(id),
          branchApi.listBranchOptions(),
          warehouseApi.listWarehouses(),
          invoicePatternApi.listInvoicePatterns(),
          materialApi.listMaterials(),
          materialApi.listMaterialCategories(),
          voucherApi.listAllAccounts(),
          voucherApi.listCustomers(),
        ]);
        if (cancelled) return;
        if (!detail) {
          setFormValues(null);
          return;
        }
        setTitle(detail.name_ar);
        setFormValues(detailToFormValues(detail));
        setBranches(branchesData);
        setWarehouses(warehousesData);
        setPatterns(patternsData);
        setMaterials(materialsData);
        setCategories(categoriesData);
        setAccounts(accountsData);
        setCustomers(customersData);
      } catch (err) {
        if (!cancelled) {
          notifyError(
            err instanceof Error ? err.message : "فشل تحميل نقطة البيع.",
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

  const onSubmit = async (values: PosPointFormValues) => {
    if (!values.point_code.trim() || !values.name_ar.trim()) {
      setError("رمز النقطة والاسم العربي مطلوبان.");
      return;
    }
    if (!values.branch_id || !values.warehouse_id || !values.invoice_pattern_id) {
      setError("الفرع والمستودع ونمط الفاتورة مطلوبة.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const updated = await posApi.updatePoint(params.id, values);
      setTitle(updated.name_ar);
      setFormValues(detailToFormValues(updated));
      notifySuccess("تم حفظ نقطة البيع.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حفظ نقطة البيع.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <section>
        <h1 className="text-xl font-bold tracking-tight text-[var(--brand-navy)]">
          {title}
        </h1>
        <p className="text-xs text-slate-600">
          تعديل تعريف نقطة البيع وطرق التحصيل والمواد المسموحة.
        </p>
      </section>

      <section className="rounded-xl border-2 border-slate-300 bg-white p-3 md:p-4">
        {isLoading && (
          <p className="text-sm text-slate-600">جاري تحميل نقطة البيع...</p>
        )}

        {!isLoading && formValues && (
          <PosPointForm
            mode="edit"
            initialValues={formValues}
            branches={branches}
            warehouses={warehouses}
            patterns={patterns}
            materials={materials}
            categories={categories}
            accounts={accounts}
            customers={customers}
            canEdit={canEdit}
            isSaving={isSaving}
            error={error}
            onSubmit={(values) => void onSubmit(values)}
            onCancel={() => router.push("/pos/points")}
          />
        )}

        {!isLoading && !formValues && (
          <p className="text-sm text-rose-700">لم يُعثر على نقطة البيع المطلوبة.</p>
        )}
      </section>
    </main>
  );
}
