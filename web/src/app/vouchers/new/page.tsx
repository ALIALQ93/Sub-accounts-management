"use client";

import Link from "next/link";
import { VouchersNav } from "@/modules/vouchers/components/vouchers-nav";
import {
  VOUCHER_TYPE_CONFIG,
  VOUCHER_TYPES,
} from "@/modules/vouchers/utils/voucher-type-config";

export default function NewVoucherPickerPage() {
  return (
    <main className="flex w-full flex-col gap-4">
      <section>
        <h1 className="text-xl font-bold text-slate-900">اختر نوع السند</h1>
        <p className="text-xs text-slate-600">
          كل نوع له نافذة مخصصة وترقيم تلقائي مستقل.
        </p>
      </section>

      <VouchersNav />

      <section className="grid gap-4 md:grid-cols-3">
        {VOUCHER_TYPES.map((type) => {
          const config = VOUCHER_TYPE_CONFIG[type];
          return (
            <Link
              key={type}
              href={config.newRoute}
              className={`rounded-xl border p-5 transition hover:shadow-md ${config.colorClass}`}
            >
              <p className="text-lg font-bold">{config.labelAr}</p>
              <p className="mt-2 text-sm opacity-90">{config.descriptionAr}</p>
              <p className="mt-4 text-sm font-semibold">فتح النافذة ←</p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
