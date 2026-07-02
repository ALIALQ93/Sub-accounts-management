"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { DashboardStats } from "@/modules/vouchers/types";

function formatAmount(value: number): string {
  return value.toLocaleString("ar-IQ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function movementHref(stats: DashboardStats): string {
  if (!stats.last_movement) return "#";
  return stats.last_movement.type === "voucher"
    ? `/vouchers/${stats.last_movement.id}`
    : `/journals/${stats.last_movement.id}`;
}

export default function Home() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      try {
        const data = await voucherApi.getDashboardStats();
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل لوحة التحكم.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">لوحة التحكم</h1>
        <p className="mt-1 text-slate-600">
          ملخص سريع للسندات والقيود والحركات الأخيرة.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">عدد السندات</p>
          <p className="mt-2 text-2xl font-bold text-blue-900">
            {isLoading ? "..." : (stats?.voucher_count ?? 0)}
          </p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">قيود اليوم</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {isLoading ? "..." : (stats?.today_journal_count ?? 0)}
          </p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">إجمالي المدين</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {isLoading ? "..." : formatAmount(stats?.total_debit ?? 0)}
          </p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">إجمالي الدائن</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {isLoading ? "..." : formatAmount(stats?.total_credit ?? 0)}
          </p>
        </article>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">آخر حركة</h2>
        {isLoading ? (
          <p className="mt-2 text-sm text-slate-500">جاري التحميل...</p>
        ) : stats?.last_movement ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">
                {stats.last_movement.type === "voucher" ? "سند" : "قيد"}:{" "}
                {stats.last_movement.reference}
              </p>
              <p className="text-sm text-slate-600">
                التاريخ: {stats.last_movement.date} — الحالة:{" "}
                {stats.last_movement.status}
              </p>
              {stats.last_movement.description && (
                <p className="text-sm text-slate-500">
                  {stats.last_movement.description}
                </p>
              )}
            </div>
            <Link
              href={movementHref(stats)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              عرض التفاصيل
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">لا توجد حركات بعد.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">اختصارات سريعة</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/vouchers"
            className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white"
          >
            قائمة السندات
          </Link>
          <Link
            href="/vouchers/new"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            سند جديد
          </Link>
          <Link
            href="/accounts"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            دليل الحسابات
          </Link>
          <Link
            href="/customers"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            العملاء
          </Link>
          <Link
            href="/vendors"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            الموردين
          </Link>
          <Link
            href="/open-movements"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            الحركات المفتوحة
          </Link>
          <Link
            href="/journals"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            قيود اليومية
          </Link>
          <Link
            href="/reports"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            التقارير
          </Link>
        </div>
      </section>
    </main>
  );
}
