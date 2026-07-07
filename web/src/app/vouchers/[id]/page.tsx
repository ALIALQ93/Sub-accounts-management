import { Suspense } from "react";
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
      <Suspense
        fallback={
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm">
            جاري تحميل السند...
          </div>
        }
      >
        <VoucherEditRouter voucherId={id} />
      </Suspense>
    </main>
  );
}
