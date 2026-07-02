import { VoucherEditRouter } from "@/modules/vouchers/components/voucher-edit-router";
import { VouchersNav } from "@/modules/vouchers/components/vouchers-nav";

interface VoucherEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function VoucherEditPage({ params }: VoucherEditPageProps) {
  const { id } = await params;

  return (
    <main className="flex w-full flex-col gap-4">
      <VouchersNav />
      <VoucherEditRouter voucherId={id} />
    </main>
  );
}
