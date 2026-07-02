"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { isAuthDisabled } from "@/lib/supabase/env";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  ALL_PERMISSION_KEYS,
} from "@/modules/settings/permissions/permission-catalog";
import {
  canAccessRoute,
  hasPermission as checkPermission,
  resolveEffectivePermissions,
} from "@/modules/settings/permissions/permission-utils";
import type { PermissionKey } from "@/modules/settings/permissions/permission-catalog";
import { permissionsApi } from "@/modules/settings/services/permissions-api";
import { settingsApi } from "@/modules/settings/services/settings-api";
import type { UserProfile } from "@/modules/settings/types";

interface AuthContextValue {
  isLoading: boolean;
  user: User | null;
  profile: UserProfile | null;
  permissions: Set<PermissionKey>;
  isAdmin: boolean;
  authDisabled: boolean;
  hasPermission: (key: PermissionKey) => boolean;
  canAccessRoute: (pathname: string) => boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEV_PROFILE: UserProfile = {
  id: "dev-user",
  email: "dev@local.test",
  full_name_ar: "مستخدم تجريبي",
  full_name_en: null,
  role: "admin",
  is_active: true,
};

const DEV_PERMISSIONS = new Set<PermissionKey>(
  ALL_PERMISSION_KEYS as PermissionKey[],
);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const authDisabled = isAuthDisabled();
  const [isLoading, setIsLoading] = useState(!authDisabled);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(
    authDisabled ? DEV_PROFILE : null,
  );
  const [storedPermissions, setStoredPermissions] = useState<string[]>([]);

  const refreshProfile = useCallback(async () => {
    if (authDisabled) {
      setProfile(DEV_PROFILE);
      setStoredPermissions([...ALL_PERMISSION_KEYS]);
      setIsLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    const {
      data: { user: nextUser },
    } = await supabase.auth.getUser();
    setUser(nextUser);

    if (!nextUser) {
      setProfile(null);
      setStoredPermissions([]);
      setIsLoading(false);
      return;
    }

    const nextProfile = await settingsApi.getCurrentProfile();
    if (nextProfile && !nextProfile.is_active) {
      await settingsApi.signOut();
      setUser(null);
      setProfile(null);
      setStoredPermissions([]);
      setIsLoading(false);
      return;
    }

    const keys = await permissionsApi.getUserPermissions(nextUser.id);
    setProfile(nextProfile);
    setStoredPermissions(keys);
    setIsLoading(false);
  }, [authDisabled]);

  useEffect(() => {
    void refreshProfile();

    if (authDisabled) return;

    const supabase = getSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshProfile();
    });

    return () => subscription.unsubscribe();
  }, [authDisabled, refreshProfile]);

  const signOut = useCallback(async () => {
    if (authDisabled) return;
    await settingsApi.signOut();
    setUser(null);
    setProfile(null);
    setStoredPermissions([]);
  }, [authDisabled]);

  const isAdmin = authDisabled || profile?.role === "admin";

  const permissions = useMemo(() => {
    if (authDisabled) return DEV_PERMISSIONS;
    if (!profile) return new Set<PermissionKey>();
    return resolveEffectivePermissions(
      profile.role,
      storedPermissions,
      isAdmin,
    );
  }, [authDisabled, profile, storedPermissions, isAdmin]);

  const hasPermission = useCallback(
    (key: PermissionKey) => checkPermission(permissions, key),
    [permissions],
  );

  const canAccessRouteFn = useCallback(
    (pathname: string) => {
      if (authDisabled) return true;
      return canAccessRoute(permissions, pathname);
    },
    [authDisabled, permissions],
  );

  const value = useMemo(
    () => ({
      isLoading,
      user,
      profile,
      permissions,
      isAdmin,
      authDisabled,
      hasPermission,
      canAccessRoute: canAccessRouteFn,
      refreshProfile,
      signOut,
    }),
    [
      isLoading,
      user,
      profile,
      permissions,
      isAdmin,
      authDisabled,
      hasPermission,
      canAccessRouteFn,
      refreshProfile,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}

export function usePermission(key: PermissionKey): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(key);
}
