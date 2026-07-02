import { SettlementVoucherForm } from "@/modules/vouchers/components/settlement-voucher-form";
import { VouchersNav } from "@/modules/vouchers/components/vouchers-nav";

export default function NewSettlementVoucherPage() {
  return (
    <main className="flex w-full flex-col gap-4">
      <VouchersNav />
      <SettlementVoucherForm initialMode="create" />
    </main>
  );
}
