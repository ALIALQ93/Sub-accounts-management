"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";

function isMissingView(error: PostgrestError | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

export type AgingBucketKey =
  | "current"
  | "days_1_30"
  | "days_31_60"
  | "days_61_90"
  | "days_90_plus"
  | "no_due_date";

export interface AgingOpenItemRow {
  journal_line_id: string;
  entry_no: string;
  entry_date: string;
  party_type: string | null;
  party_id: string | null;
  party_name_ar: string | null;
  account_code: string | null;
  account_name: string | null;
  cost_center_code: string | null;
  open_amount: number;
  due_date: string | null;
  source_invoice_id: string | null;
  bucket: AgingBucketKey;
  bucket_label: string;
  days_overdue: number | null;
}

const BUCKET_LABELS: Record<AgingBucketKey, string> = {
  current: "غير مستحق",
  days_1_30: "1–30 يوم",
  days_31_60: "31–60 يوم",
  days_61_90: "61–90 يوم",
  days_90_plus: "أكثر من 90 يوم",
  no_due_date: "بدون تاريخ استحقاق",
};

export function classifyAgingBucket(
  dueDate: string | null,
  referenceDate = new Date(),
): { bucket: AgingBucketKey; daysOverdue: number | null } {
  if (!dueDate) {
    return { bucket: "no_due_date", daysOverdue: null };
  }

  const due = new Date(`${dueDate}T00:00:00`);
  const ref = new Date(referenceDate.toISOString().split("T")[0] + "T00:00:00");
  const diffMs = ref.getTime() - due.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days <= 0) {
    return { bucket: "current", daysOverdue: days < 0 ? null : 0 };
  }
  if (days <= 30) return { bucket: "days_1_30", daysOverdue: days };
  if (days <= 60) return { bucket: "days_31_60", daysOverdue: days };
  if (days <= 90) return { bucket: "days_61_90", daysOverdue: days };
  return { bucket: "days_90_plus", daysOverdue: days };
}

type ViewRow = {
  journal_line_id: string;
  entry_no: string;
  entry_date: string;
  party_type: string | null;
  party_id: string | null;
  account_code: string | null;
  account_name: string | null;
  cost_center_code: string | null;
  open_amount: number;
  due_date: string | null;
  source_invoice_id: string | null;
  customers: { name_ar: string } | { name_ar: string }[] | null;
  vendors: { name_ar: string } | { name_ar: string }[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export const openItemsReportApi = {
  async listAgingRows(options: {
    partyType?: "customer" | "vendor";
  }): Promise<AgingOpenItemRow[]> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from("open_items_view")
      .select(
        `
        journal_line_id,
        entry_no,
        entry_date,
        party_type,
        party_id,
        account_code,
        account_name,
        cost_center_code,
        open_amount,
        due_date,
        source_invoice_id,
        customers ( name_ar ),
        vendors ( name_ar )
      `,
      )
      .gt("open_amount", 0)
      .order("due_date", { ascending: true, nullsFirst: false });

    if (options.partyType) {
      query = query.eq("party_type", options.partyType);
    }

    const { data, error } = await query;
    if (isMissingView(error)) return [];
    if (error) throw new Error(error.message);

    return ((data ?? []) as unknown as ViewRow[]).map((row) => {
      const { bucket, daysOverdue } = classifyAgingBucket(row.due_date);
      const customer = firstRelation(row.customers);
      const vendor = firstRelation(row.vendors);

      return {
        journal_line_id: row.journal_line_id,
        entry_no: row.entry_no,
        entry_date: row.entry_date,
        party_type: row.party_type,
        party_id: row.party_id,
        party_name_ar: customer?.name_ar ?? vendor?.name_ar ?? null,
        account_code: row.account_code,
        account_name: row.account_name,
        cost_center_code: row.cost_center_code,
        open_amount: Number(row.open_amount),
        due_date: row.due_date,
        source_invoice_id: row.source_invoice_id,
        bucket,
        bucket_label: BUCKET_LABELS[bucket],
        days_overdue: daysOverdue,
      };
    });
  },

  summarizeByBucket(rows: AgingOpenItemRow[]): Record<AgingBucketKey, number> {
    const totals: Record<AgingBucketKey, number> = {
      current: 0,
      days_1_30: 0,
      days_31_60: 0,
      days_61_90: 0,
      days_90_plus: 0,
      no_due_date: 0,
    };

    for (const row of rows) {
      totals[row.bucket] += row.open_amount;
    }

    return totals;
  },

  summarizeByParty(rows: AgingOpenItemRow[]): AgingPartySummaryRow[] {
    const map = new Map<string, AgingPartySummaryRow>();

    for (const row of rows) {
      const key = row.party_id ?? `unknown:${row.journal_line_id}`;
      const existing = map.get(key);

      if (!existing) {
        map.set(key, {
          party_id: row.party_id,
          party_type: row.party_type,
          party_name_ar: row.party_name_ar,
          totals: {
            current: 0,
            days_1_30: 0,
            days_31_60: 0,
            days_61_90: 0,
            days_90_plus: 0,
            no_due_date: 0,
          },
          grand_total: 0,
          line_count: 0,
        });
      }

      const summary = map.get(key)!;
      summary.totals[row.bucket] += row.open_amount;
      summary.grand_total += row.open_amount;
      summary.line_count += 1;
    }

    return Array.from(map.values()).sort(
      (left, right) => right.grand_total - left.grand_total,
    );
  },
};

export interface AgingPartySummaryRow {
  party_id: string | null;
  party_type: string | null;
  party_name_ar: string | null;
  totals: Record<AgingBucketKey, number>;
  grand_total: number;
  line_count: number;
}

export { BUCKET_LABELS };
