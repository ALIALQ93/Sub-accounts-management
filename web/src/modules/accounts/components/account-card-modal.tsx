"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { AccountStatementSection } from "@/modules/accounts/components/account-statement-section";
import type { AccountTreeNode } from "@/modules/accounts/types";
import {
  buildChildBalanceBreakdown,
  buildDirectBalanceMap,
} from "@/modules/accounts/utils/compute-account-balances";
import {
  getStatementLabel,
  getStatementType,
} from "@/modules/accounts/utils/account-tree";
import type {
  AccountDirectBalance,
  AccountDisplayBalance,
  Currency,
} from "@/modules/currencies/types";
import { formatCurrencyAmount } from "@/modules/currencies/utils/convert-amount";
import type { Account } from "@/modules/vouchers/types";

type AccountCardTab = "summary" | "statement";

interface AccountCardModalProps {
  open: boolean;
  account: AccountTreeNode | null;
  balance: AccountDisplayBalance | null;
  directBalances: AccountDirectBalance[];
  currencies: Currency[];
  accountsById: Map<string, Account>;
  onClose: () => void;
}

export function AccountCardModal({
  open,
  account,
  balance,
  directBalances,
  currencies,
  accountsById,
  onClose,
}: AccountCardModalProps) {
  const [activeTab, setActiveTab] = useState<AccountCardTab>("summary");

  if (!account || !balance) return null;

  const directMap = buildDirectBalanceMap(directBalances);
  const childRows =
    account.childCount > 0
      ? buildChildBalanceBreakdown(account, directMap, currencies)
      : [];
  const statementType = getStatementType(account, accountsById);
  const canShowStatement = account.is_postable;

  const fmt = (
    value: number,
    decimalPlaces = balance.decimal_places,
    symbol = balance.currency_symbol,
  ) => formatCurrencyAmount(value, decimalPlaces, symbol);

  const handleClose = () => {
    setActiveTab("summary");
    onClose();
  };

  return (
    <Modal
      open={open}
      size="xl"
      title="بطاقة الحساب"
      description={`${account.code} — ${account.name_ar}${account.name_en ? ` (${account.name_en})` : ""}`}
      onClose={handleClose}
    >
      <div className="mb-4 flex gap-2 border-b border-slate-200 pb-1">
        <TabButton
          active={activeTab === "summary"}
          onClick={() => setActiveTab("summary")}
        >
          ملخص
        </TabButton>
        {canShowStatement && (
          <TabButton
            active={activeTab === "statement"}
            onClick={() => setActiveTab("statement")}
          >
            كشف الحركات
          </TabButton>
        )}
      </div>

      {activeTab === "summary" && (
        <div className="grid gap-6">
          <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <article className="rounded-xl border border-slate-200 bg-gradient-to-l from-slate-50 to-white p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                معلومات الحساب
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <InfoItem label="كود الحساب" value={account.code} mono />
                <InfoItem
                  label="عملة العرض"
                  value={`${balance.currency_code} (${balance.currency_symbol})`}
                />
                <InfoItem
                  label="نوع الحساب"
                  value={account.is_postable ? "مرحّل عليه" : "حساب أب"}
                />
                <InfoItem
                  label="الحالة"
                  value={account.is_active ? "نشط" : "غير نشط"}
                />
                {statementType && (
                  <InfoItem
                    label="التصنيف"
                    value={getStatementLabel(statementType)}
                  />
                )}
                {account.childCount > 0 && (
                  <InfoItem
                    label="عدد الفروع"
                    value={String(account.childCount)}
                  />
                )}
              </div>
            </article>

            <section className="grid gap-3">
              <BalanceCard label="إجمالي المدين" value={fmt(balance.display_debit)} />
              <BalanceCard label="إجمالي الدائن" value={fmt(balance.display_credit)} />
              <BalanceCard
                label="الرصيد"
                value={fmt(balance.display_balance)}
                highlight
              />
            </section>
          </section>

          {balance.is_aggregated && (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900">
                  تفصيل الفروع — محوّل إلى {balance.currency_code}
                </h3>
                <p className="text-xs text-slate-500">
                  {childRows.length} حساب فرعي
                </p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-full border-collapse text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-right text-xs font-semibold text-slate-600">
                      <th className="border-b border-slate-200 px-4 py-3">الحساب</th>
                      <th className="border-b border-slate-200 px-4 py-3">عملة الفرع</th>
                      <th className="border-b border-slate-200 bg-blue-50/40 px-4 py-3">
                        مدين (أصلي)
                      </th>
                      <th className="border-b border-slate-200 bg-blue-50/40 px-4 py-3">
                        دائن (أصلي)
                      </th>
                      <th className="border-b border-slate-200 bg-blue-50/40 px-4 py-3">
                        رصيد (أصلي)
                      </th>
                      <th className="border-b border-slate-200 bg-emerald-50/40 px-4 py-3">
                        رصيد محوّل ({balance.currency_code})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {childRows.map((row) => (
                      <tr
                        key={row.account_id}
                        className="odd:bg-white even:bg-slate-50/50"
                      >
                        <td className="border-b border-slate-100 px-4 py-3">
                          <p className="font-mono text-xs text-slate-600">{row.code}</p>
                          <p className="font-medium text-slate-900">{row.name_ar}</p>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 font-mono text-sm">
                          {row.currency_code}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-left font-mono text-xs tabular-nums">
                          {formatCurrencyAmount(
                            row.debit,
                            row.decimal_places,
                            row.currency_symbol,
                          )}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-left font-mono text-xs tabular-nums">
                          {formatCurrencyAmount(
                            row.credit,
                            row.decimal_places,
                            row.currency_symbol,
                          )}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-left font-mono text-xs tabular-nums">
                          {formatCurrencyAmount(
                            row.balance,
                            row.decimal_places,
                            row.currency_symbol,
                          )}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-left font-mono text-sm font-semibold tabular-nums text-blue-900">
                          {fmt(row.converted_balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {childRows.length > 0 && (
                    <tfoot className="bg-slate-100/80">
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-3 text-sm font-semibold text-slate-700"
                        >
                          المجموع بعملة {balance.currency_code}
                        </td>
                        <td className="px-4 py-3 text-left font-mono text-base font-bold tabular-nums text-blue-900">
                          {fmt(
                            childRows.reduce(
                              (sum, row) => sum + row.converted_balance,
                              0,
                            ),
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                يتم التحويل باستخدام سعر الصرف الحالي من قسم العملات.
              </p>
            </section>
          )}

          {!balance.is_aggregated && account.is_postable && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              الأرقام أعلاه من الحركات المرحّلة مباشرة على هذا الحساب بعملة{" "}
              {balance.currency_code}. انتقل إلى تبويب «كشف الحركات» لعرض
              التفاصيل.
            </p>
          )}

          {!account.is_postable && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              حساب أب — الحركات تُسجّل على الحسابات الفرعية المرحّلة. افتح
              حساباً فرعياً لعرض كشف الحركات.
            </p>
          )}
        </div>
      )}

      {activeTab === "statement" && canShowStatement && (
        <AccountStatementSection
          accountIds={[account.id]}
          displayCurrency={
            currencies.find((currency) => currency.code === balance.currency_code) ??
            currencies.find((currency) => currency.id === account.currency_id) ??
            currencies[0]
          }
        />
      )}
    </Modal>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-t-md px-4 py-2 text-sm font-medium transition ${
        active
          ? "border border-b-white border-slate-300 bg-white text-blue-900"
          : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function InfoItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-0.5 text-sm font-semibold text-slate-900 ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function BalanceCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <article
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-blue-200 bg-blue-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-1 font-mono text-xl font-bold tabular-nums ${
          highlight ? "text-blue-900" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </article>
  );
}
