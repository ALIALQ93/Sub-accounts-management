"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  AppRole,
  CompanySettings,
  CompanySettingsFormValues,
  UserProfile,
} from "@/modules/settings/types";

function throwIfError(error: { message?: string } | null): void {
  if (error) {
    throw new Error(error.message || "حدث خطأ غير متوقع.");
  }
}

const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  id: 1,
  legal_name_ar: "شركتي",
  legal_name_en: null,
  tax_number: null,
  address: null,
  phone: null,
  email: null,
  fiscal_year_start_month: 1,
  base_currency_id: null,
  logo_url: null,
  is_setup_complete: false,
};

export const settingsApi = {
  async getCompanySettings(): Promise<CompanySettings> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("company_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    throwIfError(error);
    return (data as CompanySettings | null) ?? DEFAULT_COMPANY_SETTINGS;
  },

  async updateCompanySettings(
    values: CompanySettingsFormValues,
  ): Promise<CompanySettings> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("company_settings")
      .upsert(
        {
          id: 1,
          legal_name_ar: values.legal_name_ar.trim(),
          legal_name_en: values.legal_name_en.trim() || null,
          tax_number: values.tax_number.trim() || null,
          address: values.address.trim() || null,
          phone: values.phone.trim() || null,
          email: values.email.trim() || null,
          fiscal_year_start_month: values.fiscal_year_start_month,
          base_currency_id: values.base_currency_id || null,
          logo_url: values.logo_url.trim() || null,
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();
    throwIfError(error);
    return data as CompanySettings;
  },

  async getCurrentProfile(): Promise<UserProfile | null> {
    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    throwIfError(error);
    return (data as UserProfile | null) ?? null;
  },

  async listProfiles(): Promise<UserProfile[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });
    throwIfError(error);
    return (data ?? []) as UserProfile[];
  },

  async updateProfile(
    id: string,
    payload: Partial<Pick<UserProfile, "full_name_ar" | "full_name_en" | "role" | "is_active">>,
  ): Promise<UserProfile> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    throwIfError(error);
    return data as UserProfile;
  },

  async signIn(email: string, password: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    throwIfError(error);
  },

  async signOut(): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    throwIfError(error);
  },

  async createUserViaApi(payload: {
    email: string;
    password: string;
    full_name_ar: string;
    full_name_en?: string;
    role: AppRole;
  }): Promise<{ id: string; email: string }> {
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as {
      error?: string;
      user?: { id: string; email: string };
    };

    if (!response.ok) {
      throw new Error(body.error || "فشل إنشاء المستخدم.");
    }

    if (!body.user) {
      throw new Error("لم يُرجَع معرف المستخدم.");
    }

    return body.user;
  },
};
