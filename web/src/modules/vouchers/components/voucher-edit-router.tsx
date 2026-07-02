"use client";

import { useEffect, useState } from "react";
import { PaymentVoucherForm } from "@/modules/vouchers/components/payment-voucher-form";
import { ReceiptVoucherForm } from "@/modules/vouchers/components/receipt-voucher-form";
import { SettlementVoucherForm } from "@/modules/vouchers/components/settlement-voucher-form";
import { VoucherForm } from "@/modules/vouchers/components/voucher-form";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { VoucherType } from "@/modules/vouchers/types";

interface VoucherEditRouterProps {
  voucherId: string;
}

export function VoucherEditRouter({ voucherId }: VoucherEditRouterProps) {
  const [voucherType, setVoucherType] = useState<VoucherType | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const details = await voucherApi.getVoucherById(voucherId);
        if (!cancelled) setVoucherType(details.header.voucher_type);
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

  if (error || !voucherType) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        {error || "تعذّر تحديد نوع السند."}
      </div>
    );
  }

  if (voucherType === "receipt") {
    return <ReceiptVoucherForm initialMode="edit" initialVoucherId={voucherId} />;
  }

  if (voucherType === "payment") {
    return <PaymentVoucherForm initialMode="edit" initialVoucherId={voucherId} />;
  }

  if (voucherType === "settlement") {
    return <SettlementVoucherForm initialMode="edit" initialVoucherId={voucherId} />;
  }

  return (
    <VoucherForm
      initialMode="edit"
      initialVoucherId={voucherId}
      lockedVoucherType={voucherType}
    />
  );
}
