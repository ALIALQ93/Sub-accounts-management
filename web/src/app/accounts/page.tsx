"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccountForm } from "@/modules/accounts/components/account-form";
import { AccountTreeTable } from "@/modules/accounts/components/account-tree-table";
import type { AccountFormValues, AccountTreeNode, StatementFilter } from "@/modules/accounts/types";
import {
  collectExpandableIds,
  computeAccountStats,
  flattenAccountTree,
  getParentOptions,
  getVisibleTree,
} from "@/modules/accounts/utils/account-tree";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account } from "@/modules/vouchers/types";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [query, setQuery] = useState("");
  const [statementFilter, setStatementFilter] = useState<StatementFilter>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(true);
  const [presetParentId, setPresetParentId] = useState<string | undefined>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameAr, setEditNameAr] = useState("");
  const [editIsPostable, setEditIsPostable] = useState(true);
  const [editingHasChildren, setEditingHasChildren] = useState(false);

  const loadAccounts = async () => {
    const data = await voucherApi.listAllAccounts();
    setAccounts(data);
    return data;
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await voucherApi.listAllAccounts();
        if (!cancelled) {
          setAccounts(data);
          const { tree } = getVisibleTree(data, "", "all");
          setExpandedIds(new Set(collectExpandableIds(tree)));
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "فشل تحميل الحسابات.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => computeAccountStats(accounts), [accounts]);

  const { tree, accountsById } = useMemo(
    () => getVisibleTree(accounts, query, statementFilter),
    [accounts, query, statementFilter],
  );

  const rows = useMemo(
    () => flattenAccountTree(tree, expandedIds),
    [tree, expandedIds],
  );

  const parentOptions = useMemo(() => getParentOptions(accounts), [accounts]);

  const onCreate = async (values: AccountFormValues) => {
    if (!values.code.trim() || !values.name_ar.trim()) {
      setFormError("يرجى تعبئة كود الحساب واسم الحساب.");
      return;
    }
    if (!values.parent_id) {
      setFormError("يجب اختيار حساب أب. الحسابات الرئيسية السبعة ثابتة.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      await voucherApi.createAccount({
        code: values.code.trim(),
        name_ar: values.name_ar.trim(),
        parent_id: values.parent_id,
        is_postable: values.is_postable,
        is_active: true,
      });
      const data = await loadAccounts();
      const { tree: nextTree } = getVisibleTree(data, query, statementFilter);
      setExpandedIds((current) => {
        const next = new Set(current);
        next.add(values.parent_id);
        for (const id of collectExpandableIds(nextTree)) {
          next.add(id);
        }
        return next;
      });
      setPresetParentId(undefined);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "فشل إنشاء الحساب.");
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (account: AccountTreeNode) => {
    setEditingId(account.id);
    setEditNameAr(account.name_ar);
    setEditIsPostable(account.is_postable);
    setEditingHasChildren(account.childCount > 0);
    setActionError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditNameAr("");
    setEditIsPostable(true);
    setEditingHasChildren(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editNameAr.trim()) {
      setActionError("اسم الحساب مطلوب.");
      return;
    }

    setIsSaving(true);
    setActionError("");
    try {
      const payload: Partial<Account> = { name_ar: editNameAr.trim() };
      if (!editingHasChildren) {
        payload.is_postable = editIsPostable;
      }
      await voucherApi.updateAccount(editingId, payload);
      cancelEdit();
      await loadAccounts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "فشل تعديل الحساب.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (account: AccountTreeNode) => {
    setIsSaving(true);
    setActionError("");
    try {
      await voucherApi.updateAccount(account.id, {
        is_active: !account.is_active,
      });
      await loadAccounts();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "فشل تغيير حالة الحساب.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(collectExpandableIds(tree)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const openAddChild = (account: AccountTreeNode) => {
    setPresetParentId(account.id);
    setShowForm(true);
    setFormError("");
    setExpandedIds((current) => new Set(current).add(account.id));
  };

  const filterOptions: Array<{ value: StatementFilter; label: string }> = [
    { value: "all", label: "الكل" },
    { value: "balance_sheet", label: "الميزانية" },
    { value: "income_statement", label: "قائمة الدخل" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">دليل الحسابات</h1>
          <p className="mt-1 text-sm text-slate-600">
            شجرة الحسابات: 7 حسابات رئيسية + فروع يضيفها المستخدم.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setPresetParentId(undefined);
              setShowForm((current) => !current);
            }}
            className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white"
          >
            {showForm ? "إخفاء نموذج الإضافة" : "إضافة حساب فرعي"}
          </button>
          <Link
            href="/vouchers/new"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            إنشاء سند
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">إجمالي الحسابات</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">حسابات نشطة</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{stats.active}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">قابلة للترحيل</p>
          <p className="mt-2 text-2xl font-bold text-blue-900">{stats.postable}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">حسابات أب</p>
          <p className="mt-2 text-2xl font-bold text-slate-700">{stats.parent}</p>
        </article>
      </section>

      {showForm && (
        <AccountForm
          key={presetParentId ?? "new-account"}
          parentAccounts={parentOptions}
          presetParentId={presetParentId}
          isSaving={isSaving}
          error={formError}
          onSubmit={onCreate}
          onCancel={
            presetParentId
              ? () => {
                  setPresetParentId(undefined);
                  setFormError("");
                }
              : undefined
          }
        />
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="grid min-w-[220px] flex-1 gap-1 text-sm">
            <span className="text-slate-700">بحث</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="كود أو اسم الحساب"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatementFilter(option.value)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  statementFilter === option.value
                    ? "bg-blue-900 text-white"
                    : "border border-slate-300 text-slate-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              توسيع الكل
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              طي الكل
            </button>
          </div>
        </div>

        {isLoading && (
          <p className="text-sm text-slate-600">جاري تحميل الحسابات...</p>
        )}
        {!isLoading && loadError && (
          <p className="text-sm text-rose-700">{loadError}</p>
        )}
        {!isLoading && actionError && (
          <p className="mb-3 text-sm text-rose-700">{actionError}</p>
        )}

        {!isLoading && !loadError && (
          <AccountTreeTable
            rows={rows}
            accountsById={accountsById}
            expandedIds={expandedIds}
            editingId={editingId}
            editNameAr={editNameAr}
            editIsPostable={editIsPostable}
            isSaving={isSaving}
            onToggleExpand={toggleExpand}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onSaveEdit={saveEdit}
            onToggleActive={toggleActive}
            onAddChild={openAddChild}
            onEditNameChange={setEditNameAr}
            onEditPostableChange={setEditIsPostable}
          />
        )}
      </section>
    </main>
  );
}
