"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/modules/auth/auth-context";

const NAV_ITEMS = [
  { href: "/vouchers", label: "كل السندات", match: (path: string) => path === "/vouchers" },
  {
    href: "/vouchers?type=receipt",
    label: "قبض",
    match: (path: string) => path.startsWith("/vouchers/receipt"),
  },
  {
    href: "/vouchers?type=payment",
    label: "دفع",
    match: (path: string) => path.startsWith("/vouchers/payment"),
  },
  {
    href: "/vouchers?type=settlement",
    label: "تصفية",
    match: (path: string) => path.startsWith("/vouchers/settlement"),
  },
  {
    href: "/vouchers/settings",
    label: "إعدادات",
    permission: "vouchers.settings" as const,
    match: (path: string) => path.startsWith("/vouchers/settings"),
  },
] as const;

export function VouchersNav() {
  const pathname = usePathname();
  const { hasPermission } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !("permission" in item) || hasPermission(item.permission),
  );

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {visibleItems.map((item) => {
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
