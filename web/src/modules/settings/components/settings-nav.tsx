"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/settings", label: "نظرة عامة", match: (path: string) => path === "/settings" },
  {
    href: "/settings/company",
    label: "بيانات الشركة",
    match: (path: string) => path === "/settings/company",
  },
  {
    href: "/settings/branches",
    label: "الفروع",
    match: (path: string) => path.startsWith("/settings/branches"),
  },
  {
    href: "/settings/accounting-periods",
    label: "الفترات المحاسبية",
    match: (path: string) => path.startsWith("/settings/accounting-periods"),
  },
  {
    href: "/settings/users",
    label: "المستخدمون",
    match: (path: string) =>
      path.startsWith("/settings/users") &&
      !path.includes("/permissions"),
  },
  {
    href: "/settings/permissions",
    label: "الصلاحيات",
    match: (path: string) => path.startsWith("/settings/permissions"),
  },
  {
    href: "/settings/about",
    label: "عن البرنامج",
    match: (path: string) => path === "/settings/about",
  },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-blue-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
