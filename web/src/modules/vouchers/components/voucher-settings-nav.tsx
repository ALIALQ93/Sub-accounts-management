"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SETTINGS_TABS = [
  {
    href: "/vouchers/settings",
    label: "عام",
    match: (path: string) => path === "/vouchers/settings",
  },
  {
    href: "/vouchers/settings/line-categories",
    label: "أنواع أسطر السند",
    match: (path: string) => path === "/vouchers/settings/line-categories",
  },
] as const;

export function VoucherSettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      {SETTINGS_TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-white text-blue-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
