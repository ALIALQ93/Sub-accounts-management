"use client";

import { useEffect, useState } from "react";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account, Customer } from "@/modules/vouchers/types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const [customerCode, setCustomerCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [receivableAccountId, setReceivableAccountId] = useState("");
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editNameAr, setEditNameAr] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editReceivableAccountId, setEditReceivableAccountId] = useState("");

  const reloadCustomers = async () => {
    try {
      const [customersData, accountsData] = await Promise.all([
        voucherApi.listCustomers(),
        voucherApi.listAccounts(),
      ]);
      setCustomers(customersData);
      setAccounts(accountsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل العملاء.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const [customersData, accountsData] = await Promise.all([
          voucherApi.listCustomers(),
          voucherApi.listAccounts(),
        ]);
        if (cancelled) return;
        setCustomers(customersData);
        setAccounts(accountsData);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل العملاء.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  const onCreate = async () => {
    if (!customerCode.trim() || !nameAr.trim() || !receivableAccountId) {
      setError("يرجى تعبئة كود العميل والاسم والحساب.");
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      await voucherApi.createCustomer({
        customer_code: customerCode.trim(),
        name_ar: nameAr.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        receivable_account_id: receivableAccountId,
        is_active: true,
      });

      setCustomerCode("");
      setNameAr("");
      setPhone("");
      setEmail("");
      setReceivableAccountId("");
      await reloadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إنشاء العميل.");
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (customer: Customer) => {
    setEditingCustomerId(customer.id);
    setEditNameAr(customer.name_ar);
    setEditPhone(customer.phone ?? "");
    setEditEmail(customer.email ?? "");
    setEditReceivableAccountId(customer.receivable_account_id);
  };

  const cancelEdit = () => {
    setEditingCustomerId(null);
    setEditNameAr("");
    setEditPhone("");
    setEditEmail("");
    setEditReceivableAccountId("");
  };

  const saveEdit = async () => {
    if (!editingCustomerId) return;
    if (!editNameAr.trim() || !editReceivableAccountId) {
      setError("الاسم وحساب الذمم مطلوبان.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await voucherApi.updateCustomer(editingCustomerId, {
        name_ar: editNameAr.trim(),
        phone: editPhone.trim() || null,
        email: editEmail.trim() || null,
        receivable_account_id: editReceivableAccountId,
      });
      cancelEdit();
      await reloadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تعديل العميل.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (customer: Customer) => {
    setIsSaving(true);
    setError("");
    try {
      await voucherApi.updateCustomer(customer.id, {
        is_active: !customer.is_active,
      });
      await reloadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تغيير حالة العميل.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">العملاء</h1>

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">إضافة عميل</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <input
            value={customerCode}
            onChange={(event) => setCustomerCode(event.target.value)}
            placeholder="كود العميل"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={nameAr}
            onChange={(event) => setNameAr(event.target.value)}
            placeholder="اسم العميل"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="الهاتف"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="البريد الإلكتروني"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={receivableAccountId}
            onChange={(event) => setReceivableAccountId(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">اختر حساب الذمم المدينة</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name_ar}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onCreate}
            disabled={isSaving}
            className="rounded-md bg-blue-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            إضافة
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {isLoading ? (
          <p className="text-sm text-slate-600">جاري تحميل العملاء...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border-b border-slate-200 p-2">الكود</th>
                  <th className="border-b border-slate-200 p-2">الاسم</th>
                  <th className="border-b border-slate-200 p-2">الهاتف</th>
                  <th className="border-b border-slate-200 p-2">البريد</th>
                  <th className="border-b border-slate-200 p-2">حساب الذمم</th>
                  <th className="border-b border-slate-200 p-2">الحالة</th>
                  <th className="border-b border-slate-200 p-2">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {customer.customer_code}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {editingCustomerId === customer.id ? (
                        <input
                          value={editNameAr}
                          onChange={(event) => setEditNameAr(event.target.value)}
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                        />
                      ) : (
                        customer.name_ar
                      )}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {editingCustomerId === customer.id ? (
                        <input
                          value={editPhone}
                          onChange={(event) => setEditPhone(event.target.value)}
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                        />
                      ) : (
                        customer.phone || "-"
                      )}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {editingCustomerId === customer.id ? (
                        <input
                          value={editEmail}
                          onChange={(event) => setEditEmail(event.target.value)}
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                        />
                      ) : (
                        customer.email || "-"
                      )}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {editingCustomerId === customer.id ? (
                        <select
                          value={editReceivableAccountId}
                          onChange={(event) =>
                            setEditReceivableAccountId(event.target.value)
                          }
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                        >
                          <option value="">اختر الحساب</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.code} - {account.name_ar}
                            </option>
                          ))}
                        </select>
                      ) : (
                        accounts.find(
                          (account) => account.id === customer.receivable_account_id,
                        )?.code ?? "-"
                      )}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {customer.is_active ? "نشط" : "غير نشط"}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      <div className="flex flex-wrap gap-2">
                        {editingCustomerId === customer.id ? (
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
                              onClick={() => startEdit(customer)}
                              disabled={isSaving}
                              className="rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 disabled:opacity-50"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleActive(customer)}
                              disabled={isSaving}
                              className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 disabled:opacity-50"
                            >
                              {customer.is_active ? "تعطيل" : "تفعيل"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="border-b border-slate-100 p-4 text-center text-slate-500"
                    >
                      لا توجد بيانات عملاء.
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
