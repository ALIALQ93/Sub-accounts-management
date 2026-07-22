"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionGate } from "@/components/permission-gate";
import { useNotifications } from "@/components/notifications";
import { useAuth } from "@/modules/auth/auth-context";
import { branchApi, type BranchOption } from "@/modules/branches/services/branch-api";
import {
  EMPTY_POS_POINT_VALUES,
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

export default function NewPosPointPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { notifySuccess, notifyError } = useNotifications();
  const canEdit = hasPermission("pos.settings");

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

    const load = async () => {
      try {
        const [
          branchesData,
          warehousesData,
          patternsData,
          materialsData,
          categoriesData,
          accountsData,
          customersData,
        ] = await Promise.all([
          branchApi.listBranchOptions(),
          warehouseApi.listWarehouses(),
          invoicePatternApi.listInvoicePatterns(),
          materialApi.listMaterials(),
          materialApi.listMaterialCategories(),
          voucherApi.listAllAccounts(),
          voucherApi.listCustomers(),
        ]);
        if (!cancelled) {
          setBranches(branchesData);
          setWarehouses(warehousesData);
          setPatterns(patternsData);
          setMaterials(materialsData);
          setCategories(categoriesData);
          setAccounts(accountsData);
          setCustomers(customersData);
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
      const created = await posApi.createPoint(values);
      notifySuccess("تم إنشاء نقطة البيع.");
      router.push(`/pos/points/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إنشاء نقطة البيع.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <main className="flex w-full flex-col gap-4">
        <p className="text-sm text-slate-600">
          ليس لديك صلاحية تعريف نقاط البيع.
        </p>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col gap-4">
      <section>
        <h1 className="text-xl font-bold tracking-tight text-[var(--brand-navy)]">
          نقطة بيع جديدة
        </h1>
        <p className="text-xs text-slate-600">
          حدّد الفرع والمستودع ونمط البيع وطرق التحصيل.
        </p>
      </section>

      <PermissionGate permission="pos.settings">
        <section className="rounded-xl border-2 border-slate-300 bg-white p-3 md:p-4">
          {isLoading ? (
            <p className="text-sm text-slate-600">جاري تحميل النموذج...</p>
          ) : (
            <PosPointForm
              mode="create"
              initialValues={EMPTY_POS_POINT_VALUES}
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
        </section>
      </PermissionGate>
    </main>
  );
}
