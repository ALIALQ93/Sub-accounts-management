"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { OpenInNewTabLink } from "@/components/open-in-new-tab-link";
import { useAuth } from "@/modules/auth/auth-context";
import { PartyFormModal } from "@/modules/parties/components/party-form-modal";
import { PartySettingsPanel } from "@/modules/parties/components/party-settings-panel";
import { partyApi } from "@/modules/parties/services/party-api";
import type { PartyFormValues, PartySettings } from "@/modules/parties/types";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account, Customer } from "@/modules/vouchers/types";

export default function CustomersPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("customers.edit");
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
          <h1 className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
            العملاء
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            إدارة العملاء — يُنشأ حساب ذمم مدينة فرعي تلقائياً باسم كل عميل.
          </p>
        </div>
        <PermissionGate permission="customers.create">
          <button type="button" onClick={openCreateModal} className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            إضافة عميل
          </button>
        </PermissionGate>
      </section>

      {!isLoading && (
        <PartySettingsPanel
          kind="customer"
          accounts={accounts}
          settings={partySettings}
          onSettingsChange={setPartySettings}
          readOnly={!canEdit}
        />
      )}

      {loadError && (
        <p className="rounded-md border border-[var(--danger)]/25 bg-[var(--danger)]/8 px-3 py-2 text-sm text-[var(--danger)]">
          {loadError}
        </p>
      )}
      {success && (
        <p className="rounded-md border border-[var(--success)]/25 bg-[var(--success)]/8 px-3 py-2 text-sm text-[var(--success)]">
          {success}
        </p>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <p className="p-4 text-sm text-slate-600">جاري تحميل العملاء...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[920px]">
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>الاسم</th>
                  <th>الهاتف</th>
                  <th>البريد</th>
                  <th>حساب الذمم</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const linkedAccount = accountsById.get(
                    customer.receivable_account_id,
                  );
                  return (
                    <tr key={customer.id}>
                      <td className="font-mono text-slate-600">
                        {customer.customer_code}
                      </td>
                      <td className="font-medium text-slate-900">
                        {customer.name_ar}
                      </td>
                      <td className="text-slate-600">{customer.phone || "—"}</td>
                      <td className="text-slate-600" dir="ltr">
                        {customer.email || "—"}
                      </td>
                      <td>
                        {linkedAccount ? (
                          <span className="inline-flex flex-wrap items-center gap-1">
                            <Link
                              href={`/reports/account-statement?accountId=${linkedAccount.id}`}
                              className="font-mono text-xs font-medium text-[var(--brand-navy)] hover:underline"
                            >
                              {linkedAccount.code} — {linkedAccount.name_ar}
                            </Link>
                            <OpenInNewTabLink
                              href={`/reports/account-statement?accountId=${linkedAccount.id}`}
                              className="text-xs text-slate-400 hover:text-[var(--brand-navy)]"
                              title="كشف الحساب في تبويب جديد"
                            >
                              ↗
                            </OpenInNewTabLink>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {customer.is_active ? (
                          <span className="badge badge-success">نشط</span>
                        ) : (
                          <span className="badge badge-muted">معطّل</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(customer)}
                                disabled={isSaving}
                                className="btn btn-sm btn-outline"
                              >
                                تعديل
                              </button>
                              <button
                                type="button"
                                onClick={() => void toggleActive(customer)}
                                disabled={isSaving}
                                className="btn btn-sm btn-outline text-[var(--warning)]"
                              >
                                {customer.is_active ? "تعطيل" : "تفعيل"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {customers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
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
