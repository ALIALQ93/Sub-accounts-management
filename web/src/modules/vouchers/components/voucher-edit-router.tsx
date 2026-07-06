"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OpeningEntryVoucherForm } from "@/modules/opening-entry/components/opening-entry-voucher-form";
import { PaymentVoucherForm } from "@/modules/vouchers/components/payment-voucher-form";
import { ReceiptVoucherForm } from "@/modules/vouchers/components/receipt-voucher-form";
import { SettlementVoucherForm } from "@/modules/vouchers/components/settlement-voucher-form";
import { VoucherForm } from "@/modules/vouchers/components/voucher-form";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { SettlementMode, VoucherType } from "@/modules/vouchers/types";

interface VoucherEditRouterProps {
  voucherId: string;
}

function VoucherEditRouterInner({ voucherId }: VoucherEditRouterProps) {
  const searchParams = useSearchParams();
  const forceViewMode = searchParams.get("mode") === "view";
  const [voucherType, setVoucherType] = useState<VoucherType | null>(null);
  const [settlementMode, setSettlementMode] = useState<SettlementMode | null>(null);
  const [isOpeningEntry, setIsOpeningEntry] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const details = await voucherApi.getVoucherById(voucherId);
        if (!cancelled) {
          setVoucherType(details.header.voucher_type);
          setSettlementMode(details.header.settlement_mode);
          setIsOpeningEntry(Boolean(details.header.is_opening_entry));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "تعذّر تحميل السند.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [voucherId]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700">
        جاري تحميل السند...
      </div>
    );
  }

  if (error || !voucherType || !settlementMode) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        {error || "تعذّر تحديد نوع السند."}
      </div>
    );
  }

  if (isOpeningEntry) {
    return (
      <OpeningEntryVoucherForm
        initialMode="edit"
        initialVoucherId={voucherId}
        forceViewMode={forceViewMode}
      />
    );
  }

  if (voucherType === "receipt") {
    return (
      <ReceiptVoucherForm
        initialMode="edit"
        initialVoucherId={voucherId}
        forceViewMode={forceViewMode}
        lockedSettlementMode={
          settlementMode === "invoice" ? "invoice" : undefined
        }
      />
    );
  }

  if (voucherType === "payment") {
    return (
      <PaymentVoucherForm
        initialMode="edit"
        initialVoucherId={voucherId}
        forceViewMode={forceViewMode}
        lockedSettlementMode={
          settlementMode === "invoice" ? "invoice" : undefined
        }
      />
    );
  }

  if (voucherType === "settlement") {
    return (
      <SettlementVoucherForm
        initialMode="edit"
        initialVoucherId={voucherId}
        forceViewMode={forceViewMode}
      />
    );
  }

  return (
    <VoucherForm
      initialMode="edit"
      initialVoucherId={voucherId}
      lockedVoucherType={voucherType}
      forceViewMode={forceViewMode}
    />
  );
}

export function VoucherEditRouter(props: VoucherEditRouterProps) {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700">
          جاري تحميل السند...
        </div>
      }
    >
      <VoucherEditRouterInner {...props} />
    </Suspense>
  );
}
