"use client";

import type { PermissionKey } from "@/modules/settings/permissions/permission-catalog";
import { useAuth } from "@/modules/auth/auth-context";

interface PermissionGateProps {
  permission: PermissionKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return <>{fallback}</>;
  return <>{children}</>;
}

interface AnyPermissionGateProps {
  permissions: PermissionKey[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AnyPermissionGate({
  permissions,
  children,
  fallback = null,
}: AnyPermissionGateProps) {
  const { hasPermission } = useAuth();
  if (!permissions.some((permission) => hasPermission(permission))) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
