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
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[108px]" />
          <col />
          <col className="w-[72px]" />
          <col className="w-[130px]" />
          <col className="w-[130px]" />
          <col className="w-[130px]" />
          <col className="w-[200px]" />
          <col className="w-[220px]" />
        </colgroup>
        <thead className="bg-slate-50">
          <tr className="text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
            <th className="border-b border-slate-200 px-3 py-3">الكود</th>
            <th className="border-b border-slate-200 px-3 py-3">الحساب</th>
            <th className="border-b border-slate-200 px-3 py-3">العملة</th>
            <th className="border-b border-slate-200 bg-blue-50/50 px-3 py-3">
              مدين
            </th>
            <th className="border-b border-slate-200 bg-blue-50/50 px-3 py-3">
              دائن
            </th>
            <th className="border-b border-slate-200 bg-blue-50/50 px-3 py-3">
              الرصيد
            </th>
            <th className="border-b border-slate-200 px-3 py-3">الخصائص</th>
            <th className="border-b border-slate-200 px-3 py-3">إجراءات</th>
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
                <td className="border-b border-slate-100 px-3 py-3 font-mono text-xs text-slate-800">
                  {node.code}
                </td>
                <td className="border-b border-slate-100 px-3 py-3">
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
                <td className="border-b border-slate-100 px-3 py-3 text-center font-mono text-xs font-medium text-slate-700">
                  {balance?.currency_code ?? "—"}
                </td>
                <td className="border-b border-slate-100 bg-blue-50/20 px-3 py-3 text-left font-mono text-xs tabular-nums text-slate-800">
                  {balance ? fmt(balance.display_debit) : "—"}
                </td>
                <td className="border-b border-slate-100 bg-blue-50/20 px-3 py-3 text-left font-mono text-xs tabular-nums text-slate-800">
                  {balance ? fmt(balance.display_credit) : "—"}
                </td>
                <td className="border-b border-slate-100 bg-blue-50/20 px-3 py-3 text-left font-mono text-xs font-semibold tabular-nums text-blue-900">
                  {balance ? fmt(balance.display_balance) : "—"}
                </td>
                <td className="border-b border-slate-100 px-3 py-3">
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
                <td className="border-b border-slate-100 px-3 py-3">
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
