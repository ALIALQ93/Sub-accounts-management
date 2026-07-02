"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/modules/auth/auth-context";
import { settingsApi } from "@/modules/settings/services/settings-api";
import { ROLE_LABELS } from "@/modules/settings/types";

interface NavItem {
  href: string;
  label: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "الرئيسية" },
  { href: "/vouchers", label: "السندات" },
  { href: "/accounts", label: "دليل الحسابات" },
  { href: "/currencies", label: "العملات" },
  { href: "/cost-centers", label: "مراكز الكلفة" },
  { href: "/customers", label: "العملاء" },
  { href: "/vendors", label: "الموردين" },
  { href: "/open-movements", label: "الحركات المفتوحة" },
  { href: "/journals", label: "قيود اليومية" },
  { href: "/reports", label: "التقارير" },
  { href: "/settings", label: "الإعدادات", adminOnly: false },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, isAdmin, authDisabled, signOut, isLoading } = useAuth();
  const [companyName, setCompanyName] = useState("Sub Accounts");

  useEffect(() => {
    if (pathname === "/login") return;
    let cancelled = false;
    void settingsApi
      .getCompanySettings()
      .then((settings) => {
        if (!cancelled && settings.legal_name_ar) {
          setCompanyName(settings.legal_name_ar);
        }
      })
      .catch(() => {
        /* optional — keep default title */
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  const onSignOut = async () => {
    await signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="h-screen w-full bg-[#f8f9ff] text-slate-900">
      <div className="grid h-screen w-full grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white p-3 lg:border-b-0 lg:border-l">
          <div className="mb-3 rounded-lg bg-slate-50 p-2.5">
            <h1 className="text-base font-bold">{companyName}</h1>
            <p className="text-[11px] text-slate-600">نظام محاسبة وإدارة سندات</p>
          </div>

          <nav className="grid gap-0.5">
            {visibleNavItems.map((item) => {
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
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
            <div>
              <p className="text-xs text-slate-500">لوحة تشغيل النظام</p>
              <p className="text-sm font-semibold">
                {visibleNavItems.find((item) => isActive(pathname, item.href))?.label ??
                  "شاشة"}
              </p>
            </div>

            <div className="text-left text-xs text-slate-600">
              {!isLoading && profile && (
                <div className="grid gap-0.5">
                  <p className="font-medium text-slate-800">{profile.full_name_ar}</p>
                  <p>
                    {ROLE_LABELS[profile.role]}
                    {authDisabled && " · وضع بدون مصادقة"}
                  </p>
                  {!authDisabled && (
                    <button
                      type="button"
                      onClick={() => void onSignOut()}
                      className="justify-self-end text-blue-900 hover:underline"
                    >
                      تسجيل الخروج
                    </button>
                  )}
                </div>
              )}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-2 md:p-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
