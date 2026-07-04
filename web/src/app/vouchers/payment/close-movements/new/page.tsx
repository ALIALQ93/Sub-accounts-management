import { PaymentVoucherForm } from "@/modules/vouchers/components/payment-voucher-form";
import { VouchersNav } from "@/modules/vouchers/components/vouchers-nav";

export default function NewPaymentCloseMovementsPage() {
  return (
    <main className="flex w-full flex-col gap-4">
      <VouchersNav />
      <PaymentVoucherForm initialMode="create" lockedSettlementMode="invoice" />
    </main>
  );
}
