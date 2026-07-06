"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) {
    throw new Error(error.message || "حدث خطأ غير متوقع من قاعدة البيانات.");
  }
}

function isMissingTable(error: PostgrestError | null): boolean {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    error?.code === "42703"
  );
}

export interface Branch {
  id: string;
  branch_code: string;
  name_ar: string;
  name_en: string | null;
  is_active: boolean;
  is_head_office: boolean;
  default_cost_center_id: string | null;
  inventory_account_id: string | null;
  inter_branch_account_id: string | null;
  address: string | null;
  phone: string | null;
}

export interface BranchOption {
  id: string;
  branch_code: string;
  name_ar: string;
  is_active: boolean;
}

export interface BranchFormValues {
  branch_code: string;
  name_ar: string;
  name_en: string;
  is_active: boolean;
  is_head_office: boolean;
  address: string;
  phone: string;
}

export const branchApi = {
  async listBranches(): Promise<Branch[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("branches")
      .select(
        `
        id,
        branch_code,
        name_ar,
        name_en,
        is_active,
        is_head_office,
        default_cost_center_id,
        inventory_account_id,
        inter_branch_account_id,
        address,
        phone
      `,
      )
      .order("branch_code", { ascending: true });

    if (isMissingTable(error)) return [];
    throwIfSupabaseError(error);
    return (data ?? []) as Branch[];
  },

  async listBranchOptions(): Promise<BranchOption[]> {
    const branches = await this.listBranches();
    return branches.map((branch) => ({
      id: branch.id,
      branch_code: branch.branch_code,
      name_ar: branch.name_ar,
      is_active: branch.is_active,
    }));
  },

  async createBranch(payload: BranchFormValues): Promise<Branch> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("branches")
      .insert({
        branch_code: payload.branch_code.trim().toUpperCase(),
        name_ar: payload.name_ar.trim(),
        name_en: payload.name_en.trim() || null,
        is_active: payload.is_active,
        is_head_office: payload.is_head_office,
        address: payload.address.trim() || null,
        phone: payload.phone.trim() || null,
      })
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as Branch;
  },

  async updateBranch(id: string, payload: Partial<BranchFormValues>): Promise<Branch> {
    const supabase = getSupabaseClient();
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.branch_code != null) {
      patch.branch_code = payload.branch_code.trim().toUpperCase();
    }
    if (payload.name_ar != null) patch.name_ar = payload.name_ar.trim();
    if (payload.name_en != null) {
      patch.name_en = payload.name_en.trim() || null;
    }
    if (payload.is_active != null) patch.is_active = payload.is_active;
    if (payload.is_head_office != null) patch.is_head_office = payload.is_head_office;
    if (payload.address != null) patch.address = payload.address.trim() || null;
    if (payload.phone != null) patch.phone = payload.phone.trim() || null;

    const { data, error } = await supabase
      .from("branches")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as Branch;
  },
};
