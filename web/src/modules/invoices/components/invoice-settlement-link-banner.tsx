"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { parseOptionalPaymentAmount } from "@/modules/vouchers/utils/validate-voucher-allocations";

function InvoiceSettlementLinkBannerInner() {
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get("invoiceId");
  const payAmount = parseOptionalPaymentAmount(searchParams.get("payAmount"));

  if (!invoiceId) return null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
      <p>
        هذا السند مرتبط بالفاتورة{" "}
        <Link
          href={`/invoices/${invoiceId}`}
          className="font-semibold text-blue-900 underline-offset-2 hover:underline"
        >
          {invoiceId.slice(0, 8)}…
        </Link>
        {payAmount != null && (
          <span className="ms-2 font-mono text-blue-900">
            — دفع جزئي: {payAmount.toFixed(2)}
          </span>
        )}
      </p>
      <Link
        href={`/invoices/${invoiceId}`}
        className="mt-1 inline-block text-xs font-medium text-blue-800 hover:underline"
      >
        العودة إلى الفاتورة
      </Link>
    </div>
  );
}

export function InvoiceSettlementLinkBanner() {
  return (
    <Suspense fallback={null}>
      <InvoiceSettlementLinkBannerInner />
    </Suspense>
  );
}
