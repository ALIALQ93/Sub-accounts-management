"use client";

import type { Account } from "@/modules/vouchers/types";
import type { AccountTreeNode, FlatAccountRow } from "@/modules/accounts/types";
import {
  getStatementLabel,
  getStatementType,
  isRootAccount,
} from "@/modules/accounts/utils/account-tree";

interface AccountTreeTableProps {
  rows: FlatAccountRow[];
  accountsById: Map<string, Account>;
  expandedIds: Set<string>;
  editingId: string | null;
  editNameAr: string;
  editIsPostable: boolean;
  isSaving: boolean;
  onToggleExpand: (id: string) => void;
  onStartEdit: (node: AccountTreeNode) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onToggleActive: (node: AccountTreeNode) => void;
  onAddChild: (node: AccountTreeNode) => void;
  onEditNameChange: (value: string) => void;
  onEditPostableChange: (value: boolean) => void;
}

export function AccountTreeTable({
  rows,
  accountsById,
  expandedIds,
  editingId,
  editNameAr,
  editIsPostable,
  isSaving,
  onToggleExpand,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleActive,
  onAddChild,
  onEditNameChange,
  onEditPostableChange,
}: AccountTreeTableProps) {
  if (rows.length === 0) {
    return (
      <p className="p-4 text-center text-sm text-slate-500">
        لا توجد حسابات مطابقة للبحث.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead className="sticky top-0 bg-slate-50">
          <tr className="text-right text-slate-700">
            <th className="border-b border-slate-200 p-2">كود الحساب</th>
            <th className="border-b border-slate-200 p-2">اسم الحساب</th>
            <th className="border-b border-slate-200 p-2">التصنيف</th>
            <th className="border-b border-slate-200 p-2">نوع الحساب</th>
            <th className="border-b border-slate-200 p-2">الحالة</th>
            <th className="border-b border-slate-200 p-2">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ node, depth }) => {
            const hasChildren = node.childCount > 0;
            const isExpanded = expandedIds.has(node.id);
            const isEditing = editingId === node.id;
            const statementType = getStatementType(node, accountsById);
            const rootAccount = isRootAccount(node);
            const canTogglePostable = !hasChildren && !rootAccount;

            return (
              <tr key={node.id} className="odd:bg-white even:bg-slate-50/60">
                <td className="border-b border-slate-100 p-2 font-mono">
                  {node.code}
                </td>
                <td className="border-b border-slate-100 p-2">
                  <div
                    className="flex items-center gap-1"
                    style={{ paddingRight: `${depth * 16}px` }}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => onToggleExpand(node.id)}
                        className="rounded px-1 text-slate-500 hover:bg-slate-100"
                        aria-label={isExpanded ? "طي" : "توسيع"}
                      >
                        {isExpanded ? "▾" : "▸"}
                      </button>
                    ) : (
                      <span className="inline-block w-5" />
                    )}
                    {isEditing ? (
                      <input
                        value={editNameAr}
                        onChange={(event) => onEditNameChange(event.target.value)}
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                    ) : (
                      <span className="font-medium text-slate-900">
                        {node.name_ar}
                      </span>
                    )}
                    {hasChildren && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {node.childCount} فرع
                      </span>
                    )}
                  </div>
                </td>
                <td className="border-b border-slate-100 p-2">
                  {statementType ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        statementType === "balance_sheet"
                          ? "bg-blue-50 text-blue-800"
                          : "bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      {getStatementLabel(statementType)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="border-b border-slate-100 p-2">
                  {isEditing ? (
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editIsPostable}
                        disabled={!canTogglePostable}
                        onChange={(event) =>
                          onEditPostableChange(event.target.checked)
                        }
                      />
                      <span>{editIsPostable ? "مرحّل عليه" : "حساب أب"}</span>
                    </label>
                  ) : node.is_postable ? (
                    "مرحّل عليه"
                  ) : (
                    "حساب أب"
                  )}
                </td>
                <td className="border-b border-slate-100 p-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      node.is_active
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {node.is_active ? "نشط" : "غير نشط"}
                  </span>
                </td>
                <td className="border-b border-slate-100 p-2">
                  <div className="flex flex-wrap gap-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={onSaveEdit}
                          disabled={isSaving}
                          className="rounded-md bg-emerald-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                        >
                          حفظ
                        </button>
                        <button
                          type="button"
                          onClick={onCancelEdit}
                          disabled={isSaving}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
                        >
                          إلغاء
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onAddChild(node)}
                          disabled={isSaving || !node.is_active}
                          className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 disabled:opacity-50"
                        >
                          + فرع
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartEdit(node)}
                          disabled={isSaving}
                          className="rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 disabled:opacity-50"
                        >
                          تعديل
                        </button>
                        {!rootAccount && (
                          <button
                            type="button"
                            onClick={() => onToggleActive(node)}
                            disabled={isSaving}
                            className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 disabled:opacity-50"
                          >
                            {node.is_active ? "تعطيل" : "تفعيل"}
                          </button>
                        )}
                      </>
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
