"use client";

import type { Account } from "@/modules/vouchers/types";
import type { AccountTreeNode, FlatAccountRow } from "@/modules/accounts/types";
import {
  getStatementLabel,
  getStatementType,
  isRootAccount,
} from "@/modules/accounts/utils/account-tree";
import type { AccountDisplayBalance } from "@/modules/currencies/types";
import { formatCurrencyAmount } from "@/modules/currencies/utils/convert-amount";

interface AccountTreeTableProps {
  rows: FlatAccountRow[];
  accountsById: Map<string, Account>;
  displayBalances: Map<string, AccountDisplayBalance>;
  expandedIds: Set<string>;
  isSaving: boolean;
  onToggleExpand: (id: string) => void;
  onEdit: (node: AccountTreeNode) => void;
  onViewCard: (node: AccountTreeNode) => void;
  onToggleActive: (node: AccountTreeNode) => void;
  onAddChild: (node: AccountTreeNode) => void;
}

export function AccountTreeTable({
  rows,
  accountsById,
  displayBalances,
  expandedIds,
  isSaving,
  onToggleExpand,
  onEdit,
  onViewCard,
  onToggleActive,
  onAddChild,
}: AccountTreeTableProps) {
  if (rows.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-slate-500">
        لا توجد حسابات مطابقة للبحث.
      </p>
    );
  }

  return (
    <div className="h-full min-h-[calc(100svh-240px)] overflow-auto rounded-xl border-2 border-slate-300 bg-white shadow-sm">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[130px]" />
          <col />
          <col className="w-[90px]" />
          <col className="w-[min(12vw,180px)]" />
          <col className="w-[min(12vw,180px)]" />
          <col className="w-[min(12vw,180px)]" />
          <col className="w-[min(16vw,240px)]" />
          <col className="w-[min(18vw,280px)]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-slate-100 shadow-[0_1px_0_0_rgb(203_213_225)]">
          <tr className="text-right text-xs font-semibold uppercase tracking-wide text-slate-700">
            <th className={TH}>الكود</th>
            <th className={TH}>الحساب</th>
            <th className={TH}>العملة</th>
            <th className={`${TH} bg-blue-100/70`}>مدين</th>
            <th className={`${TH} bg-blue-100/70`}>دائن</th>
            <th className={`${TH} bg-blue-100/70`}>الرصيد</th>
            <th className={TH}>الخصائص</th>
            <th className={TH}>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ node, depth }) => {
            const hasChildren = node.childCount > 0;
            const isExpanded = expandedIds.has(node.id);
            const statementType = getStatementType(node, accountsById);
            const rootAccount = isRootAccount(node);
            const balance = displayBalances.get(node.id);

            const fmt = (value: number) =>
              balance
                ? formatCurrencyAmount(
                    value,
                    balance.decimal_places,
                    balance.currency_symbol,
                  )
                : "—";

            return (
              <tr
                key={node.id}
                className="group align-top odd:bg-white even:bg-slate-50/40 hover:bg-blue-50/30"
              >
                <td className={`${TD} font-mono text-xs text-slate-800`}>
                  {node.code}
                </td>
                <td className={TD}>
                  <div
                    className="flex min-w-0 items-start gap-2"
                    style={{ paddingRight: `${depth * 18}px` }}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => onToggleExpand(node.id)}
                        className="mt-0.5 shrink-0 rounded px-1 text-slate-500 hover:bg-slate-200/80"
                        aria-label={isExpanded ? "طي" : "توسيع"}
                      >
                        {isExpanded ? "▾" : "▸"}
                      </button>
                    ) : (
                      <span className="inline-block w-5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onViewCard(node)}
                          className="truncate text-right font-semibold text-slate-900 hover:text-blue-900 hover:underline"
                        >
                          {node.name_ar}
                        </button>
                        {hasChildren && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                            {node.childCount} فرع
                          </span>
                        )}
                      </div>
                      {node.name_en && (
                        <p
                          className="mt-0.5 truncate text-xs text-slate-500"
                          dir="ltr"
                        >
                          {node.name_en}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className={`${TD} text-center font-mono text-xs font-medium text-slate-700`}>
                  {balance?.currency_code ?? "—"}
                </td>
                <td className={`${TD} bg-blue-50/30 text-left font-mono text-xs tabular-nums text-slate-800`}>
                  {balance ? fmt(balance.display_debit) : "—"}
                </td>
                <td className={`${TD} bg-blue-50/30 text-left font-mono text-xs tabular-nums text-slate-800`}>
                  {balance ? fmt(balance.display_credit) : "—"}
                </td>
                <td className={`${TD} bg-blue-50/30 text-left font-mono text-xs font-semibold tabular-nums text-blue-900`}>
                  {balance ? fmt(balance.display_balance) : "—"}
                </td>
                <td className={TD}>
                  <div className="flex flex-wrap gap-1.5">
                    {statementType && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          statementType === "balance_sheet"
                            ? "bg-blue-50 text-blue-800"
                            : "bg-emerald-50 text-emerald-800"
                        }`}
                      >
                        {getStatementLabel(statementType)}
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                      {node.is_postable ? "مرحّل" : "أب"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        node.is_active
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {node.is_active ? "نشط" : "معطّل"}
                    </span>
                  </div>
                </td>
                <td className={TD}>
                  <div className="flex flex-wrap gap-1">
                    <ActionButton label="بطاقة" onClick={() => onViewCard(node)} />
                    <ActionButton
                      label="+ فرع"
                      tone="emerald"
                      disabled={isSaving || !node.is_active}
                      onClick={() => onAddChild(node)}
                    />
                    <ActionButton
                      label="تعديل"
                      tone="blue"
                      disabled={isSaving}
                      onClick={() => onEdit(node)}
                    />
                    {!rootAccount && (
                      <ActionButton
                        label={node.is_active ? "تعطيل" : "تفعيل"}
                        tone="amber"
                        disabled={isSaving}
                        onClick={() => onToggleActive(node)}
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TH =
  "border border-slate-300 px-4 py-3.5 first:border-r-2 last:border-l-2";
const TD =
  "border border-slate-300 px-4 py-3.5 align-top first:border-r-2 last:border-l-2";

function ActionButton({
  label,
  tone = "slate",
  disabled,
  onClick,
}: {
  label: string;
  tone?: "slate" | "blue" | "emerald" | "amber";
  disabled?: boolean;
  onClick: () => void;
}) {
  const toneClass = {
    slate: "border-slate-300 text-slate-700 hover:bg-slate-50",
    blue: "border-blue-300 text-blue-700 hover:bg-blue-50",
    emerald: "border-emerald-300 text-emerald-700 hover:bg-emerald-50",
    amber: "border-amber-300 text-amber-700 hover:bg-amber-50",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2 py-1 text-[11px] font-medium disabled:opacity-50 ${toneClass}`}
    >
      {label}
    </button>
  );
}
