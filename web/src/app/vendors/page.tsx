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
import type { Account, Vendor } from "@/modules/vouchers/types";

export default function VendorsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("vendors.edit");
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
          <h1 className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
            الموردين
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            إدارة الموردين — يُنشأ حساب ذمم دائنة فرعي تلقائياً باسم كل مورد.
          </p>
        </div>
        <PermissionGate permission="vendors.create">
          <button type="button" onClick={openCreateModal} className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            إضافة مورد
          </button>
        </PermissionGate>
      </section>

      {!isLoading && (
        <PartySettingsPanel
          kind="vendor"
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
          <p className="p-4 text-sm text-slate-600">جاري تحميل الموردين...</p>
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
                {vendors.map((vendor) => {
                  const linkedAccount = accountsById.get(vendor.payable_account_id);
                  return (
                    <tr key={vendor.id}>
                      <td className="font-mono text-slate-600">
                        {vendor.vendor_code}
                      </td>
                      <td className="font-medium text-slate-900">
                        {vendor.name_ar}
                      </td>
                      <td className="text-slate-600">{vendor.phone || "—"}</td>
                      <td className="text-slate-600" dir="ltr">
                        {vendor.email || "—"}
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
                        {vendor.is_active ? (
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
                                onClick={() => openEditModal(vendor)}
                                disabled={isSaving}
                                className="btn btn-sm btn-outline"
                              >
                                تعديل
                              </button>
                              <button
                                type="button"
                                onClick={() => void toggleActive(vendor)}
                                disabled={isSaving}
                                className="btn btn-sm btn-outline text-[var(--warning)]"
                              >
                                {vendor.is_active ? "تعطيل" : "تفعيل"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {vendors.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
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
