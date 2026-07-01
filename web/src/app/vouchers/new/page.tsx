import { VoucherForm } from "@/modules/vouchers/components/voucher-form";

export default function NewVoucherPage() {
  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <VoucherForm initialMode="create" />
    </main>
  );
}
