import type { VoucherStatus } from "@/modules/vouchers/types";
import type { InvoiceOpenItem } from "@/modules/invoices/services/invoice-settlement-api";

export type InvoiceCoverageStatus = "none" | "partial" | "full";

export interface InvoiceCoverageSummary {
  total_open: number;
  total_settled_posted: number;
  total_settled_draft: number;
  total_original: number;
  remaining_open: number;
  coverage_percent: number;
  coverage_status: InvoiceCoverageStatus;
}

export interface InvoiceSettlementVoucherRow {
  voucher_id: string;
  voucher_no: string;
  voucher_type: "receipt" | "payment";
  voucher_date: string;
  status: VoucherStatus;
  allocated_amount: number;
}

export function buildInvoiceCoverageSummary(
  openItems: InvoiceOpenItem[],
  vouchers: InvoiceSettlementVoucherRow[],
): InvoiceCoverageSummary {
  const totalOpen = openItems.reduce((sum, item) => sum + item.open_amount, 0);
  const totalSettledPosted = vouchers
    .filter((voucher) => voucher.status === "posted")
    .reduce((sum, voucher) => sum + voucher.allocated_amount, 0);
  const totalSettledDraft = vouchers
    .filter(
      (voucher) =>
        voucher.status !== "posted" && voucher.status !== "cancelled",
    )
    .reduce((sum, voucher) => sum + voucher.allocated_amount, 0);
  const totalOriginal = totalOpen + totalSettledPosted;
  const coveragePercent =
    totalOriginal > 0
      ? Math.min(100, (totalSettledPosted / totalOriginal) * 100)
      : totalSettledPosted > 0
        ? 100
        : 0;

  let coverageStatus: InvoiceCoverageStatus = "none";
  if (totalOpen <= 0.001 && totalSettledPosted > 0) {
    coverageStatus = "full";
  } else if (totalSettledPosted > 0) {
    coverageStatus = "partial";
  }

  return {
    total_open: totalOpen,
    total_settled_posted: totalSettledPosted,
    total_settled_draft: totalSettledDraft,
    total_original: totalOriginal,
    remaining_open: totalOpen,
    coverage_percent: coveragePercent,
    coverage_status: coverageStatus,
  };
}

export const COVERAGE_STATUS_LABELS: Record<InvoiceCoverageStatus, string> = {
  none: "لم يُسدَّد بعد",
  partial: "تغطية جزئية",
  full: "مغلق بالكامل",
};

export const COVERAGE_STATUS_STYLES: Record<InvoiceCoverageStatus, string> = {
  none: "bg-slate-100 text-slate-700",
  partial: "bg-amber-100 text-amber-900",
  full: "bg-emerald-100 text-emerald-800",
};
