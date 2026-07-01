import type { VoucherStatus } from "@/modules/vouchers/types";

const STATUS_LABELS: Record<VoucherStatus, string> = {
  draft: "مسودة",
  approved: "معتمد",
  posted: "مرحل",
  cancelled: "ملغي",
};

const STATUS_STYLES: Record<VoucherStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  approved: "bg-amber-100 text-amber-800",
  posted: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

export function StatusChip({ status }: { status: VoucherStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
