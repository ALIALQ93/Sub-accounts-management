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
import { settingsApi } from "@/modules/settings/services/settings-api";
import type { UserProfile } from "@/modules/settings/types";

interface AuthContextValue {
  isLoading: boolean;
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  authDisabled: boolean;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const authDisabled = isAuthDisabled();
  const [isLoading, setIsLoading] = useState(!authDisabled);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(
    authDisabled ? DEV_PROFILE : null,
  );

  const refreshProfile = useCallback(async () => {
    if (authDisabled) {
      setProfile(DEV_PROFILE);
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
      setIsLoading(false);
      return;
    }

    const nextProfile = await settingsApi.getCurrentProfile();
    if (nextProfile && !nextProfile.is_active) {
      await settingsApi.signOut();
      setUser(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setProfile(nextProfile);
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
  }, [authDisabled]);

  const value = useMemo(
    () => ({
      isLoading,
      user,
      profile,
      isAdmin: authDisabled || profile?.role === "admin",
      authDisabled,
      refreshProfile,
      signOut,
    }),
    [isLoading, user, profile, authDisabled, refreshProfile, signOut],
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
