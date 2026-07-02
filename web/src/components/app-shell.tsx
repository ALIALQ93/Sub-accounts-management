"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "الرئيسية" },
  { href: "/vouchers", label: "السندات" },
  { href: "/accounts", label: "دليل الحسابات" },
  { href: "/currencies", label: "العملات" },
  { href: "/customers", label: "العملاء" },
  { href: "/vendors", label: "الموردين" },
  { href: "/open-movements", label: "الحركات المفتوحة" },
  { href: "/journals", label: "قيود اليومية" },
  { href: "/reports/trial-balance", label: "ميزان المراجعة" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="h-screen w-full bg-[#f8f9ff] text-slate-900">
      <div className="grid h-screen w-full grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white p-3 lg:border-b-0 lg:border-l">
          <div className="mb-3 rounded-lg bg-slate-50 p-2.5">
            <h1 className="text-base font-bold">Sub Accounts</h1>
            <p className="text-[11px] text-slate-600">نظام محاسبة وإدارة سندات</p>
          </div>

          <nav className="grid gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-blue-900 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex h-full min-w-0 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-2.5">
            <p className="text-xs text-slate-500">لوحة تشغيل النظام</p>
            <p className="text-sm font-semibold">
              {NAV_ITEMS.find((item) => isActive(pathname, item.href))?.label ??
                "شاشة"}
            </p>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-2 md:p-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
