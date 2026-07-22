"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/modules/auth/auth-context";
import { useNotifications } from "@/components/notifications";
import { posApi } from "@/modules/pos/services/pos-api";
import type { PosPoint } from "@/modules/pos/types";

export default function PosHubPage() {
  const { hasPermission } = useAuth();
  const { notifyError } = useNotifications();
  const canSell = hasPermission("pos.sell");
  const canSettings = hasPermission("pos.settings");

  const [points, setPoints] = useState<PosPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void posApi
      .listPoints()
      .then((data) => {
        if (!cancelled) setPoints(data);
      })
      .catch((err) => {
        if (!cancelled) {
          notifyError(
            err instanceof Error ? err.message : "فشل تحميل نقاط البيع.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notifyError]);

  const activePoints = useMemo(
    () => points.filter((point) => point.is_active),
    [points],
  );

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--brand-navy)]">
            نقاط البيع
          </h1>
          <p className="text-xs text-slate-600">
            اختر نقطة لبدء البيع أو انتقل لتعريف النقاط.
          </p>
        </div>
        {canSettings && (
          <Link href="/pos/points" className="btn btn-outline">
            تعريف النقاط
          </Link>
        )}
      </section>

      {isLoading && (
        <p className="text-sm text-slate-600">جاري تحميل نقاط البيع...</p>
      )}

      {!isLoading && activePoints.length === 0 && (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-700">لا توجد نقاط بيع نشطة.</p>
          {canSettings ? (
            <Link
              href="/pos/points/new"
              className="btn btn-primary mt-4 inline-flex"
            >
              تعريف نقطة بيع
            </Link>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              اطلب من المسؤول تعريف نقطة بيع أولاً.
            </p>
          )}
        </section>
      )}

      {!isLoading && activePoints.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {activePoints.map((point) => (
            <article
              key={point.id}
              className="flex flex-col rounded-xl border-2 border-slate-200 bg-white p-5 shadow-sm transition hover:border-[var(--brand-navy)]/40"
            >
              <p className="font-mono text-xs font-semibold text-[var(--brand-gold)]">
                {point.point_code}
              </p>
              <h2 className="mt-1 text-lg font-bold text-[var(--brand-navy)]">
                {point.name_ar}
              </h2>
              <dl className="mt-3 grid gap-1.5 text-sm text-slate-600">
                <div className="flex justify-between gap-2">
                  <dt>الفرع</dt>
                  <dd className="font-medium text-slate-800">
                    {point.branch_name_ar ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>المستودع</dt>
                  <dd className="font-medium text-slate-800">
                    {point.warehouse_name_ar ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>النمط</dt>
                  <dd className="font-medium text-slate-800">
                    {point.pattern_name_ar ?? "—"}
                  </dd>
                </div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-2">
                {canSell && (
                  <Link
                    href={`/pos/sell/${point.id}`}
                    className="btn btn-primary flex-1 justify-center"
                  >
                    فتح البيع
                  </Link>
                )}
                {canSettings && (
                  <Link
                    href={`/pos/points/${point.id}`}
                    className="btn btn-outline flex-1 justify-center"
                  >
                    تعديل
                  </Link>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
