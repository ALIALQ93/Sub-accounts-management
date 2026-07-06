"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { SalesRepOption } from "@/modules/invoices/types";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) {
    throw new Error(error.message || "حدث خطأ غير متوقع من قاعدة البيانات.");
  }
}

export const salesRepApi = {
  async listSalesReps(): Promise<SalesRepOption[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("sales_reps")
      .select("id, rep_code, name_ar, is_active")
      .eq("is_active", true)
      .order("rep_code", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []) as SalesRepOption[];
  },
};
