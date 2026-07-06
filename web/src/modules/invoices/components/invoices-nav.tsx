"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/invoices",
    label: "الفواتير",
    match: (path: string) => path === "/invoices",
  },
  {
    href: "/invoices/transfers",
    label: "المناقلات",
    match: (path: string) => path.startsWith("/invoices/transfers"),
  },
  {
    href: "/invoices/patterns",
    label: "أنماط الفواتير",
    match: (path: string) => path.startsWith("/invoices/patterns"),
  },
] as const;

export function InvoicesNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {NAV_ITEMS.map((item) => {
        const active = item.match(pathname);
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
