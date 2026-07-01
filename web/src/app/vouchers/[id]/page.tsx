import { VoucherForm } from "@/modules/vouchers/components/voucher-form";

interface VoucherEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function VoucherEditPage({ params }: VoucherEditPageProps) {
  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <VoucherForm initialMode="edit" initialVoucherId={id} />
    </main>
  );
}
