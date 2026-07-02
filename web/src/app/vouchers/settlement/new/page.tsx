import { VoucherForm } from "@/modules/vouchers/components/voucher-form";
import { VouchersNav } from "@/modules/vouchers/components/vouchers-nav";

export default function NewSettlementVoucherPage() {
  return (
    <main className="flex w-full flex-col gap-4">
      <VouchersNav />
      <VoucherForm initialMode="create" lockedVoucherType="settlement" />
    </main>
  );
}
