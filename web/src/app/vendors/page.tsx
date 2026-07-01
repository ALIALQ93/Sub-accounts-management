"use client";

import { useEffect, useState } from "react";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account, Vendor } from "@/modules/vouchers/types";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const [vendorCode, setVendorCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [payableAccountId, setPayableAccountId] = useState("");

  const reloadVendors = async () => {
    try {
      const [vendorsData, accountsData] = await Promise.all([
        voucherApi.listVendors(),
        voucherApi.listAccounts(),
      ]);
      setVendors(vendorsData);
      setAccounts(accountsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل الموردين.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const [vendorsData, accountsData] = await Promise.all([
          voucherApi.listVendors(),
          voucherApi.listAccounts(),
        ]);
        if (cancelled) return;
        setVendors(vendorsData);
        setAccounts(accountsData);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل الموردين.");
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
    if (!vendorCode.trim() || !nameAr.trim() || !payableAccountId) {
      setError("يرجى تعبئة كود المورد والاسم والحساب.");
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      await voucherApi.createVendor({
        vendor_code: vendorCode.trim(),
        name_ar: nameAr.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        payable_account_id: payableAccountId,
        is_active: true,
      });

      setVendorCode("");
      setNameAr("");
      setPhone("");
      setEmail("");
      setPayableAccountId("");
      await reloadVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إنشاء المورد.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">الموردين</h1>

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">إضافة مورد</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <input
            value={vendorCode}
            onChange={(event) => setVendorCode(event.target.value)}
            placeholder="كود المورد"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={nameAr}
            onChange={(event) => setNameAr(event.target.value)}
            placeholder="اسم المورد"
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
            value={payableAccountId}
            onChange={(event) => setPayableAccountId(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">اختر حساب الذمم الدائنة</option>
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
          <p className="text-sm text-slate-600">جاري تحميل الموردين...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border-b border-slate-200 p-2">الكود</th>
                  <th className="border-b border-slate-200 p-2">الاسم</th>
                  <th className="border-b border-slate-200 p-2">الهاتف</th>
                  <th className="border-b border-slate-200 p-2">البريد</th>
                  <th className="border-b border-slate-200 p-2">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {vendor.vendor_code}
                    </td>
                    <td className="border-b border-slate-100 p-2">{vendor.name_ar}</td>
                    <td className="border-b border-slate-100 p-2">{vendor.phone || "-"}</td>
                    <td className="border-b border-slate-100 p-2">{vendor.email || "-"}</td>
                    <td className="border-b border-slate-100 p-2">
                      {vendor.is_active ? "نشط" : "غير نشط"}
                    </td>
                  </tr>
                ))}
                {vendors.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="border-b border-slate-100 p-4 text-center text-slate-500"
                    >
                      لا توجد بيانات موردين.
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
