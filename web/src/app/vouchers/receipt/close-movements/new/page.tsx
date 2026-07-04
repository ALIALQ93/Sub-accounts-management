import { ReceiptVoucherForm } from "@/modules/vouchers/components/receipt-voucher-form";
import { VouchersNav } from "@/modules/vouchers/components/vouchers-nav";

export default function NewReceiptCloseMovementsPage() {
  return (
    <main className="flex w-full flex-col gap-4">
      <VouchersNav />
      <ReceiptVoucherForm initialMode="create" lockedSettlementMode="invoice" />
    </main>
  );
}
