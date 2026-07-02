"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OpenInNewTabLink } from "@/components/open-in-new-tab-link";
import { PartyFormModal } from "@/modules/parties/components/party-form-modal";
import { PartySettingsPanel } from "@/modules/parties/components/party-settings-panel";
import { partyApi } from "@/modules/parties/services/party-api";
import type { PartyFormValues, PartySettings } from "@/modules/parties/types";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account, Vendor } from "@/modules/vouchers/types";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [partySettings, setPartySettings] = useState<PartySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const reload = useCallback(async () => {
    const [vendorsData, accountsData, settingsData] = await Promise.all([
      voucherApi.listVendors(),
      voucherApi.listAllAccounts(),
      partyApi.getPartySettings(),
    ]);
    setVendors(vendorsData);
    setAccounts(accountsData);
    setPartySettings(settingsData);
    return { vendorsData, accountsData, settingsData };
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
          setLoadError(err instanceof Error ? err.message : "فشل تحميل الموردين.");
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

  const defaultParentAccountId = partySettings?.vendor_parent_account_id ?? "";

  const openCreateModal = () => {
    setModalMode("create");
    setEditingVendor(null);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (vendor: Vendor) => {
    setModalMode("edit");
    setEditingVendor(vendor);
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setEditingVendor(null);
    setFormError("");
  };

  const onSubmit = async (values: PartyFormValues) => {
    setIsSaving(true);
    setFormError("");
    setSuccess("");
    try {
      if (modalMode === "create") {
        await partyApi.createVendorWithAccount(values, vendors, accounts);
        setSuccess("تم إضافة المورد وإنشاء حساب الذمم المرتبط.");
      } else if (editingVendor) {
        await partyApi.updateVendorWithAccountSync(editingVendor, values);
        setSuccess("تم تحديث بيانات المورد.");
      }
      await reload();
      setIsModalOpen(false);
      setEditingVendor(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "فشل حفظ المورد.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (vendor: Vendor) => {
    setIsSaving(true);
    setSuccess("");
    setLoadError("");
    try {
      await voucherApi.updateVendor(vendor.id, {
        is_active: !vendor.is_active,
      });
      await reload();
      setSuccess(vendor.is_active ? "تم تعطيل المورد." : "تم تفعيل المورد.");
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
          <h1 className="text-2xl font-bold text-slate-900">الموردين</h1>
          <p className="mt-1 text-sm text-slate-600">
            إدارة الموردين — يُنشأ حساب ذمم دائنة فرعي تلقائياً باسم كل مورد.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white"
        >
          + إضافة مورد
        </button>
      </section>

      {!isLoading && (
        <PartySettingsPanel
          kind="vendor"
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
          <p className="text-sm text-slate-600">جاري تحميل الموردين...</p>
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
                {vendors.map((vendor) => {
                  const linkedAccount = accountsById.get(vendor.payable_account_id);
                  return (
                    <tr key={vendor.id} className="odd:bg-white even:bg-slate-50/60">
                      <td className="border border-slate-100 p-2 font-mono">
                        {vendor.vendor_code}
                      </td>
                      <td className="border border-slate-100 p-2 font-medium">
                        {vendor.name_ar}
                      </td>
                      <td className="border border-slate-100 p-2">
                        {vendor.phone || "—"}
                      </td>
                      <td className="border border-slate-100 p-2" dir="ltr">
                        {vendor.email || "—"}
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
                        {vendor.is_active ? (
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
                            onClick={() => openEditModal(vendor)}
                            disabled={isSaving}
                            className="rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 disabled:opacity-50"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(vendor)}
                            disabled={isSaving}
                            className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 disabled:opacity-50"
                          >
                            {vendor.is_active ? "تعطيل" : "تفعيل"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {vendors.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="border border-slate-100 p-6 text-center text-slate-500"
                    >
                      لا يوجد موردين. اضغط «إضافة مورد» للبدء.
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
        kind="vendor"
        party={editingVendor}
        allAccounts={accounts}
        defaultParentAccountId={defaultParentAccountId}
        existingCustomers={[]}
        existingVendors={vendors}
        isSaving={isSaving}
        error={formError}
        onClose={closeModal}
        onSubmit={onSubmit}
      />
    </main>
  );
}
