"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useNotifications } from "@/components/notifications";
import { useAuth } from "@/modules/auth/auth-context";
import { invoicePatternApi } from "@/modules/invoices/services/invoice-pattern-api";
import { materialApi } from "@/modules/materials/services/material-api";
import type { InvoicePattern, MaterialOption } from "@/modules/invoices/types";
import { PosSellScreen } from "@/modules/pos/components/pos-sell-screen";
import { posApi } from "@/modules/pos/services/pos-api";
import type { PosPointDetail } from "@/modules/pos/types";
import type { Customer } from "@/modules/vouchers/types";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";

export default function PosSellPage() {
  const params = useParams<{ pointId: string }>();
  const { hasPermission } = useAuth();
  const { notifyError } = useNotifications();
  const canSell = hasPermission("pos.sell");

  const [point, setPoint] = useState<PosPointDetail | null>(null);
  const [pattern, setPattern] = useState<InvoicePattern | null>(null);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [patternAllowedMaterialIds, setPatternAllowedMaterialIds] = useState<
    string[]
  >([]);
  const [patternAllowedCategoryIds, setPatternAllowedCategoryIds] = useState<
    string[]
  >([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const pointId = params.pointId;

    const load = async () => {
      try {
        const detail = await posApi.getPointDetail(pointId);
        if (!detail) {
          if (!cancelled) setLoadError("لم يُعثر على نقطة البيع.");
          return;
        }
        if (!detail.is_active) {
          if (!cancelled) setLoadError("نقطة البيع موقوفة.");
          return;
        }

        const [
          patternData,
          allowedMats,
          allowedCats,
          materialsData,
          customersData,
        ] = await Promise.all([
          invoicePatternApi.getInvoicePattern(detail.invoice_pattern_id),
          invoicePatternApi.listAllowedMaterialIds(detail.invoice_pattern_id),
          invoicePatternApi.listAllowedCategoryIds(detail.invoice_pattern_id),
          materialApi.listMaterials(),
          voucherApi.listCustomers(),
        ]);

        if (cancelled) return;
        setPoint(detail);
        setPattern(patternData);
        setPatternAllowedMaterialIds(allowedMats);
        setPatternAllowedCategoryIds(allowedCats);
        setMaterials(materialsData);
        setCustomers(customersData);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "فشل تحميل شاشة البيع.";
          setLoadError(message);
          notifyError(message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [params.pointId, notifyError]);

  if (!canSell) {
    return (
      <main className="flex w-full flex-col gap-4">
        <p className="text-sm text-slate-600">
          ليس لديك صلاحية البيع من نقاط البيع.
        </p>
        <Link href="/pos" className="btn btn-outline w-fit">
          رجوع
        </Link>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="flex w-full flex-col gap-4">
        <p className="text-sm text-slate-600">جاري تحميل شاشة البيع...</p>
      </main>
    );
  }

  if (loadError || !point || !pattern) {
    return (
      <main className="flex w-full flex-col gap-4">
        <p className="text-sm text-rose-700">
          {loadError || "تعذّر فتح شاشة البيع."}
        </p>
        <Link href="/pos" className="btn btn-outline w-fit">
          رجوع
        </Link>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col">
      <PosSellScreen
        point={point}
        materials={materials}
        pattern={pattern}
        patternAllowedMaterialIds={patternAllowedMaterialIds}
        patternAllowedCategoryIds={patternAllowedCategoryIds}
        customers={customers}
      />
    </main>
  );
}
