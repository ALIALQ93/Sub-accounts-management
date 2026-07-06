"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/materials",
    label: "بطاقات المواد",
    match: (path: string) =>
      path === "/materials" ||
      (path.startsWith("/materials/") &&
        !path.startsWith("/materials/categories") &&
        !path.startsWith("/materials/warehouses") &&
        !path.startsWith("/materials/settings")),
  },
  {
    href: "/materials/categories",
    label: "الأصناف",
    match: (path: string) => path.startsWith("/materials/categories"),
  },
  {
    href: "/materials/warehouses",
    label: "المستودعات",
    match: (path: string) => path.startsWith("/materials/warehouses"),
  },
  {
    href: "/materials/settings",
    label: "إعدادات الجرد",
    match: (path: string) => path.startsWith("/materials/settings"),
  },
] as const;

export function MaterialsNav() {
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
