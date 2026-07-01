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
  { href: "/vouchers/new", label: "سند جديد" },
  { href: "/accounts", label: "دليل الحسابات" },
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
    <div className="min-h-screen bg-[#f8f9ff] text-slate-900">
      <div className="mx-auto grid min-h-screen w-full max-w-[1440px] grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-200 bg-white p-4 lg:border-b-0 lg:border-l">
          <div className="mb-4 rounded-lg bg-slate-50 p-3">
            <h1 className="text-lg font-bold">Sub Accounts</h1>
            <p className="text-xs text-slate-600">نظام محاسبة وإدارة سندات</p>
          </div>

          <nav className="grid gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
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

        <div className="flex flex-col">
          <header className="border-b border-slate-200 bg-white px-6 py-4">
            <p className="text-sm text-slate-500">لوحة تشغيل النظام</p>
            <p className="text-base font-semibold">
              {NAV_ITEMS.find((item) => isActive(pathname, item.href))?.label ??
                "شاشة"}
            </p>
          </header>

          <div className="flex-1 p-4 md:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
