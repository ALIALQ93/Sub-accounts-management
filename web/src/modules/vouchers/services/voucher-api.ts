"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import { deleteVoucherAttachmentFile } from "@/lib/supabase/storage";
import { notifyAccountsChanged } from "@/lib/reference-data-events";
import { costCenterApi } from "@/modules/cost-centers/services/cost-center-api";
import type {
  AccountStatementAccountSummary,
  AccountStatementLine,
  AccountStatementParams,
  AccountStatementResult,
} from "@/modules/accounts/types";
import { resolveStatementLineAmounts } from "@/modules/reports/utils/account-statement-utils";
import { mapRpcTrialBalanceRow } from "@/modules/reports/utils/trial-balance-utils";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import {
  computeNextSequencePreview,
  formatVoucherNo,
} from "@/modules/vouchers/utils/format-voucher-no";
import type {
  VoucherNumberSequence,
  VoucherSettings,
} from "@/modules/vouchers/types/voucher-settings";
import {
  DEFAULT_VOUCHER_SETTINGS,
  DEFAULT_VOUCHER_SEQUENCES,
  DEFAULT_VOUCHER_TYPE_DEFAULTS,
} from "@/modules/vouchers/types/voucher-settings";
import type {
  Account,
  ApiErrorPayload,
  CostCenter,
  Customer,
  DashboardLastMovement,
  DashboardStats,
  JournalEntryDetails,
  JournalEntryLineDetail,
  JournalEntryListItem,
  OpenMovement,
  PostVoucherResponse,
  TrialBalanceRow,
  TrialBalanceParams,
  Vendor,
  VoucherAllocation,
  VoucherDetails,
  VoucherHeader,
  VoucherListItem,
  VoucherLine,
  VoucherType,
  VoucherTypeDefaults,
} from "@/modules/vouchers/types";
import type { PostgrestError } from "@supabase/supabase-js";
import { formatSupabaseErrorMessage } from "@/modules/vouchers/utils/supabase-error-utils";
import { sanitizeVoucherHeaderPayload } from "@/modules/vouchers/utils/voucher-payload-utils";

class ApiError extends Error {
  code: string;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.code = payload.code;
    this.name = "ApiError";
  }
}

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) {
    throw new ApiError({
      code: error.code || "SUPABASE_ERROR",
      message: formatSupabaseErrorMessage(error),
    });
  }
}

export interface SupabaseConnectionStatus {
  configured: boolean;
  supabaseHost: string;
  accountCount: number | null;
  errorMessage: string | null;
}

