"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account } from "@/modules/vouchers/types";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [parentId, setParentId] = useState("");
  const [isPostable, setIsPostable] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameAr, setEditNameAr] = useState("");
  const [editIsPostable, setEditIsPostable] = useState(true);

  const loadAccounts = async () => {
    try {
      const data = await voucherApi.listAllAccounts();
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل الحسابات.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await voucherApi.listAllAccounts();
        if (!cancelled) setAccounts(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل الحسابات.");
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

  const onCreate = async () => {
    if (!code.trim() || !nameAr.trim()) {
      setError("يرجى تعبئة كود الحساب واسم الحساب.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await voucherApi.createAccount({
        code: code.trim(),
        name_ar: nameAr.trim(),
        parent_id: parentId || null,
        is_postable: parentId ? false : isPostable,
        is_active: true,
      });
      setCode("");
      setNameAr("");
      setParentId("");
      setIsPostable(true);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إنشاء الحساب.");
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (account: Account) => {
    setEditingId(account.id);
    setEditNameAr(account.name_ar);
    setEditIsPostable(account.is_postable);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditNameAr("");
    setEditIsPostable(true);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editNameAr.trim()) {
      setError("اسم الحساب مطلوب.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await voucherApi.updateAccount(editingId, {
        name_ar: editNameAr.trim(),
        is_postable: editIsPostable,
      });
      cancelEdit();
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تعديل الحساب.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (account: Account) => {
    setIsSaving(true);
    setError("");
    try {
      await voucherApi.updateAccount(account.id, { is_active: !account.is_active });
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تغيير حالة الحساب.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <section className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">دليل الحسابات</h1>
        <Link
          href="/vouchers/new"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          إنشاء سند
        </Link>
      </section>

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">إضافة حساب</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="كود الحساب"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={nameAr}
            onChange={(event) => setNameAr(event.target.value)}
            placeholder="اسم الحساب"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">بدون أب (حساب رئيسي)</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name_ar}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm">
            <input
              id="isPostable"
              type="checkbox"
              checked={isPostable}
              disabled={Boolean(parentId)}
              onChange={(event) => setIsPostable(event.target.checked)}
            />
            <label htmlFor="isPostable">قابل للترحيل</label>
          </div>
        </div>
        <button
          type="button"
          onClick={onCreate}
          disabled={isSaving}
          className="mt-3 rounded-md bg-blue-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          إضافة حساب
        </button>
        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {isLoading && <p className="text-sm text-slate-600">جاري تحميل الحسابات...</p>}
        {!isLoading && error && <p className="text-sm text-rose-700">{error}</p>}

        {!isLoading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border-b border-slate-200 p-2">كود الحساب</th>
                  <th className="border-b border-slate-200 p-2">اسم الحساب</th>
                  <th className="border-b border-slate-200 p-2">حالة الترحيل</th>
                  <th className="border-b border-slate-200 p-2">الحالة</th>
                  <th className="border-b border-slate-200 p-2">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {account.code}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {editingId === account.id ? (
                        <input
                          value={editNameAr}
                          onChange={(event) => setEditNameAr(event.target.value)}
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                        />
                      ) : (
                        <>
                          {"\u00A0".repeat(((account.level ?? 1) - 1) * 2)}
                          {account.name_ar}
                        </>
                      )}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {editingId === account.id ? (
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editIsPostable}
                            onChange={(event) => setEditIsPostable(event.target.checked)}
                          />
                          <span>{editIsPostable ? "مرحّل عليه" : "حساب أب"}</span>
                        </label>
                      ) : account.is_postable ? (
                        "مرحّل عليه"
                      ) : (
                        "حساب أب"
                      )}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {account.is_active ? "نشط" : "غير نشط"}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      <div className="flex flex-wrap gap-2">
                        {editingId === account.id ? (
                          <>
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={isSaving}
                              className="rounded-md bg-emerald-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                            >
                              حفظ
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
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
                              onClick={() => startEdit(account)}
                              disabled={isSaving}
                              className="rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 disabled:opacity-50"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleActive(account)}
                              disabled={isSaving}
                              className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 disabled:opacity-50"
                            >
                              {account.is_active ? "تعطيل" : "تفعيل"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {accounts.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="border-b border-slate-100 p-4 text-center text-slate-500"
                    >
                      لا توجد حسابات.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
