"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";
import type { OpenMovement, OpenMovementFilters } from "@/modules/vouchers/types";

function isMissingRpc(error: PostgrestError | null): boolean {
  return (
    error?.code === "42883" ||
    error?.code === "PGRST202" ||
    error?.code === "42P01" ||
    error?.code === "PGRST205"
  );
}

function isMissingView(error: PostgrestError | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

type ViewRow = {
  journal_line_id: string;
  journal_entry_id: string;
  entry_no: string;
  entry_date: string;
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  branch_id: string | null;
  branch_code: string | null;
  branch_name: string | null;
  cost_center_id: string | null;
  cost_center_code: string | null;
  cost_center_name: string | null;
  party_type: string | null;
  party_id: string | null;
  open_side: "debit" | "credit" | null;
  original_amount: number;
  allocated_amount: number;
  open_amount: number;
  due_date: string | null;
  is_eligible_for_payment: boolean;
  is_overdue: boolean;
  source_invoice_id: string | null;
  line_description: string | null;
};

function mapViewRow(row: ViewRow): OpenMovement {
  return {
    target_journal_line_id: row.journal_line_id,
    journal_entry_id: row.journal_entry_id,
    entry_no: row.entry_no,
    entry_date: row.entry_date,
    account_id: row.account_id,
    account_code: row.account_code ?? undefined,
    account_name: row.account_name ?? undefined,
    branch_id: row.branch_id,
    branch_code: row.branch_code,
    branch_name: row.branch_name,
    cost_center_id: row.cost_center_id,
    cost_center_code: row.cost_center_code,
    cost_center_name: row.cost_center_name,
    party_type: row.party_type,
    party_id: row.party_id,
    open_side: row.open_side,
    original_amount: Number(row.original_amount),
    allocated_amount: Number(row.allocated_amount),
    open_amount: Number(row.open_amount),
    due_date: row.due_date,
    is_eligible_for_payment: row.is_eligible_for_payment,
    is_overdue: row.is_overdue,
    source_invoice_id: row.source_invoice_id,
    line_description: row.line_description,
  };
}

function applyClientFilters(
  rows: OpenMovement[],
  filters: OpenMovementFilters,
): OpenMovement[] {
  return rows.filter((row) => {
    if (filters.branchId && row.branch_id !== filters.branchId) return false;
    if (filters.costCenterId && row.cost_center_id !== filters.costCenterId) {
      return false;
    }
    if (filters.partyType && row.party_type !== filters.partyType) return false;
    if (filters.partyId && row.party_id !== filters.partyId) return false;
    if (
      filters.openSide &&
      filters.openSide !== "all" &&
      row.open_side !== filters.openSide
    ) {
      return false;
    }
    if (filters.eligibleOnly && !row.is_eligible_for_payment) return false;
    if (filters.overdueOnly && !row.is_overdue) return false;
    return row.open_amount > 0;
  });
}

async function listFromView(filters: OpenMovementFilters): Promise<OpenMovement[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("open_items_view")
    .select(
      `
      journal_line_id,
      journal_entry_id,
      entry_no,
      entry_date,
      account_id,
      account_code,
      account_name,
      branch_id,
      branch_code,
      branch_name,
      cost_center_id,
      cost_center_code,
      cost_center_name,
      party_type,
      party_id,
      open_side,
      original_amount,
      allocated_amount,
      open_amount,
      due_date,
      is_eligible_for_payment,
      is_overdue,
      source_invoice_id,
      line_description
    `,
    )
    .gt("open_amount", 0)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("entry_date", { ascending: true })
    .limit(500);

  if (filters.branchId) query = query.eq("branch_id", filters.branchId);
  if (filters.costCenterId) {
    query = query.eq("cost_center_id", filters.costCenterId);
  }
  if (filters.partyType) query = query.eq("party_type", filters.partyType);
  if (filters.partyId) query = query.eq("party_id", filters.partyId);
  if (filters.openSide && filters.openSide !== "all") {
    query = query.eq("open_side", filters.openSide);
  }
  if (filters.eligibleOnly) {
    query = query.eq("is_eligible_for_payment", true);
  }
  if (filters.overdueOnly) query = query.eq("is_overdue", true);

  const { data, error } = await query;
  if (isMissingView(error)) return [];
  if (error) throw new Error(error.message);

  return ((data ?? []) as ViewRow[]).map(mapViewRow);
}

async function listLegacyFallback(): Promise<OpenMovement[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("journal_entry_lines")
    .select(
      "id, account_id, debit, credit, line_description, journal_entries(entry_no), accounts(code, name_ar)",
    )
    .order("created_at", { ascending: false })
    .limit(150);

  if (error) return [];

  return (data ?? []).map((row) => {
    const debit = Number((row as { debit?: number }).debit ?? 0);
    const credit = Number((row as { credit?: number }).credit ?? 0);
    const journalEntry = (row as { journal_entries?: { entry_no?: string } })
      .journal_entries;
    const account = (row as { accounts?: { code?: string; name_ar?: string } })
      .accounts;
    const openAmount = Math.abs(debit - credit);

    return {
      target_journal_line_id: (row as { id: string }).id,
      entry_no: journalEntry?.entry_no ?? "N/A",
      account_id: (row as { account_id: string }).account_id,
      account_code: account?.code,
      account_name: account?.name_ar,
      open_amount: openAmount,
      open_side:
        debit > credit ? "debit" : credit > debit ? "credit" : null,
      line_description: (row as { line_description: string | null })
        .line_description,
    } satisfies OpenMovement;
  });
}

export const openMovementsApi = {
  async list(filters: OpenMovementFilters = {}): Promise<OpenMovement[]> {
    const supabase = getSupabaseClient();

    const rpcParams = {
      p_branch_id: filters.branchId ?? null,
      p_cost_center_id: filters.costCenterId ?? null,
      p_party_type: filters.partyType ?? null,
      p_party_id: filters.partyId ?? null,
      p_open_side:
        filters.openSide && filters.openSide !== "all"
          ? filters.openSide
          : null,
      p_account_id: null,
      p_eligible_only: filters.eligibleOnly ?? false,
      p_include_overdue_only: filters.overdueOnly ?? false,
    };

    const { data, error } = await supabase.rpc("get_open_items", rpcParams);

    if (!isMissingRpc(error) && error) {
      throw new Error(error.message);
    }

    if (!isMissingRpc(error) && data) {
      return applyClientFilters(
        (data as ViewRow[]).map(mapViewRow),
        filters,
      );
    }

    const fromView = await listFromView(filters);
    if (fromView.length > 0) return fromView;

    const legacy = await listLegacyFallback();
    return applyClientFilters(legacy, filters);
  },
};
