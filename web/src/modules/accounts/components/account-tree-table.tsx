"use client";

import type { Account } from "@/modules/vouchers/types";
import type { AccountTreeNode, FlatAccountRow } from "@/modules/accounts/types";
import {
  getStatementLabel,
  getStatementType,
  accountHasJournalMovements,
  isRootAccount,
} from "@/modules/accounts/utils/account-tree";
import type { AccountDisplayBalance } from "@/modules/currencies/types";
import { formatCurrencyAmount } from "@/modules/currencies/utils/convert-amount";

interface AccountTreeTableProps {
  rows: FlatAccountRow[];
  accountsById: Map<string, Account>;
  accountsWithMovements?: ReadonlySet<string>;
  displayBalances: Map<string, AccountDisplayBalance>;
  expandedIds: Set<string>;
  isSaving: boolean;
  onToggleExpand: (id: string) => void;
  onEdit: (node: AccountTreeNode) => void;
  onViewCard: (node: AccountTreeNode) => void;
  onToggleActive: (node: AccountTreeNode) => void;
  onAddChild: (node: AccountTreeNode) => void;
  canAddChild?: boolean;
  canEdit?: boolean;
  canToggleActive?: boolean;
}

export function AccountTreeTable({
  rows,
  accountsById,
  accountsWithMovements,
  displayBalances,
  expandedIds,
  isSaving,
  onToggleExpand,
  onEdit,
  onViewCard,
  onToggleActive,
  onAddChild,
  canAddChild = true,
  canEdit = true,
  canToggleActive = true,
}: AccountTreeTableProps) {
  if (rows.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-slate-500">
        لا توجد حسابات مطابقة للبحث.
      </p>
    );
  }

  return (
    <div className="rounded-xl border-2 border-slate-300 bg-white shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100 shadow-[0_1px_0_0_rgb(203_213_225)]">
          <tr className="text-right text-xs font-semibold uppercase tracking-wide text-slate-700">
            <th className={`${TH} w-[110px]`}>الكود</th>
            <th className={`${TH} min-w-[260px]`}>الحساب</th>
            <th className={`${TH} w-[72px]`}>العملة</th>
            <th className={`${TH} w-[120px] bg-blue-100/70`}>مدين</th>
            <th className={`${TH} w-[120px] bg-blue-100/70`}>دائن</th>
            <th className={`${TH} w-[120px] bg-blue-100/70`}>الرصيد</th>
            <th className={`${TH} w-[200px]`}>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ node, depth }) => {
            const hasChildren = node.childCount > 0;
            const isExpanded = expandedIds.has(node.id);
            const statementType = getStatementType(node, accountsById);
            const rootAccount = isRootAccount(node);
            const balance = displayBalances.get(node.id);
            const parentHasMovements = accountHasJournalMovements(
              node.id,
              accountsWithMovements,
            );

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
                  <div>{node.code}</div>
                  {node.sub_code && (
                    <div className="mt-0.5 text-[10px] font-normal text-slate-500">
                      {node.sub_code}
                    </div>
                  )}
                </td>
                <td className={TD}>
                  <div
                    className="flex items-start gap-2"
                    style={{ paddingRight: `${depth * 16}px` }}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => onToggleExpand(node.id)}
                        className="mt-1 shrink-0 rounded px-1 text-slate-500 hover:bg-slate-200/80"
                        aria-label={isExpanded ? "طي" : "توسيع"}
                      >
                        {isExpanded ? "▾" : "▸"}
                      </button>
                    ) : (
                      <span className="inline-block w-5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onViewCard(node)}
                        title={node.name_ar}
                        className="block w-full whitespace-normal break-words text-right text-sm font-semibold leading-relaxed text-slate-900 hover:text-blue-900 hover:underline"
                      >
                        {node.name_ar}
                      </button>
                      {node.name_en && (
                        <p
                          className="mt-0.5 whitespace-normal break-words text-xs leading-relaxed text-slate-500"
                          dir="ltr"
                          title={node.name_en}
                        >
                          {node.name_en}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {hasChildren && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                            {node.childCount} فرع
                          </span>
                        )}
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
                        {parentHasMovements && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
                            عليه حركة
                          </span>
                        )}
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
                    </div>
                  </div>
                </td>
                <td className={`${TD} text-center font-mono text-xs font-medium text-slate-700`}>
                  {balance?.currency_code ?? "—"}
                </td>
                <td className={`${TD} bg-blue-50/30 text-left font-mono text-[11px] tabular-nums text-slate-800`}>
                  {balance ? fmt(balance.display_debit) : "—"}
                </td>
                <td className={`${TD} bg-blue-50/30 text-left font-mono text-[11px] tabular-nums text-slate-800`}>
                  {balance ? fmt(balance.display_credit) : "—"}
                </td>
                <td className={`${TD} bg-blue-50/30 text-left font-mono text-[11px] font-semibold tabular-nums text-blue-900`}>
                  {balance ? fmt(balance.display_balance) : "—"}
                </td>
                <td className={TD}>
                  <div className="flex flex-wrap gap-1">
                    <ActionButton label="بطاقة" onClick={() => onViewCard(node)} />
                    {canAddChild && (
                      <ActionButton
                        label="+ فرع"
                        tone="emerald"
                        disabled={isSaving || !node.is_active}
                        title={
                          parentHasMovements
                            ? "عليه حركة — سيُرفض إذا لم تُزَل الحركات"
                            : undefined
                        }
                        onClick={() => onAddChild(node)}
                      />
                    )}
                    {canEdit && (
                      <ActionButton
                        label="تعديل"
                        tone="blue"
                        disabled={isSaving}
                        onClick={() => onEdit(node)}
                      />
                    )}
                    {canToggleActive && !rootAccount && (
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
  "border border-slate-300 px-3 py-3 first:border-r-2 last:border-l-2";
const TD =
  "border border-slate-300 px-3 py-3 align-top first:border-r-2 last:border-l-2";

function ActionButton({
  label,
  tone = "slate",
  disabled,
  title,
  onClick,
}: {
  label: string;
  tone?: "slate" | "blue" | "emerald" | "amber";
  disabled?: boolean;
  title?: string;
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
      title={title}
      className={`rounded-md border px-2 py-1 text-[11px] font-medium disabled:opacity-50 ${toneClass}`}
    >
      {label}
    </button>
  );
}
