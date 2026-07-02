"use client";

import { useEffect, useState } from "react";
import { VoucherLineCategoriesSettings } from "@/modules/vouchers/components/voucher-line-categories-settings";
import { VoucherSettingsNav } from "@/modules/vouchers/components/voucher-settings-nav";
import { VouchersNav } from "@/modules/vouchers/components/vouchers-nav";
import { voucherLineCategoryApi } from "@/modules/vouchers/services/voucher-line-category-api";
import type { VoucherLineCategory } from "@/modules/vouchers/types";

export default function VoucherLineCategoriesPage() {
  const [lineCategories, setLineCategories] = useState<VoucherLineCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await voucherLineCategoryApi.listCategories();
        if (!cancelled) setLineCategories(data);
      } catch (err) {
        if (!cancelled) {
          setFeedback(
            err instanceof Error ? err.message : "تعذّر تحميل أنواع الأسطر.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex w-full flex-col gap-4">
      <section>
        <h1 className="text-xl font-bold text-slate-900">إعدادات السندات</h1>
        <p className="text-xs text-slate-600">
          تصنيفات عامة لأسطر السند — للتقارير، منفصلة عن كود الحساب.
        </p>
      </section>

      <VouchersNav />
      <VoucherSettingsNav />

      {isLoading && (
        <p className="text-sm text-slate-600">جاري تحميل أنواع الأسطر...</p>
      )}

      {!isLoading && (
        <VoucherLineCategoriesSettings
          categories={lineCategories}
          onChange={setLineCategories}
        />
      )}

      {feedback && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {feedback}
        </p>
      )}

      <p className="text-xs text-slate-500">
        إذا لم تظهر الأنواع، شغّل{" "}
        <span className="font-mono">database/patch_voucher_line_categories.sql</span>{" "}
        في Supabase.
      </p>
    </main>
  );
}
