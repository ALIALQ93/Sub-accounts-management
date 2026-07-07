"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  APP_NAV_SECTIONS,
  isNavSectionActive,
  type NavSection,
} from "@/config/app-navigation";
import { NavDropdown } from "@/components/nav-dropdown";
import { NavTabLink } from "@/components/nav-tab-link";
import { useAuth } from "@/modules/auth/auth-context";
import type { PermissionKey } from "@/modules/settings/permissions/permission-catalog";

export function HorizontalNav() {
  const pathname = usePathname();
  const { authDisabled, hasPermission } = useAuth();

  const canAccess = (permission?: PermissionKey) =>
    authDisabled || !permission || hasPermission(permission);

  const visibleSections = useMemo(
    () => APP_NAV_SECTIONS.filter((section) => canAccess(section.permission)),
    [authDisabled, hasPermission],
  );

  return (
    <nav
      aria-label="القائمة الرئيسية"
      className="flex flex-1 items-center gap-0.5 overflow-x-auto px-2 py-1.5 [scrollbar-width:thin]"
    >
      {visibleSections.map((section) => (
        <NavSectionItem
          key={section.id}
          section={section}
          pathname={pathname}
          canAccess={canAccess}
        />
      ))}
    </nav>
  );
}

function NavSectionItem({
  section,
  pathname,
  canAccess,
}: {
  section: NavSection;
  pathname: string;
  canAccess: (permission?: PermissionKey) => boolean;
}) {
  const active = isNavSectionActive(pathname, section);

  if (section.children?.length) {
    return (
      <NavDropdown
        label={section.label}
        items={section.children}
        isActive={active}
        canAccess={canAccess}
      />
    );
  }

  const linkClass = active
    ? "bg-[var(--brand-gold)] text-[var(--brand-navy)] shadow-sm"
    : "text-white/90 hover:bg-white/10 hover:text-white";

  return (
    <NavTabLink
      href={section.href}
      className={`shrink-0 rounded-md px-2.5 py-1.5 text-sm font-medium transition ${linkClass}`}
    >
      {section.label}
    </NavTabLink>
  );
}
