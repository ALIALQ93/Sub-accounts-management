"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/modules/auth/auth-context";

const NAV_ITEMS = [
  { href: "/vouchers", label: "كل السندات", match: (path: string) => path === "/vouchers" },
  {
    href: "/vouchers?type=receipt",
    label: "قبض",
    match: (path: string) =>
      path.startsWith("/vouchers/receipt") && !path.includes("/close-movements"),
  },
  {
    href: "/vouchers?type=payment",
    label: "دفع",
    match: (path: string) =>
      path.startsWith("/vouchers/payment") && !path.includes("/close-movements"),
  },
  {
    href: "/vouchers?type=settlement",
    label: "تصفية",
    match: (path: string) => path.startsWith("/vouchers/settlement"),
  },
  {
    href: "/vouchers?settlement=invoice",
    label: "إغلاق حركات",
    match: (path: string) => path.includes("/close-movements"),
  },
  {
    href: "/vouchers/opening-entry",
    label: "قيد افتتاحي",
    match: (path: string) => path.startsWith("/vouchers/opening-entry"),
  },
  {
    href: "/vouchers/settings",
    label: "إعدادات",
    permission: "vouchers.settings" as const,
    match: (path: string) => path.startsWith("/vouchers/settings"),
  },
] as const;

function VouchersNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const settlementFilter = searchParams.get("settlement");
  const { hasPermission } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !("permission" in item) || hasPermission(item.permission),
  );

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {visibleItems.map((item) => {
        const active =
          item.label === "إغلاق حركات"
            ? pathname.includes("/close-movements") ||
              (pathname === "/vouchers" && settlementFilter === "invoice")
            : item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-blue-900 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function VouchersNavFallback() {
  return (
    <nav
      aria-hidden
      className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 opacity-60"
    >
      {NAV_ITEMS.map((item) => (
        <span
          key={item.href}
          className="rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-500"
        >
          {item.label}
        </span>
      ))}
    </nav>
  );
}

export function VouchersNav() {
  return (
    <Suspense fallback={<VouchersNavFallback />}>
      <VouchersNavInner />
    </Suspense>
  );
}
