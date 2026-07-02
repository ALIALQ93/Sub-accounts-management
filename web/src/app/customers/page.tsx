"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OpenInNewTabLink } from "@/components/open-in-new-tab-link";
import { PartyFormModal } from "@/modules/parties/components/party-form-modal";
import { PartySettingsPanel } from "@/modules/parties/components/party-settings-panel";
import { partyApi } from "@/modules/parties/services/party-api";
import type { PartyFormValues, PartySettings } from "@/modules/parties/types";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account, Customer } from "@/modules/vouchers/types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [partySettings, setPartySettings] = useState<PartySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const reload = useCallback(async () => {
    const [customersData, accountsData, settingsData] = await Promise.all([
      voucherApi.listCustomers(),
      voucherApi.listAllAccounts(),
      partyApi.getPartySettings(),
    ]);
    setCustomers(customersData);
    setAccounts(accountsData);
    setPartySettings(settingsData);
    return { customersData, accountsData, settingsData };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await reload();
        if (cancelled) return;
        void data;
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "فشل تحميل العملاء.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  const defaultParentAccountId =
    partySettings?.customer_parent_account_id ?? "";

  const openCreateModal = () => {
    setModalMode("create");
    setEditingCustomer(null);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setModalMode("edit");
    setEditingCustomer(customer);
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setEditingCustomer(null);
    setFormError("");
  };

  const onSubmit = async (values: PartyFormValues) => {
    setIsSaving(true);
    setFormError("");
    setSuccess("");
    try {
      if (modalMode === "create") {
        await partyApi.createCustomerWithAccount(values, customers, accounts);
        setSuccess("تم إضافة العميل وإنشاء حساب الذمم المرتبط.");
      } else if (editingCustomer) {
        await partyApi.updateCustomerWithAccountSync(editingCustomer, values);
        setSuccess("تم تحديث بيانات العميل.");
      }
      await reload();
      setIsModalOpen(false);
      setEditingCustomer(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "فشل حفظ العميل.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (customer: Customer) => {
    setIsSaving(true);
    setSuccess("");
    setLoadError("");
    try {
      await voucherApi.updateCustomer(customer.id, {
        is_active: !customer.is_active,
      });
      await reload();
      setSuccess(customer.is_active ? "تم تعطيل العميل." : "تم تفعيل العميل.");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "فشل تحديث الحالة.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">العملاء</h1>
          <p className="mt-1 text-sm text-slate-600">
            إدارة العملاء — يُنشأ حساب ذمم مدينة فرعي تلقائياً باسم كل عميل.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white"
        >
          + إضافة عميل
        </button>
      </section>

      {!isLoading && (
        <PartySettingsPanel
          kind="customer"
          accounts={accounts}
          settings={partySettings}
          onSettingsChange={setPartySettings}
        />
      )}

      {loadError && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {loadError}
        </p>
      )}
      {success && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      )}

      <section className="rounded-xl border-2 border-slate-300 bg-white p-3 md:p-4">
        {isLoading ? (
          <p className="text-sm text-slate-600">جاري تحميل العملاء...</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border border-slate-200 p-2">الكود</th>
                  <th className="border border-slate-200 p-2">الاسم</th>
                  <th className="border border-slate-200 p-2">الهاتف</th>
                  <th className="border border-slate-200 p-2">البريد</th>
                  <th className="border border-slate-200 p-2">حساب الذمم</th>
                  <th className="border border-slate-200 p-2">الحالة</th>
                  <th className="border border-slate-200 p-2">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const linkedAccount = accountsById.get(
                    customer.receivable_account_id,
                  );
                  return (
                    <tr
                      key={customer.id}
                      className="odd:bg-white even:bg-slate-50/60"
                    >
                      <td className="border border-slate-100 p-2 font-mono">
                        {customer.customer_code}
                      </td>
                      <td className="border border-slate-100 p-2 font-medium">
                        {customer.name_ar}
                      </td>
                      <td className="border border-slate-100 p-2">
                        {customer.phone || "—"}
                      </td>
                      <td className="border border-slate-100 p-2" dir="ltr">
                        {customer.email || "—"}
                      </td>
                      <td className="border border-slate-100 p-2">
                        {linkedAccount ? (
                          <span className="inline-flex flex-wrap items-center gap-1">
                            <Link
                              href={`/reports/account-statement?accountId=${linkedAccount.id}`}
                              className="font-mono text-xs font-medium text-blue-900 hover:underline"
                            >
                              {linkedAccount.code} — {linkedAccount.name_ar}
                            </Link>
                            <OpenInNewTabLink
                              href={`/reports/account-statement?accountId=${linkedAccount.id}`}
                              className="text-xs text-slate-500 hover:text-blue-900"
                              title="كشف الحساب في تبويب جديد"
                            >
                              ↗
                            </OpenInNewTabLink>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="border border-slate-100 p-2">
                        {customer.is_active ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                            نشط
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            معطّل
                          </span>
                        )}
                      </td>
                      <td className="border border-slate-100 p-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(customer)}
                            disabled={isSaving}
                            className="rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 disabled:opacity-50"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(customer)}
                            disabled={isSaving}
                            className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 disabled:opacity-50"
                          >
                            {customer.is_active ? "تعطيل" : "تفعيل"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {customers.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="border border-slate-100 p-6 text-center text-slate-500"
                    >
                      لا يوجد عملاء. اضغط «إضافة عميل» للبدء.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PartyFormModal
        open={isModalOpen}
        mode={modalMode}
        kind="customer"
        party={editingCustomer}
        allAccounts={accounts}
        defaultParentAccountId={defaultParentAccountId}
        existingCustomers={customers}
        existingVendors={[]}
        isSaving={isSaving}
        error={formError}
        onClose={closeModal}
        onSubmit={onSubmit}
      />
    </main>
  );
}
