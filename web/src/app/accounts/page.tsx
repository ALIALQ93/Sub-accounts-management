"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccountCardModal } from "@/modules/accounts/components/account-card-modal";
import { AccountEditModal } from "@/modules/accounts/components/account-edit-modal";
import type { AccountEditValues } from "@/modules/accounts/components/account-edit-modal";
import { AccountFormModal } from "@/modules/accounts/components/account-form-modal";
import { AccountTreeTable } from "@/modules/accounts/components/account-tree-table";
import type { AccountFormValues, AccountTreeNode, StatementFilter } from "@/modules/accounts/types";
import { computeAccountDisplayBalances } from "@/modules/accounts/utils/compute-account-balances";
import {
  buildAccountTree,
  collectExpandableIds,
  computeAccountStats,
  flattenAccountTree,
  getParentOptions,
  getVisibleTree,
  isRootAccount,
} from "@/modules/accounts/utils/account-tree";
import { generateAccountCode } from "@/modules/accounts/utils/generate-account-code";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import type { AccountDirectBalance, Currency } from "@/modules/currencies/types";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { SupabaseConnectionStatus } from "@/modules/vouchers/services/voucher-api";
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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [presetParentId, setPresetParentId] = useState<string | undefined>();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountTreeNode | null>(
    null,
  );
  const [editError, setEditError] = useState("");
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [directBalances, setDirectBalances] = useState<AccountDirectBalance[]>(
    [],
  );
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [cardAccount, setCardAccount] = useState<AccountTreeNode | null>(null);
  const [connection, setConnection] = useState<SupabaseConnectionStatus | null>(
    null,
  );

  const reloadAll = async () => {
    const [accountsData, currenciesData, balancesData] = await Promise.all([
      voucherApi.listAllAccounts(),
      currencyApi.listCurrencies(),
      currencyApi.listDirectBalances().catch(() => [] as AccountDirectBalance[]),
    ]);
    setAccounts(accountsData);
    setCurrencies(currenciesData);
    setDirectBalances(balancesData);
    return accountsData;
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [data, connectionStatus, currenciesData, balancesData] =
          await Promise.all([
            voucherApi.listAllAccounts(),
            voucherApi.checkSupabaseConnection(),
            currencyApi.listCurrencies(),
            currencyApi.listDirectBalances().catch(
              () => [] as AccountDirectBalance[],
            ),
          ]);
        if (!cancelled) {
          setAccounts(data);
          setCurrencies(currenciesData);
          setDirectBalances(balancesData);
          setConnection(connectionStatus);
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

  const fullTree = useMemo(() => buildAccountTree(accounts), [accounts]);

  const displayBalances = useMemo(
    () =>
      computeAccountDisplayBalances(fullTree, directBalances, currencies),
    [fullTree, directBalances, currencies],
  );

  const cardBalance = cardAccount
    ? displayBalances.get(cardAccount.id) ?? null
    : null;

  const onCreate = async (values: AccountFormValues) => {
    if (!values.name_ar.trim()) {
      setFormError("يرجى تعبئة اسم الحساب بالعربية.");
      return;
    }
    if (!values.parent_id) {
      setFormError("يجب اختيار حساب أب. الحسابات الرئيسية السبعة ثابتة.");
      return;
    }
    if (!values.currency_id) {
      setFormError("يجب اختيار عملة الحساب.");
      return;
    }

    const parent = accounts.find((account) => account.id === values.parent_id);
    if (!parent) {
      setFormError("الحساب الأب غير موجود.");
      return;
    }

    const code = generateAccountCode(parent, accounts);

    setIsSaving(true);
    setFormError("");
    try {
      await voucherApi.createAccount({
        code,
        name_ar: values.name_ar.trim(),
        name_en: values.name_en.trim() || null,
        parent_id: values.parent_id,
        currency_id: values.currency_id,
        is_postable: values.is_postable,
        is_active: true,
      });
      const data = await reloadAll();
      const { tree: nextTree } = getVisibleTree(data, query, statementFilter);
      setExpandedIds((current) => {
        const next = new Set(current);
        next.add(values.parent_id);
        for (const id of collectExpandableIds(nextTree)) {
          next.add(id);
        }
        return next;
      });
      closeAddModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "فشل إنشاء الحساب.");
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (account: AccountTreeNode) => {
    setEditingAccount(account);
    setEditError("");
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingAccount(null);
    setEditError("");
  };

  const onEdit = async (values: AccountEditValues) => {
    if (!editingAccount) return;
    if (!values.name_ar.trim()) {
      setEditError("اسم الحساب مطلوب.");
      return;
    }
    if (!values.currency_id) {
      setEditError("يجب اختيار عملة الحساب.");
      return;
    }

    setIsSaving(true);
    setEditError("");
    try {
      const payload: Partial<Account> = {
        name_ar: values.name_ar.trim(),
        name_en: values.name_en.trim() || null,
        currency_id: values.currency_id,
      };
      if (
        editingAccount.childCount === 0 &&
        !isRootAccount(editingAccount)
      ) {
        payload.is_postable = values.is_postable;
      }
      await voucherApi.updateAccount(editingAccount.id, payload);
      closeEditModal();
      await reloadAll();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "فشل تعديل الحساب.");
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
      await reloadAll();
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

  const openAddModal = (parentId?: string) => {
    setPresetParentId(parentId);
    setFormError("");
    setFormKey((current) => current + 1);
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setPresetParentId(undefined);
    setFormError("");
  };

  const openAddChild = (account: AccountTreeNode) => {
    openAddModal(account.id);
    setExpandedIds((current) => new Set(current).add(account.id));
  };

  const openCardModal = (account: AccountTreeNode) => {
    setCardAccount(account);
    setIsCardModalOpen(true);
  };

  const closeCardModal = () => {
    setIsCardModalOpen(false);
    setCardAccount(null);
  };

  const filterOptions: Array<{ value: StatementFilter; label: string }> = [
    { value: "all", label: "الكل" },
    { value: "balance_sheet", label: "الميزانية" },
    { value: "income_statement", label: "قائمة الدخل" },
  ];

  return (
    <main className="flex w-full flex-col gap-4">
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
            onClick={() => openAddModal()}
            className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white"
          >
            + إضافة حساب
          </button>
          <Link
            href="/currencies"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            العملات
          </Link>
          <Link
            href="/vouchers/new"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            إنشاء سند
          </Link>
        </div>
      </section>

      {!isLoading && connection && (connection.errorMessage || accounts.length === 0) && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <h2 className="font-semibold">تشخيص الاتصال</h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              Supabase:{" "}
              <span className="font-mono">{connection.supabaseHost}</span>
            </li>
            <li>
              متغيرات البيئة:{" "}
              {connection.configured ? "مضبوطة ✅" : "ناقصة ❌"}
            </li>
            <li>
              عدد الحسابات من API:{" "}
              {connection.accountCount ?? "تعذّر القراءة"}
            </li>
          </ul>
          {connection.errorMessage && (
            <p className="mt-2 text-rose-800">{connection.errorMessage}</p>
          )}
          {!connection.errorMessage && accounts.length === 0 && (
            <div className="mt-2 space-y-1">
              <p>
                البيانات موجودة في Supabase لكن التطبيق لا يقرأها. جرّب بالترتيب:
              </p>
              <ol className="list-inside list-decimal space-y-1 pr-2">
                <li>
                  في Vercel → Settings → Environment Variables أضف:
                  <span className="font-mono"> NEXT_PUBLIC_SUPABASE_URL</span> و
                  <span className="font-mono">
                    {" "}
                    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
                  </span>
                </li>
                <li>اضغط Redeploy بعد حفظ المتغيرات</li>
                <li>
                  في Supabase SQL Editor شغّل ملف{" "}
                  <span className="font-mono">accounting_rls_policies.sql</span>
                </li>
              </ol>
            </div>
          )}
        </section>
      )}

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

      <AccountFormModal
        open={isAddModalOpen}
        formKey={formKey}
        parentAccounts={parentOptions}
        allAccounts={accounts}
        currencies={currencies}
        presetParentId={presetParentId}
        isSaving={isSaving}
        error={formError}
        onClose={closeAddModal}
        onSubmit={onCreate}
      />

      <AccountEditModal
        open={isEditModalOpen}
        account={editingAccount}
        accountsById={accountsById}
        currencies={currencies}
        isSaving={isSaving}
        error={editError}
        onClose={closeEditModal}
        onSubmit={onEdit}
      />

      <AccountCardModal
        open={isCardModalOpen}
        account={cardAccount}
        balance={cardBalance}
        directBalances={directBalances}
        currencies={currencies}
        accountsById={accountsById}
        onClose={closeCardModal}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4 md:p-5">
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
            displayBalances={displayBalances}
            expandedIds={expandedIds}
            isSaving={isSaving}
            onToggleExpand={toggleExpand}
            onEdit={openEditModal}
            onViewCard={openCardModal}
            onToggleActive={toggleActive}
            onAddChild={openAddChild}
          />
        )}
      </section>
    </main>
  );
}
