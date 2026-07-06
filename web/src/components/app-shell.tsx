"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppUpdateModal } from "@/components/app-update-modal";
import { CompanyLogo } from "@/components/company-logo";
import { AppBrandFooter } from "@/components/app-brand-footer";
import { APP_BRANDING } from "@/config/app-branding";
import { useAuth } from "@/modules/auth/auth-context";
import type { PermissionKey } from "@/modules/settings/permissions/permission-catalog";
import { settingsApi } from "@/modules/settings/services/settings-api";
import { ROLE_LABELS } from "@/modules/settings/types";

interface NavItem {
  href: string;
  label: string;
  permission: PermissionKey;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "الرئيسية", permission: "dashboard.view" },
  { href: "/vouchers", label: "السندات", permission: "vouchers.view" },
  { href: "/invoices", label: "الفواتير", permission: "invoices.view" },
  { href: "/accounts", label: "دليل الحسابات", permission: "accounts.view" },
  { href: "/currencies", label: "العملات", permission: "currencies.view" },
  { href: "/cost-centers", label: "مراكز الكلفة", permission: "cost_centers.view" },
  { href: "/customers", label: "العملاء", permission: "customers.view" },
  { href: "/vendors", label: "الموردين", permission: "vendors.view" },
  {
    href: "/open-movements",
    label: "الحركات المفتوحة",
    permission: "open_movements.view",
  },
  { href: "/journals", label: "قيود اليومية", permission: "journals.view" },
  { href: "/reports", label: "التقارير", permission: "reports.view" },
  { href: "/settings", label: "الإعدادات", permission: "settings.company.view" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    profile,
    authDisabled,
    signOut,
    isLoading,
    hasPermission,
    canAccessRoute,
  } = useAuth();
  const [companyName, setCompanyName] = useState<string>(APP_BRANDING.productNameAr);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (pathname === "/login") return;
    let cancelled = false;
    void settingsApi
      .getCompanySettings()
      .then((settings) => {
        if (!cancelled && settings.legal_name_ar) {
          setCompanyName(settings.legal_name_ar);
        }
        if (!cancelled) {
          setCompanyLogoUrl(settings.logo_url);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/login" || isLoading || authDisabled) return;
    if (!canAccessRoute(pathname)) {
      router.replace("/");
    }
  }, [pathname, isLoading, authDisabled, canAccessRoute, router]);

  const visibleNavItems = useMemo(
    () =>
      NAV_ITEMS.filter(
        (item) => authDisabled || hasPermission(item.permission),
      ),
    [authDisabled, hasPermission],
  );

  if (pathname === "/login") {
    return <>{children}</>;
  }

  const onSignOut = async () => {
    await signOut();
    router.replace("/login");
    router.refresh();
  };

  const activeLabel =
    visibleNavItems.find((item) => isActive(pathname, item.href))?.label ??
    "شاشة";

  return (
    <div className="h-screen w-full bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid h-screen w-full grid-cols-1 lg:grid-cols-[252px_minmax(0,1fr)]">
        <aside className="flex max-h-[40vh] flex-col border-b border-[var(--brand-border)] bg-[var(--brand-navy)] lg:max-h-none lg:border-b-0 lg:border-l">
          <div className="border-b border-white/10 p-3">
            <div className="flex items-center gap-2.5">
              <CompanyLogo
                companyName={companyName}
                logoUrl={companyLogoUrl}
                size="sm"
                className="border-white/20 bg-white/10"
              />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-sm font-bold text-white">{companyName}</h1>
                <p className="text-[10px] text-white/60">{APP_BRANDING.productTaglineAr}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-2">
            <div className="grid gap-0.5">
              {visibleNavItems.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-2.5 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-[var(--brand-gold)] text-[var(--brand-navy)] shadow-sm"
                        : "text-white/85 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="hidden border-t border-white/10 bg-[var(--brand-navy-light)] p-3 lg:block">
            <AppBrandFooter compact theme="dark" className="border-none pt-0" />
          </div>
        </aside>

        <div className="flex h-full min-w-0 flex-col overflow-hidden">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--brand-border)] bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {APP_BRANDING.productNameAr}
              </p>
              <p className="text-base font-semibold text-[var(--brand-navy)]">
                {activeLabel}
              </p>
            </div>

            <div className="text-left text-xs text-slate-600">
              {!isLoading && profile && (
                <div className="grid gap-0.5 text-right">
                  <p className="font-medium text-slate-800">{profile.full_name_ar}</p>
                  <p className="text-slate-500">
                    {ROLE_LABELS[profile.role]}
                    {authDisabled && " · وضع بدون مصادقة"}
                  </p>
                  {!authDisabled && (
                    <button
                      type="button"
                      onClick={() => void onSignOut()}
                      className="justify-self-end text-[var(--brand-navy)] hover:text-[var(--brand-gold)] hover:underline"
                    >
                      تسجيل الخروج
                    </button>
                  )}
                </div>
              )}
            </div>
          </header>

          <AppUpdateModal />

          <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
