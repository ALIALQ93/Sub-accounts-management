import type { AppRole } from "@/modules/settings/types";
import {
  ALL_PERMISSIONS_SET,
  ROLE_PERMISSION_DEFAULTS,
  type PermissionKey,
} from "@/modules/settings/permissions/permission-catalog";

export function resolveEffectivePermissions(
  role: AppRole,
  storedPermissions: string[],
  isAdmin: boolean,
): Set<PermissionKey> {
  if (isAdmin || role === "admin") {
    return ALL_PERMISSIONS_SET as Set<PermissionKey>;
  }

  if (storedPermissions.length > 0) {
    return new Set(
      storedPermissions.filter((key): key is PermissionKey =>
        ALL_PERMISSIONS_SET.has(key),
      ),
    );
  }

  return new Set(ROLE_PERMISSION_DEFAULTS[role]);
}

export function hasPermission(
  permissions: Set<PermissionKey>,
  key: PermissionKey,
): boolean {
  return permissions.has(key);
}

export function hasAnyPermission(
  permissions: Set<PermissionKey>,
  keys: PermissionKey[],
): boolean {
  return keys.some((key) => permissions.has(key));
}

const ROUTE_PERMISSIONS: Array<{ prefix: string; permission: PermissionKey }> = [
  { prefix: "/settings/permissions", permission: "settings.permissions.manage" },
  { prefix: "/settings/branches", permission: "settings.company.view" },
  { prefix: "/settings/accounting-periods", permission: "settings.company.view" },
  { prefix: "/settings/company", permission: "settings.company.view" },
  { prefix: "/settings", permission: "settings.company.view" },
  { prefix: "/vouchers/settings", permission: "vouchers.settings" },
  { prefix: "/vouchers/opening-entry", permission: "vouchers.create" },
  { prefix: "/vouchers/receipt/close-movements/new", permission: "vouchers.create" },
  { prefix: "/vouchers/payment/close-movements/new", permission: "vouchers.create" },
  { prefix: "/vouchers/receipt/new", permission: "vouchers.create" },
  { prefix: "/vouchers/payment/new", permission: "vouchers.create" },
  { prefix: "/vouchers/settlement/new", permission: "vouchers.create" },
  { prefix: "/vouchers/new", permission: "vouchers.create" },
  { prefix: "/vouchers", permission: "vouchers.view" },
  { prefix: "/accounts", permission: "accounts.view" },
  { prefix: "/journals", permission: "journals.view" },
  { prefix: "/reports", permission: "reports.view" },
  { prefix: "/currencies", permission: "currencies.view" },
  { prefix: "/cost-centers", permission: "cost_centers.view" },
  { prefix: "/customers", permission: "customers.view" },
  { prefix: "/vendors", permission: "vendors.view" },
  { prefix: "/open-movements", permission: "open_movements.view" },
  { prefix: "/invoices/transfers/new", permission: "invoices.create" },
  { prefix: "/invoices/transfers", permission: "invoices.view" },
  { prefix: "/invoices/patterns/new", permission: "invoices.settings" },
  { prefix: "/invoices/patterns", permission: "invoices.view" },
  { prefix: "/invoices/new", permission: "invoices.create" },
  { prefix: "/invoices", permission: "invoices.view" },
  { prefix: "/", permission: "dashboard.view" },
];

export function getRoutePermission(pathname: string): PermissionKey {
  if (pathname === "/") return "dashboard.view";
  if (pathname.includes("/permissions")) return "settings.permissions.manage";
  if (pathname.startsWith("/settings/users")) return "settings.users.view";
  if (pathname.match(/^\/vouchers\/[^/]+$/)) {
    return "vouchers.view";
  }
  if (pathname.match(/^\/invoices\/transfers\/[^/]+$/)) {
    return "invoices.view";
  }
  if (pathname.match(/^\/invoices\/[^/]+$/) && pathname !== "/invoices/new") {
    return "invoices.view";
  }

  const match = ROUTE_PERMISSIONS.find(
    (entry) => entry.prefix !== "/" && pathname.startsWith(entry.prefix),
  );

  return match?.permission ?? "dashboard.view";
}

export function canAccessRoute(
  permissions: Set<PermissionKey>,
  pathname: string,
): boolean {
  if (pathname === "/login" || pathname === "/setup" || pathname.startsWith("/setup/")) {
    return true;
  }
  const required = getRoutePermission(pathname);
  return permissions.has(required);
}

export function countGrantedPermissions(keys: string[]): number {
  return keys.filter((key) => ALL_PERMISSIONS_SET.has(key)).length;
}
