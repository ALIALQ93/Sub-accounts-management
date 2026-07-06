"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";

function isMissingRpc(error: PostgrestError | null): boolean {
  return error?.code === "PGRST202" || error?.code === "42P01";
}

function isMissingTable(error: PostgrestError | null): boolean {
  return (
    error?.code === "42P01" ||
    Boolean(error?.message?.includes("invoice_reference_links"))
  );
}

export const invoiceReferenceLinksApi = {
  async listAdditionalReferenceIds(invoiceId: string): Promise<string[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("invoice_reference_links")
      .select("reference_invoice_id, sort_order")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true });

    if (isMissingTable(error)) return [];
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => row.reference_invoice_id as string);
  },

  async syncAdditionalReferences(
    invoiceId: string,
    referenceIds: string[],
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc("sync_invoice_reference_links", {
      p_invoice_id: invoiceId,
      p_reference_ids: referenceIds,
    });

    if (isMissingRpc(error)) return;
    if (error) throw new Error(error.message);
  },
};
