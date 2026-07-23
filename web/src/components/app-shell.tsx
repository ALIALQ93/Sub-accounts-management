"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppUpdateModal } from "@/components/app-update-modal";
import { CompanyLogo } from "@/components/company-logo";
import { HorizontalNav } from "@/components/horizontal-nav";
import { QuickShortcutsBar } from "@/components/quick-shortcuts-bar";
import { APP_BRANDING } from "@/config/app-branding";
import {
  APP_NAV_SECTIONS,
  isNavSectionActive,
} from "@/config/app-navigation";
import { useAuth } from "@/modules/auth/auth-context";
import { settingsApi } from "@/modules/settings/services/settings-api";
import { ROLE_LABELS } from "@/modules/settings/types";

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
    if (pathname === "/login" || pathname === "/setup") return;
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
    if (pathname === "/login" || pathname === "/setup" || isLoading || authDisabled) {
      return;
    }
    if (!canAccessRoute(pathname)) {
      router.replace("/");
    }
  }, [pathname, isLoading, authDisabled, canAccessRoute, router]);

  const visibleNavSections = useMemo(
    () =>
      APP_NAV_SECTIONS.filter(
        (section) => authDisabled || hasPermission(section.permission),
      ),
    [authDisabled, hasPermission],
  );

  if (pathname === "/login" || pathname === "/setup") {
    return <>{children}</>;
  }

  const onSignOut = async () => {
    await signOut();
    router.replace("/login");
    router.refresh();
  };

  const activeLabel =
    visibleNavSections.find((section) => isNavSectionActive(pathname, section))
      ?.label ?? "شاشة";

  return (
    <div className="flex h-screen w-full flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="app-top-nav relative shrink-0 border-b border-[var(--brand-gold)]/30 bg-gradient-to-l from-[var(--brand-navy)] via-[var(--brand-navy-light)] to-[var(--brand-navy)] shadow-md after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-l after:from-transparent after:via-[var(--brand-gold)]/50 after:to-transparent">
        <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2">
          <div className="flex shrink-0 items-center gap-2">
            <CompanyLogo
              companyName={companyName}
              logoUrl={companyLogoUrl}
              size="sm"
              className="border-white/20 bg-white/10"
            />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-bold text-white">{companyName}</p>
              <p className="text-[10px] text-white/60">
                {APP_BRANDING.productTaglineAr}
              </p>
            </div>
          </div>

          <HorizontalNav />

          <div className="shrink-0 text-left text-xs text-white/90">
            {!isLoading && profile && (
              <div className="grid gap-0.5 text-right">
                <p className="max-w-[140px] truncate font-medium text-white">
                  {profile.full_name_ar}
                </p>
                <p className="text-[10px] text-white/60">
                  {ROLE_LABELS[profile.role]}
                  {authDisabled && " · بدون مصادقة"}
                </p>
                {!authDisabled && (
                  <button
                    type="button"
                    onClick={() => void onSignOut()}
                    className="justify-self-end rounded-md border border-white/15 px-2 py-0.5 text-[10px] font-medium text-[var(--brand-gold-light)] transition hover:border-[var(--brand-gold)]/40 hover:bg-white/10"
                  >
                    خروج
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <QuickShortcutsBar />

      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--brand-border)] bg-white px-4 py-2 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="h-8 w-1 rounded-full bg-gradient-to-b from-[var(--brand-gold)] to-[var(--brand-gold-light)]"
          />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              {APP_BRANDING.productNameAr}
            </p>
            <p className="text-sm font-semibold text-[var(--brand-navy)]">
              {activeLabel}
            </p>
          </div>
        </div>
        <p className="hidden text-[10px] text-slate-400 md:block">
          القوائم تُفتح في تبويب متصفح منفصل
        </p>
      </div>

      <AppUpdateModal />

      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">{children}</div>
    </div>
  );
}
