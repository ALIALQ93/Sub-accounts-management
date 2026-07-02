"use client";

import { Modal } from "@/components/modal";
import type { AccountTreeNode } from "@/modules/accounts/types";
import {
  buildChildBalanceBreakdown,
  buildDirectBalanceMap,
} from "@/modules/accounts/utils/compute-account-balances";
import type {
  AccountDirectBalance,
  AccountDisplayBalance,
  Currency,
} from "@/modules/currencies/types";
import { formatCurrencyAmount } from "@/modules/currencies/utils/convert-amount";

interface AccountCardModalProps {
  open: boolean;
  account: AccountTreeNode | null;
  balance: AccountDisplayBalance | null;
  directBalances: AccountDirectBalance[];
  currencies: Currency[];
  onClose: () => void;
}

export function AccountCardModal({
  open,
  account,
  balance,
  directBalances,
  currencies,
  onClose,
}: AccountCardModalProps) {
  if (!account || !balance) return null;

  const directMap = buildDirectBalanceMap(directBalances);
  const childRows =
    account.childCount > 0
      ? buildChildBalanceBreakdown(account, directMap, currencies)
      : [];

  const fmt = (value: number) =>
    formatCurrencyAmount(value, balance.decimal_places, balance.currency_symbol);

  return (
    <Modal
      open={open}
      title="بطاقة الحساب"
      description={`${account.code} — ${account.name_ar}`}
      onClose={onClose}
    >
      <div className="grid gap-4">
        <section className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">عملة العرض</p>
            <p className="mt-1 font-semibold text-slate-900">
              {balance.currency_code} ({balance.currency_symbol})
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">نوع الحساب</p>
            <p className="mt-1 font-semibold text-slate-900">
              {account.is_postable ? "مرحّل عليه" : "حساب أب"}
            </p>
          </article>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">مدين</p>
            <p className="mt-1 font-mono text-lg font-semibold text-slate-900">
              {fmt(balance.display_debit)}
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">دائن</p>
            <p className="mt-1 font-mono text-lg font-semibold text-slate-900">
              {fmt(balance.display_credit)}
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">الرصيد</p>
            <p className="mt-1 font-mono text-lg font-semibold text-blue-900">
              {fmt(balance.display_balance)}
            </p>
          </article>
        </section>

        {balance.is_aggregated && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">
              تفصيل الفروع (محوّل إلى {balance.currency_code})
            </h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-right text-slate-700">
                    <th className="border-b border-slate-200 p-2">الحساب</th>
                    <th className="border-b border-slate-200 p-2">عملة الفرع</th>
                    <th className="border-b border-slate-200 p-2">مدين</th>
                    <th className="border-b border-slate-200 p-2">دائن</th>
                    <th className="border-b border-slate-200 p-2">رصيد</th>
                    <th className="border-b border-slate-200 p-2">
                      رصيد محوّل ({balance.currency_code})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {childRows.map((row) => (
                    <tr key={row.account_id} className="odd:bg-white even:bg-slate-50/60">
                      <td className="border-b border-slate-100 p-2">
                        <span className="font-mono">{row.code}</span>
                        <span className="mr-2">{row.name_ar}</span>
                      </td>
                      <td className="border-b border-slate-100 p-2">
                        {row.currency_code}
                      </td>
                      <td className="border-b border-slate-100 p-2 font-mono">
                        {formatCurrencyAmount(
                          row.debit,
                          row.decimal_places,
                          row.currency_symbol,
                        )}
                      </td>
                      <td className="border-b border-slate-100 p-2 font-mono">
                        {formatCurrencyAmount(
                          row.credit,
                          row.decimal_places,
                          row.currency_symbol,
                        )}
                      </td>
                      <td className="border-b border-slate-100 p-2 font-mono">
                        {formatCurrencyAmount(
                          row.balance,
                          row.decimal_places,
                          row.currency_symbol,
                        )}
                      </td>
                      <td className="border-b border-slate-100 p-2 font-mono font-medium text-blue-900">
                        {fmt(row.converted_balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              يتم التحويل باستخدام سعر الصرف الحالي المعرف في قسم العملات.
            </p>
          </section>
        )}

        {!balance.is_aggregated && account.is_postable && (
          <p className="text-sm text-slate-600">
            الأرقام أعلاه من الحركات المرحّلة مباشرة على هذا الحساب.
          </p>
        )}
      </div>
    </Modal>
  );
}
