"use client";

import Link from "next/link";
import { PermissionGate } from "@/components/permission-gate";

export function ReportsAccessGate({ children }: { children: React.ReactNode }) {
  return (
    <PermissionGate
      permission="reports.view"
      fallback={
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-6">
          <h1 className="text-xl font-bold text-[var(--brand-navy)]">
            التقارير
          </h1>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            ليس لديك صلاحية عرض التقارير (
            <code className="text-xs">reports.view</code>).
          </p>
          <Link href="/" className="text-sm text-blue-900 hover:underline">
            العودة للرئيسية
          </Link>
        </main>
      }
    >
      {children}
    </PermissionGate>
  );
}
