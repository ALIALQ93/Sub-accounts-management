"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PermissionGate } from "@/components/permission-gate";
import { useNotifications } from "@/components/notifications";
import { useAuth } from "@/modules/auth/auth-context";
import { posApi } from "@/modules/pos/services/pos-api";
import type { PosPoint } from "@/modules/pos/types";

export default function PosPointsPage() {
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

  return (
    <main className="flex w-full flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--brand-navy)]">
            تعريف نقاط البيع
          </h1>
          <p className="text-xs text-slate-600">
            إدارة نقاط البيع وربطها بالفرع والمستودع ونمط الفاتورة.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/pos" className="btn btn-outline">
            شاشة الاختيار
          </Link>
          <PermissionGate permission="pos.settings">
            <Link href="/pos/points/new" className="btn btn-primary">
              نقطة جديدة
            </Link>
          </PermissionGate>
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
        {isLoading && (
          <p className="text-sm text-slate-600">جاري تحميل النقاط...</p>
        )}

        {!isLoading && points.length === 0 && (
          <p className="text-sm text-slate-600">لا توجد نقاط بيع بعد.</p>
        )}

        {!isLoading && points.length > 0 && (
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-start font-medium">الرمز</th>
                <th className="px-3 py-2 text-start font-medium">الاسم</th>
                <th className="px-3 py-2 text-start font-medium">الفرع</th>
                <th className="px-3 py-2 text-start font-medium">المستودع</th>
                <th className="px-3 py-2 text-start font-medium">النمط</th>
                <th className="px-3 py-2 text-center font-medium">الحالة</th>
                <th className="px-3 py-2 text-start font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr
                  key={point.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-[var(--brand-navy)]">
                    {point.point_code}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {point.name_ar}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {point.branch_name_ar ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {point.warehouse_name_ar ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {point.pattern_name_ar ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                        point.is_active
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {point.is_active ? "نشط" : "موقوف"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {canSettings && (
                        <Link
                          href={`/pos/points/${point.id}`}
                          className="text-xs font-medium text-[var(--brand-navy)] hover:underline"
                        >
                          تعديل
                        </Link>
                      )}
                      {canSell && point.is_active && (
                        <Link
                          href={`/pos/sell/${point.id}`}
                          className="text-xs font-medium text-[var(--brand-gold)] hover:underline"
                        >
                          فتح البيع
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
