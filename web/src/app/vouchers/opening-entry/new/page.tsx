import { OpeningEntryVoucherForm } from "@/modules/opening-entry/components/opening-entry-voucher-form";
import { VouchersNav } from "@/modules/vouchers/components/vouchers-nav";

export default function NewOpeningEntryPage() {
  return (
    <main className="flex w-full flex-col gap-4">
      <VouchersNav />
      <OpeningEntryVoucherForm initialMode="create" />
    </main>
  );
}