export const voucherApi = {
  async checkSupabaseConnection(): Promise<SupabaseConnectionStatus> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const keyConfigured = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    const configured = Boolean(url && keyConfigured);

    let supabaseHost = "غير مضبوط";
    try {
      if (url) supabaseHost = new URL(url).hostname;
    } catch {
      supabaseHost = "رابط غير صالح";
    }

    if (!configured) {
      return {
        configured: false,
        supabaseHost,
        accountCount: null,
        errorMessage:
          "متغيرات Supabase غير موجودة في build الاستضافة. أضف NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY في Vercel ثم أعد النشر.",
      };
    }

    try {
      const supabase = getSupabaseClient();
      const { count, error } = await supabase
        .from("accounts")
        .select("id", { count: "exact", head: true });

      if (error) {
        return {
          configured: true,
          supabaseHost,
          accountCount: null,
          errorMessage: error.message,
        };
      }

      return {
        configured: true,
        supabaseHost,
        accountCount: count ?? 0,
        errorMessage: null,
      };
    } catch (err) {
      return {
        configured: true,
        supabaseHost,
        accountCount: null,
        errorMessage:
          err instanceof Error ? err.message : "فشل الاتصال بقاعدة البيانات.",
      };
    }
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const supabase = getSupabaseClient();
    const today = new Date().toISOString().slice(0, 10);

    const [
      vouchersCountRes,
      todayJournalsRes,
      linesRes,
      lastVoucherRes,
      lastJournalRes,
    ] = await Promise.all([
      supabase.from("vouchers").select("id", { count: "exact", head: true }),
      supabase
        .from("journal_entries")
        .select("id", { count: "exact", head: true })
        .eq("entry_date", today),
      supabase
        .from("journal_entry_lines")
        .select("debit, credit, journal_entries!inner(status)")
        .eq("journal_entries.status", "posted")
        .limit(10000),
      supabase
        .from("vouchers")
        .select("id, voucher_no, voucher_date, status, description, created_at")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("journal_entries")
        .select("id, entry_no, entry_date, status, description, created_at")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    throwIfSupabaseError(vouchersCountRes.error);
    throwIfSupabaseError(todayJournalsRes.error);
    throwIfSupabaseError(linesRes.error);
    throwIfSupabaseError(lastVoucherRes.error);
    throwIfSupabaseError(lastJournalRes.error);

    let totalDebit = 0;
    let totalCredit = 0;
    for (const row of linesRes.data ?? []) {
      totalDebit += Number((row as { debit?: number }).debit ?? 0);
      totalCredit += Number((row as { credit?: number }).credit ?? 0);
    }

    const lastVoucher = lastVoucherRes.data?.[0] as
      | {
          id: string;
          voucher_no: string;
          voucher_date: string;
          status: string;
          description: string | null;
          created_at: string;
        }
      | undefined;
    const lastJournal = lastJournalRes.data?.[0] as
      | {
          id: string;
          entry_no: string;
          entry_date: string;
          status: string;
          description: string | null;
          created_at: string;
        }
      | undefined;

    let lastMovement: DashboardLastMovement | null = null;

    if (lastVoucher && lastJournal) {
      const voucherIsNewer =
        new Date(lastVoucher.created_at).getTime() >=
        new Date(lastJournal.created_at).getTime();
      if (voucherIsNewer) {
        lastMovement = {
          type: "voucher",
          id: lastVoucher.id,
          reference: lastVoucher.voucher_no,
          date: lastVoucher.voucher_date,
          description: lastVoucher.description,
          status: lastVoucher.status,
        };
      } else {
        lastMovement = {
          type: "journal",
          id: lastJournal.id,
          reference: lastJournal.entry_no,
          date: lastJournal.entry_date,
          description: lastJournal.description,
          status: lastJournal.status,
        };
      }
    } else if (lastVoucher) {
      lastMovement = {
        type: "voucher",
        id: lastVoucher.id,
        reference: lastVoucher.voucher_no,
        date: lastVoucher.voucher_date,
        description: lastVoucher.description,
        status: lastVoucher.status,
      };
    } else if (lastJournal) {
      lastMovement = {
        type: "journal",
        id: lastJournal.id,
        reference: lastJournal.entry_no,
        date: lastJournal.entry_date,
        description: lastJournal.description,
        status: lastJournal.status,
      };
    }

    return {
      voucher_count: vouchersCountRes.count ?? 0,
      today_journal_count: todayJournalsRes.count ?? 0,
      total_debit: totalDebit,
      total_credit: totalCredit,
      last_movement: lastMovement,
    };
  },

  async listVouchers(): Promise<VoucherListItem[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("vouchers")
      .select(
        "id, voucher_no, voucher_type, settlement_mode, voucher_date, status, description, currency_id, exchange_rate, currencies(code), voucher_attachments(count), voucher_lines(amount, side, amount_base)",
      )
      .order("voucher_date", { ascending: false });
    throwIfSupabaseError(error);

    return (data ?? []).map((row) => {
      const attachments = (
        row as {
          voucher_attachments?: { count: number }[];
        }
      ).voucher_attachments;
      const currency = (
        row as {
          currencies?: { code?: string } | { code?: string }[] | null;
        }
      ).currencies;
      const currencyCode = Array.isArray(currency)
        ? currency[0]?.code ?? null
        : currency?.code ?? null;
      const lines =
        (
          row as {
            voucher_lines?: {
              amount?: number;
              side?: string;
              amount_base?: number | null;
            }[];
          }
        ).voucher_lines ?? [];
      const exchangeRate =
        row.exchange_rate == null ? null : Number(row.exchange_rate);
      const totalAmount = lines
        .filter((line) => line.side === "debit")
        .reduce((sum, line) => sum + Number(line.amount ?? 0), 0);
      let totalAmountBase = lines
        .filter((line) => line.side === "debit")
        .reduce((sum, line) => sum + Number(line.amount_base ?? 0), 0);
      if (totalAmountBase <= 0 && totalAmount > 0) {
        const rate = exchangeRate && exchangeRate > 0 ? exchangeRate : 1;
        totalAmountBase = Math.round(totalAmount * rate * 100) / 100;
      }

      return {
        id: row.id as string,
        voucher_no: row.voucher_no as string,
        voucher_type: row.voucher_type as VoucherListItem["voucher_type"],
        settlement_mode: row.settlement_mode as VoucherListItem["settlement_mode"],
        voucher_date: row.voucher_date as string,
        status: row.status as VoucherListItem["status"],
        description: (row.description as string | null) ?? null,
        attachment_count: attachments?.[0]?.count ?? 0,
        currency_id: (row.currency_id as string | null) ?? null,
        currency_code: currencyCode,
        exchange_rate: exchangeRate,
        total_amount: totalAmount,
        total_amount_base: totalAmountBase,
      };
    });
  },

  async listAccounts(): Promise<Account[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("accounts")
      .select("id, code, name_ar, name_en, sub_code, currency_id, is_postable, is_active, parent_id, level")
      .eq("is_active", true)
      .eq("is_postable", true)
      .order("code", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []) as Account[];
  },

  async listAllAccounts(): Promise<Account[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("accounts")
      .select("id, code, name_ar, name_en, sub_code, currency_id, is_postable, is_active, parent_id, level")
      .order("code", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []) as Account[];
  },

  async listAccountIdsWithJournalMovements(): Promise<Set<string>> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc(
      "get_account_ids_with_journal_movements",
    );
    if (error?.code === "42883" || error?.code === "PGRST202") {
      return new Set<string>();
    }
    throwIfSupabaseError(error);
    return new Set(
      (data ?? []).map((row: { account_id: string }) => String(row.account_id)),
    );
  },

  async createAccount(payload: Partial<Account>): Promise<Account> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("accounts")
      .insert(payload)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    notifyAccountsChanged();
    return data as Account;
  },

  async bulkCreateAccounts(rows: Partial<Account>[]): Promise<Account[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("bulk_create_accounts", {
      p_rows: rows,
    });
    throwIfSupabaseError(error);
    notifyAccountsChanged();
    return (data ?? []) as Account[];
  },

  async updateAccount(id: string, payload: Partial<Account>): Promise<Account> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("accounts")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    notifyAccountsChanged();
    return data as Account;
  },

  async listAccountStatement(
    params: AccountStatementParams | string,
    legacyFromDate?: string,
    legacyToDate?: string,
  ): Promise<AccountStatementResult> {
    const resolved: AccountStatementParams =
      typeof params === "string"
        ? {
            accountId: params,
            fromDate: legacyFromDate,
            toDate: legacyToDate,
          }
        : params;

    const accountIds = [
      ...new Set(
        (resolved.accountIds?.length
          ? resolved.accountIds
          : resolved.accountId
            ? [resolved.accountId]
            : []
        ).filter(Boolean),
      ),
    ];

    if (accountIds.length === 0) {
      return {
        opening_balance: 0,
        lines: [],
        total_debit: 0,
        total_credit: 0,
        closing_balance: 0,
        account_summaries: [],
      };
    }

    const { fromDate, toDate, costCenterId, displayCurrencyId, onlyDisplayCurrency } =
      resolved;
    const supabase = getSupabaseClient();
    const currencies = await currencyApi.listActiveCurrencies();
    const displayCurrency =
      currencies.find((currency) => currency.id === displayCurrencyId) ??
      currencies.find((currency) => currency.is_base) ??
      currencies[0];

    const { data: accountRows, error: accountError } = await supabase
      .from("accounts")
      .select("id, code, name_ar, sub_code, currency_id")
      .in("id", accountIds);
    throwIfSupabaseError(accountError);

    const accountById = new Map(
      (accountRows ?? []).map((row) => [
        (row as { id: string }).id,
        row as {
          id: string;
          code: string;
          name_ar: string;
          sub_code: string | null;
          currency_id: string | null;
        },
      ]),
    );

    const currencyCodeById = new Map(
      currencies.map((currency) => [currency.id, currency.code]),
    );

    const scopedAccountIds = accountIds.filter((id) => {
      const account = accountById.get(id);
      if (!account) return false;
      if (!onlyDisplayCurrency || !displayCurrency) return true;
      return account.currency_id === displayCurrency.id;
    });

    if (scopedAccountIds.length === 0) {
      return {
        opening_balance: 0,
        lines: [],
        total_debit: 0,
        total_credit: 0,
        closing_balance: 0,
        account_summaries: accountIds.map((id) => {
          const account = accountById.get(id);
          return {
            account_id: id,
            account_code: account?.code ?? "—",
            account_name: account?.name_ar ?? "—",
            opening_balance: 0,
            total_debit: 0,
            total_credit: 0,
            closing_balance: 0,
          };
        }),
      };
    }

    const openingByAccount = new Map<string, number>();
    for (const accountId of scopedAccountIds) {
      openingByAccount.set(accountId, 0);
    }

    if (fromDate) {
      let openingQuery = supabase
        .from("journal_entry_lines")
        .select(
          "account_id, debit, credit, debit_base, credit_base, currency_id, exchange_rate, journal_entries!inner(entry_date, status)",
        )
        .in("account_id", scopedAccountIds)
        .eq("journal_entries.status", "posted")
        .lt("journal_entries.entry_date", fromDate);

      if (costCenterId) {
        openingQuery = openingQuery.eq("cost_center_id", costCenterId);
      }

      const { data: openingRows, error: openingError } = await openingQuery;
      throwIfSupabaseError(openingError);

      for (const row of openingRows ?? []) {
        const accountId = (row as { account_id: string }).account_id;
        const account = accountById.get(accountId);
        const debit = Number((row as { debit?: number }).debit ?? 0);
        const credit = Number((row as { credit?: number }).credit ?? 0);
        const debitBase = Number((row as { debit_base?: number }).debit_base ?? 0);
        const creditBase = Number((row as { credit_base?: number }).credit_base ?? 0);
        const lineCurrencyId =
          (row as { currency_id?: string | null }).currency_id ?? null;
        const lineExchangeRate =
          (row as { exchange_rate?: number | null }).exchange_rate ?? null;

        const resolved = displayCurrency
          ? resolveStatementLineAmounts({
              debit,
              credit,
              debitBase,
              creditBase,
              lineCurrencyId,
              lineExchangeRate,
              accountCurrencyId: account?.currency_id ?? null,
              displayCurrency,
              currencies,
            })
          : {
              debit,
              credit,
              nativeDebit: debit,
              nativeCredit: credit,
              nativeCurrencyCode: null,
              lineExchangeRate: null,
              amountsConverted: false,
            };

        const delta = resolved.debit - resolved.credit;
        openingByAccount.set(
          accountId,
          (openingByAccount.get(accountId) ?? 0) + delta,
        );
      }
    }

    let query = supabase
      .from("journal_entry_lines")
      .select(
        "id, account_id, debit, credit, debit_base, credit_base, currency_id, exchange_rate, line_description, cost_center_id, cost_centers(code, name_ar), journal_entries!inner(id, entry_no, entry_date, description, status, source_type, source_id)",
      )
      .in("account_id", scopedAccountIds)
      .eq("journal_entries.status", "posted")
      .limit(5000);

    if (costCenterId) {
      query = query.eq("cost_center_id", costCenterId);
    }
    if (fromDate) {
      query = query.gte("journal_entries.entry_date", fromDate);
    }
    if (toDate) {
      query = query.lte("journal_entries.entry_date", toDate);
    }

    const { data, error } = await query;
    throwIfSupabaseError(error);

    type RawRow = {
      id: string;
      account_id: string;
      debit?: number;
      credit?: number;
      debit_base?: number;
      credit_base?: number;
      currency_id?: string | null;
      exchange_rate?: number | null;
      line_description: string | null;
      cost_center_id?: string | null;
      cost_centers?: { code?: string; name_ar?: string } | null;
      journal_entries?: {
        id?: string;
        entry_no?: string;
        entry_date?: string;
        description?: string | null;
        status?: string;
        source_type?: string | null;
        source_id?: string | null;
      };
    };

    const rawLines = (data ?? []) as RawRow[];
    rawLines.sort((a, b) => {
      const dateA = a.journal_entries?.entry_date ?? "";
      const dateB = b.journal_entries?.entry_date ?? "";
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const noA = a.journal_entries?.entry_no ?? "";
      const noB = b.journal_entries?.entry_no ?? "";
      if (noA !== noB) return noA.localeCompare(noB);
      const codeA = accountById.get(a.account_id)?.code ?? "";
      const codeB = accountById.get(b.account_id)?.code ?? "";
      return codeA.localeCompare(codeB);
    });

    const voucherIds = [
      ...new Set(
        rawLines
          .filter((row) => row.journal_entries?.source_type === "voucher")
          .map((row) => row.journal_entries?.source_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const voucherMetaById = new Map<
      string,
      { voucher_no: string; description: string | null }
    >();
    if (voucherIds.length > 0) {
      const { data: vouchers, error: voucherError } = await supabase
        .from("vouchers")
        .select("id, voucher_no, description")
        .in("id", voucherIds);
      throwIfSupabaseError(voucherError);

      for (const voucher of vouchers ?? []) {
        voucherMetaById.set((voucher as { id: string }).id, {
          voucher_no: (voucher as { voucher_no: string }).voucher_no,
          description: (voucher as { description: string | null }).description,
        });
      }
    }

    const runningByAccount = new Map<string, number>(
      scopedAccountIds.map((id) => [id, openingByAccount.get(id) ?? 0]),
    );
    const totalsByAccount = new Map<
      string,
      { debit: number; credit: number }
    >(scopedAccountIds.map((id) => [id, { debit: 0, credit: 0 }]));

    const lines: AccountStatementLine[] = [];

    for (const row of rawLines) {
      const journal = row.journal_entries;
      const account = accountById.get(row.account_id);
      if (!journal?.id || !account) continue;

      const entryDate = journal.entry_date ?? "";
      const rawDebit = Number(row.debit ?? 0);
      const rawCredit = Number(row.credit ?? 0);
      const rawDebitBase = Number(row.debit_base ?? 0);
      const rawCreditBase = Number(row.credit_base ?? 0);
      const lineCurrencyId = row.currency_id ?? null;
      const lineExchangeRate = row.exchange_rate ?? null;

      const resolved = displayCurrency
        ? resolveStatementLineAmounts({
            debit: rawDebit,
            credit: rawCredit,
            debitBase: rawDebitBase,
            creditBase: rawCreditBase,
            lineCurrencyId,
            lineExchangeRate,
            accountCurrencyId: account.currency_id,
            displayCurrency,
            currencies,
          })
        : {
            debit: rawDebit,
            credit: rawCredit,
            nativeDebit: rawDebit,
            nativeCredit: rawCredit,
            nativeCurrencyCode: null,
            lineExchangeRate: null,
            amountsConverted: false,
          };

      const debit = resolved.debit;
      const credit = resolved.credit;

      const accountTotals = totalsByAccount.get(row.account_id) ?? {
        debit: 0,
        credit: 0,
      };
      accountTotals.debit += debit;
      accountTotals.credit += credit;
      totalsByAccount.set(row.account_id, accountTotals);

      const running = (runningByAccount.get(row.account_id) ?? 0) + debit - credit;
      runningByAccount.set(row.account_id, running);

      const sourceType = journal.source_type ?? null;
      const sourceId = journal.source_id ?? null;
      const costCenter = row.cost_centers;
      const voucherMeta =
        sourceType === "voucher" && sourceId
          ? voucherMetaById.get(sourceId)
          : undefined;

      lines.push({
        id: row.id,
        account_id: account.id,
        account_code: account.code,
        account_name: account.name_ar,
        account_sub_code: account.sub_code,
        account_currency_id: account.currency_id,
        account_currency_code: account.currency_id
          ? (currencyCodeById.get(account.currency_id) ?? null)
          : null,
        line_currency_id: lineCurrencyId,
        line_currency_code: lineCurrencyId
          ? (currencyCodeById.get(lineCurrencyId) ?? null)
          : null,
        line_exchange_rate: resolved.lineExchangeRate,
        native_debit: resolved.nativeDebit,
        native_credit: resolved.nativeCredit,
        amounts_converted: resolved.amountsConverted,
        journal_entry_id: journal.id,
        entry_no: journal.entry_no ?? "—",
        entry_date: entryDate,
        journal_description: journal.description ?? null,
        line_description: row.line_description,
        voucher_description: voucherMeta?.description ?? null,
        debit,
        credit,
        running_balance: running,
        source_type: sourceType,
        source_id: sourceId,
        voucher_no: voucherMeta?.voucher_no ?? null,
        cost_center_id: row.cost_center_id ?? null,
        cost_center_code: costCenter?.code ?? null,
        cost_center_name: costCenter?.name_ar ?? null,
      });
    }

    const account_summaries: AccountStatementAccountSummary[] =
      scopedAccountIds.map((accountId) => {
        const account = accountById.get(accountId);
        const opening = openingByAccount.get(accountId) ?? 0;
        const totals = totalsByAccount.get(accountId) ?? { debit: 0, credit: 0 };
        return {
          account_id: accountId,
          account_code: account?.code ?? "—",
          account_name: account?.name_ar ?? "—",
          opening_balance: opening,
          total_debit: totals.debit,
          total_credit: totals.credit,
          closing_balance: opening + totals.debit - totals.credit,
        };
      });

    const total_debit = account_summaries.reduce(
      (sum, item) => sum + item.total_debit,
      0,
    );
    const total_credit = account_summaries.reduce(
      (sum, item) => sum + item.total_credit,
      0,
    );
    const opening_balance = account_summaries.reduce(
      (sum, item) => sum + item.opening_balance,
      0,
    );

    return {
      opening_balance,
      lines,
      total_debit,
      total_credit,
      closing_balance: opening_balance + total_debit - total_credit,
      account_summaries,
    };
  },

  async listOpenMovements(
    filters: import("@/modules/vouchers/types").OpenMovementFilters = {},
  ): Promise<OpenMovement[]> {
    const { openMovementsApi } = await import(
      "@/modules/vouchers/services/open-movements-api"
    );
    return openMovementsApi.list(filters);
  },

  async listCustomers(): Promise<Customer[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("customer_code", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []) as Customer[];
  },

  async createCustomer(payload: Partial<Customer>): Promise<Customer> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("customers")
      .insert(payload)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as Customer;
  },

  async updateCustomer(
    id: string,
    payload: Partial<Customer>,
  ): Promise<Customer> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as Customer;
  },

  async listVendors(): Promise<Vendor[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .order("vendor_code", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []) as Vendor[];
  },

  async createVendor(payload: Partial<Vendor>): Promise<Vendor> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("vendors")
      .insert(payload)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as Vendor;
  },

  async updateVendor(id: string, payload: Partial<Vendor>): Promise<Vendor> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("vendors")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as Vendor;
  },

  async listJournalEntries(
    fromDate?: string,
    toDate?: string,
  ): Promise<JournalEntryListItem[]> {
    const supabase = getSupabaseClient();
    let query = supabase
      .from("journal_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .limit(200);

    if (fromDate) {
      query = query.gte("entry_date", fromDate);
    }
    if (toDate) {
      query = query.lte("entry_date", toDate);
    }

    const { data, error } = await query;
    throwIfSupabaseError(error);
    return (data ?? []) as JournalEntryListItem[];
  },

  async getJournalEntryById(id: string): Promise<JournalEntryDetails> {
    const supabase = getSupabaseClient();

    const { data: header, error: headerError } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("id", id)
      .single();
    throwIfSupabaseError(headerError);

    const { data: lines, error: linesError } = await supabase
      .from("journal_entry_lines")
      .select(
        "id, account_id, debit, credit, line_description, cost_center_id, accounts(code, name_ar), cost_centers(code, name_ar)",
      )
      .eq("journal_entry_id", id)
      .order("created_at", { ascending: true });
    throwIfSupabaseError(linesError);

    const mappedLines: JournalEntryLineDetail[] = (lines ?? []).map((line) => {
      const account = (line as { accounts?: { code?: string; name_ar?: string } })
        .accounts;
      const costCenter = (line as {
        cost_centers?: { code?: string; name_ar?: string } | null;
      }).cost_centers;

      return {
        id: (line as { id: string }).id,
        account_id: (line as { account_id: string }).account_id,
        account_code: account?.code ?? "",
        account_name: account?.name_ar ?? "",
        debit: Number((line as { debit?: number }).debit ?? 0),
        credit: Number((line as { credit?: number }).credit ?? 0),
        line_description: (line as { line_description: string | null })
          .line_description,
        cost_center_id: (line as { cost_center_id?: string | null }).cost_center_id ?? null,
        cost_center_code: costCenter?.code ?? null,
        cost_center_name: costCenter?.name_ar ?? null,
      };
    });

    return {
      header: header as JournalEntryListItem,
      lines: mappedLines,
    };
  },

  async listTrialBalanceRows(params: TrialBalanceParams = {}): Promise<TrialBalanceRow[]> {
    const supabase = getSupabaseClient();
    const {
      fromDate,
      toDate,
      currencyId,
      accountId,
      accountSubtree = true,
      costCenterId,
    } = params;

    const { data, error } = await supabase.rpc("get_trial_balance", {
      p_from_date: fromDate || null,
      p_to_date: toDate || null,
      p_currency_id: currencyId || null,
      p_account_id: accountId || null,
      p_account_subtree: accountSubtree,
      p_cost_center_id: costCenterId || null,
    });
    throwIfSupabaseError(error);

    return (data ?? []).map((row: Record<string, unknown>) =>
      mapRpcTrialBalanceRow(row as Parameters<typeof mapRpcTrialBalanceRow>[0]),
    );
  },

  async getVoucherById(id: string): Promise<VoucherDetails> {
    const supabase = getSupabaseClient();

    const { data: header, error: headerError } = await supabase
      .from("vouchers")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwIfSupabaseError(headerError);
    if (!header) {
      throw new ApiError({
        code: "VOUCHER_NOT_FOUND",
        message: "السند غير موجود.",
      });
    }

    const { data: lines, error: linesError } = await supabase
      .from("voucher_lines")
      .select("*")
      .eq("voucher_id", id)
      .order("created_at", { ascending: true });
    throwIfSupabaseError(linesError);

    const { data: allocations, error: allocationsError } = await supabase
      .from("voucher_allocations")
      .select("*")
      .eq("voucher_id", id)
      .order("created_at", { ascending: true });
    throwIfSupabaseError(allocationsError);

    const { data: nettingLines, error: nettingError } = await supabase
      .from("voucher_netting_lines")
      .select("*")
      .eq("voucher_id", id)
      .order("created_at", { ascending: true });

    const missingNettingTable =
      nettingError?.code === "42P01" ||
      nettingError?.code === "PGRST205" ||
      nettingError?.code === "42703";

    if (nettingError && !missingNettingTable) {
      throwIfSupabaseError(nettingError);
    }

    return {
      header: header as VoucherHeader,
      lines: (lines ?? []) as VoucherLine[],
      allocations: (allocations ?? []) as VoucherAllocation[],
      netting_lines: missingNettingTable
        ? []
        : ((nettingLines ?? []) as import("@/modules/vouchers/types").VoucherNettingLine[]),
    };
  },

  async getVoucherSettings(): Promise<VoucherSettings> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("voucher_settings")
      .select("auto_number_enabled, allow_manual_override")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      return DEFAULT_VOUCHER_SETTINGS;
    }

    return (data as VoucherSettings | null) ?? DEFAULT_VOUCHER_SETTINGS;
  },

  async updateVoucherSettings(payload: VoucherSettings): Promise<VoucherSettings> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("voucher_settings")
      .upsert({
        id: 1,
        auto_number_enabled: payload.auto_number_enabled,
        allow_manual_override: payload.allow_manual_override,
        updated_at: new Date().toISOString(),
      })
      .select("auto_number_enabled, allow_manual_override")
      .single();
    throwIfSupabaseError(error);
    return data as VoucherSettings;
  },

  async listVoucherNumberSequences(): Promise<VoucherNumberSequence[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("voucher_number_sequences")
      .select("*")
      .order("voucher_type", { ascending: true });

    if (error || !data?.length) {
      return DEFAULT_VOUCHER_SEQUENCES;
    }

    return data as VoucherNumberSequence[];
  },

  async updateVoucherNumberSequence(
    voucherType: VoucherType,
    payload: Pick<VoucherNumberSequence, "prefix" | "padding" | "include_year">,
  ): Promise<VoucherNumberSequence> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("voucher_number_sequences")
      .update({
        prefix: payload.prefix.trim().toUpperCase(),
        padding: payload.padding,
        include_year: payload.include_year,
        updated_at: new Date().toISOString(),
      })
      .eq("voucher_type", voucherType)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as VoucherNumberSequence;
  },

  async peekVoucherNo(voucherType: VoucherType): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("peek_voucher_no", {
      p_voucher_type: voucherType,
    });

    if (!error && typeof data === "string") {
      return data;
    }

    const sequences = await this.listVoucherNumberSequences();
    const row =
      sequences.find((item) => item.voucher_type === voucherType) ??
      DEFAULT_VOUCHER_SEQUENCES.find((item) => item.voucher_type === voucherType)!;
    const year = new Date().getFullYear();
    const next = computeNextSequencePreview(
      row.last_number,
      row.sequence_year,
      row.include_year,
      year,
    );
    return formatVoucherNo(row.prefix, row.include_year, year, next, row.padding);
  },

  async reserveVoucherNo(voucherType: VoucherType): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("reserve_voucher_no", {
      p_voucher_type: voucherType,
    });

    if (!error && typeof data === "string") {
      return data;
    }

    const sequences = await this.listVoucherNumberSequences();
    const row =
      sequences.find((item) => item.voucher_type === voucherType) ??
      DEFAULT_VOUCHER_SEQUENCES.find((item) => item.voucher_type === voucherType)!;
    const year = new Date().getFullYear();
    let lastNumber = row.last_number;
    let sequenceYear = row.sequence_year;

    if (row.include_year && sequenceYear !== year) {
      lastNumber = 0;
      sequenceYear = year;
    }

    const next = lastNumber + 1;
    const voucherNo = formatVoucherNo(
      row.prefix,
      row.include_year,
      year,
      next,
      row.padding,
    );

    const { error: updateError } = await supabase
      .from("voucher_number_sequences")
      .update({
        last_number: next,
        sequence_year: year,
        updated_at: new Date().toISOString(),
      })
      .eq("voucher_type", voucherType);

    if (updateError) {
      throw new ApiError({
        code: "VOUCHER_NUMBER_RESERVE_FAILED",
        message:
          "تعذّر حجز رقم السند. شغّل ملف database/setup_all.sql في Supabase.",
      });
    }

    return voucherNo;
  },

  async listCostCenters(): Promise<CostCenter[]> {
    return costCenterApi.listCostCenters();
  },

  async listVoucherTypeDefaults(): Promise<VoucherTypeDefaults[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("voucher_type_defaults")
      .select("*")
      .order("voucher_type", { ascending: true });

    if (error || !data?.length) {
      return DEFAULT_VOUCHER_TYPE_DEFAULTS;
    }

    return (data as VoucherTypeDefaults[]).map((row) => ({
      ...row,
      auto_post_enabled: row.auto_post_enabled ?? false,
    }));
  },

  async getVoucherTypeDefaults(
    voucherType: VoucherType,
  ): Promise<VoucherTypeDefaults> {
    const rows = await this.listVoucherTypeDefaults();
    return (
      rows.find((row) => row.voucher_type === voucherType) ??
      DEFAULT_VOUCHER_TYPE_DEFAULTS.find(
        (row) => row.voucher_type === voucherType,
      )!
    );
  },

  async updateVoucherTypeDefaults(
    voucherType: VoucherType,
    payload: Omit<VoucherTypeDefaults, "voucher_type">,
  ): Promise<VoucherTypeDefaults> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("voucher_type_defaults")
      .upsert({
        voucher_type: voucherType,
        default_account_id: payload.default_account_id,
        default_currency_id: payload.default_currency_id,
        default_cost_center_id: payload.default_cost_center_id,
        auto_post_enabled: payload.auto_post_enabled ?? false,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as VoucherTypeDefaults;
  },

  async createVoucher(payload: Partial<VoucherHeader>): Promise<VoucherHeader> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("vouchers")
      .insert(sanitizeVoucherHeaderPayload(payload))
      .select("*")
      .maybeSingle();
    throwIfSupabaseError(error);
    if (!data) {
      throw new ApiError({
        code: "VOUCHER_CREATE_FAILED",
        message: "تعذّر إنشاء السند.",
      });
    }
    return data as VoucherHeader;
  },

  async updateVoucher(
    id: string,
    payload: Partial<VoucherHeader>,
  ): Promise<VoucherHeader> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("vouchers")
      .update(sanitizeVoucherHeaderPayload(payload))
      .eq("id", id)
      .select("*")
      .maybeSingle();
    throwIfSupabaseError(error);
    if (!data) {
      throw new ApiError({
        code: "VOUCHER_NOT_FOUND",
        message: "السند غير موجود أو لا يمكن تحديثه.",
      });
    }
    return data as VoucherHeader;
  },

  async addVoucherLine(
    id: string,
    payload: Partial<VoucherLine>,
  ): Promise<VoucherLine> {
    const supabase = getSupabaseClient();
    const insertPayload = { ...payload, voucher_id: id };
    const { data, error } = await supabase
      .from("voucher_lines")
      .insert(insertPayload)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as VoucherLine;
  },

  async updateVoucherLine(
    id: string,
    lineId: string,
    payload: Partial<VoucherLine>,
  ): Promise<VoucherLine> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("voucher_lines")
      .update(payload)
      .eq("id", lineId)
      .eq("voucher_id", id)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as VoucherLine;
  },

  async deleteVoucherLine(id: string, lineId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("voucher_lines")
      .delete()
      .eq("id", lineId)
      .eq("voucher_id", id);
    throwIfSupabaseError(error);
  },

  async deleteAllVoucherLines(voucherId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("voucher_lines")
      .delete()
      .eq("voucher_id", voucherId);
    throwIfSupabaseError(error);
  },

  async replaceVoucherLines(
    voucherId: string,
    lines: Partial<VoucherLine>[],
  ): Promise<VoucherLine[]> {
    const supabase = getSupabaseClient();
    const payload = lines
      .filter((line) => line.account_id && Number(line.amount || 0) > 0)
      .map((line) => ({
        account_id: line.account_id,
        side: line.side,
        amount: Number(line.amount),
        line_description: line.line_description ?? null,
        cost_center_id: line.cost_center_id ?? null,
        line_category_id: line.line_category_id ?? null,
        category_quantity: line.category_quantity ?? null,
        cc_optional: line.cc_optional ?? false,
      }));

    const { error } = await supabase.rpc("replace_voucher_lines", {
      p_voucher_id: voucherId,
      p_lines: payload,
    });
    throwIfSupabaseError(error);

    const { data, error: fetchError } = await supabase
      .from("voucher_lines")
      .select("*")
      .eq("voucher_id", voucherId)
      .order("created_at", { ascending: true });
    throwIfSupabaseError(fetchError);
    return (data ?? []) as VoucherLine[];
  },

  async addAllocation(
    id: string,
    payload: Partial<VoucherAllocation>,
  ): Promise<VoucherAllocation> {
    const supabase = getSupabaseClient();
    const insertPayload = { ...payload, voucher_id: id };
    const { data, error } = await supabase
      .from("voucher_allocations")
      .insert(insertPayload)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as VoucherAllocation;
  },

  async updateAllocation(
    id: string,
    allocationId: string,
    payload: Partial<VoucherAllocation>,
  ): Promise<VoucherAllocation> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("voucher_allocations")
      .update(payload)
      .eq("id", allocationId)
      .eq("voucher_id", id)
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as VoucherAllocation;
  },

  async deleteAllocation(id: string, allocationId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("voucher_allocations")
      .delete()
      .eq("id", allocationId)
      .eq("voucher_id", id);
    throwIfSupabaseError(error);
  },

  async deleteAllVoucherAllocations(voucherId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("voucher_allocations")
      .delete()
      .eq("voucher_id", voucherId);
    throwIfSupabaseError(error);
  },

  async replaceVoucherAllocations(
    voucherId: string,
    allocations: Partial<VoucherAllocation>[],
  ): Promise<VoucherAllocation[]> {
    const supabase = getSupabaseClient();
    const payload = allocations
      .map((allocation) => {
        const targetId =
          allocation.target_journal_line_id || allocation.target_reference || "";
        const amount = Number(allocation.applied_amount || 0);
        if (!targetId || amount <= 0) return null;
        return {
          target_journal_line_id: targetId,
          applied_amount: amount,
          note: allocation.note?.trim() || null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const { error } = await supabase.rpc("replace_voucher_allocations", {
      p_voucher_id: voucherId,
      p_allocations: payload,
    });
    throwIfSupabaseError(error);

    const { data, error: fetchError } = await supabase
      .from("voucher_allocations")
      .select("*")
      .eq("voucher_id", voucherId)
      .order("created_at", { ascending: true });
    throwIfSupabaseError(fetchError);
    return (data ?? []) as VoucherAllocation[];
  },

  async deleteAllVoucherNettingLines(voucherId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("voucher_netting_lines")
      .delete()
      .eq("voucher_id", voucherId);

    const missingTable =
      error?.code === "42P01" ||
      error?.code === "PGRST205" ||
      error?.code === "42703";
    if (error && !missingTable) throwIfSupabaseError(error);
  },

  async replaceVoucherNettingLines(
    voucherId: string,
    lines: Partial<import("@/modules/vouchers/types").VoucherNettingLine>[],
  ): Promise<import("@/modules/vouchers/types").VoucherNettingLine[]> {
    await this.deleteAllVoucherNettingLines(voucherId);

    const validLines = lines.filter((line) => Number(line.amount || 0) > 0);
    if (validLines.length === 0) return [];

    const supabase = getSupabaseClient();
    const payload = validLines.map((line) => ({
      voucher_id: voucherId,
      netting_kind: line.netting_kind,
      from_cc_id: line.from_cc_id ?? null,
      to_cc_id: line.to_cc_id ?? null,
      from_branch_id: line.from_branch_id ?? null,
      to_branch_id: line.to_branch_id ?? null,
      amount: Number(line.amount),
      currency_id: line.currency_id ?? null,
      includes_cash: line.includes_cash ?? false,
      inter_account_id: line.inter_account_id ?? null,
      note: line.note?.trim() || null,
    }));

    const { data, error } = await supabase
      .from("voucher_netting_lines")
      .insert(payload)
      .select("*");

    const missingTable =
      error?.code === "42P01" ||
      error?.code === "PGRST205" ||
      error?.code === "42703";
    if (missingTable) return [];
    throwIfSupabaseError(error);

    return (data ?? []) as import("@/modules/vouchers/types").VoucherNettingLine[];
  },

  async approveVoucher(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("vouchers")
      .update({ status: "approved" })
      .eq("id", id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    throwIfSupabaseError(error);

    if (!data?.id) {
      throw new ApiError({
        code: "APPROVE_NOT_ALLOWED",
        message: "لا يمكن اعتماد هذا السند. تأكد أنه مسودة.",
      });
    }
  },

  async postVoucher(id: string): Promise<PostVoucherResponse> {
    const supabase = getSupabaseClient();

    const { data: voucher, error } = await supabase
      .from("vouchers")
      .update({ status: "posted" })
      .eq("id", id)
      .select("id, status, journal_entry_id, voucher_no")
      .single();
    throwIfSupabaseError(error);

    if (!voucher?.journal_entry_id) {
      throw new ApiError({
        code: "POSTING_FAILED",
        message: "تم تحديث الحالة لكن لم يتم ربط قيد اليومية.",
      });
    }

    const { data: journal, error: journalError } = await supabase
      .from("journal_entries")
      .select("entry_no")
      .eq("id", voucher.journal_entry_id)
      .single();
    throwIfSupabaseError(journalError);
    if (!journal?.entry_no) {
      throw new ApiError({
        code: "POSTING_FAILED",
        message: "تم الترحيل لكن لم يتم العثور على رقم قيد اليومية.",
      });
    }

    return {
      voucher_id: voucher.id,
      status: "posted",
      journal_entry_id: voucher.journal_entry_id,
      journal_entry_no: journal.entry_no,
    };
  },

  async syncPostedVoucherJournal(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc("sync_posted_voucher_journal", {
      p_voucher_id: id,
    });
    throwIfSupabaseError(error);
  },

  async reverseVoucher(id: string): Promise<{ reversed_voucher_id: string }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("reverse_posted_voucher", {
      p_voucher_id: id,
    });
    throwIfSupabaseError(error);

    if (!data) {
      throw new ApiError({
        code: "REVERSAL_FAILED",
        message: "فشل عكس السند.",
      });
    }

    return { reversed_voucher_id: data as string };
  },

  async deleteVoucher(voucherId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { data: attachments, error: attachmentsError } = await supabase
      .from("voucher_attachments")
      .select("storage_path")
      .eq("voucher_id", voucherId);
    throwIfSupabaseError(attachmentsError);

    for (const attachment of attachments ?? []) {
      if (!attachment.storage_path) continue;
      try {
        await deleteVoucherAttachmentFile(attachment.storage_path);
      } catch {
        // تجاهل أخطاء تنظيف التخزين — الحذف من قاعدة البيانات يكمل
      }
    }

    const { error } = await supabase.rpc("delete_voucher_with_journal", {
      p_voucher_id: voucherId,
    });
    throwIfSupabaseError(error);
  },
};

export { ApiError };
