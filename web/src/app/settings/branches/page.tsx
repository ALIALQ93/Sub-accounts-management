"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/modules/auth/auth-context";
import { BranchFormModal } from "@/modules/branches/components/branch-form-modal";
import {
  branchApi,
  type Branch,
  type BranchFormValues,
} from "@/modules/branches/services/branch-api";
import { SettingsNav } from "@/modules/settings/components/settings-nav";

export default function BranchesSettingsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("settings.company.edit");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  const reload = useCallback(async () => {
    const data = await branchApi.listBranches();
    setBranches(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void branchApi
      .listBranches()
      .then((data) => {
        if (!cancelled) setBranches(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل الفروع.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openCreate = () => {
    setModalMode("create");
    setEditingBranch(null);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setModalMode("edit");
    setEditingBranch(branch);
    setFormError("");
    setIsModalOpen(true);
  };

  const onSubmit = async (values: BranchFormValues) => {
    if (!values.branch_code.trim() || !values.name_ar.trim()) {
      setFormError("رمز الفرع والاسم العربي مطلوبان.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      if (modalMode === "create") {
        await branchApi.createBranch(values);
      } else if (editingBranch) {
        await branchApi.updateBranch(editingBranch.id, values);
      }
      await reload();
      setIsModalOpen(false);
      setEditingBranch(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "فشل حفظ الفرع.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (branch: Branch) => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      await branchApi.updateBranch(branch.id, { is_active: !branch.is_active });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحديث الفرع.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl">
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-[var(--brand-navy)]">الفروع</h1>
      <SettingsNav />

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            تعريف فروع المنشأة — مرتبطة بالفواتير والقيود والمستودعات.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              disabled={isSaving}
              className="btn btn-primary"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              فرع جديد
            </button>
          )}
        </div>

        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}
        {!isLoading && !error && branches.length === 0 && (
          <p className="text-sm text-slate-600">
            لا توجد فروع — شغّل{" "}
            <code className="text-xs">patch_branches.sql</code> أو أضف فرعاً
            جديداً.
          </p>
        )}

        {!isLoading && !error && branches.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="data-table min-w-[720px]">
              <thead>
                <tr>
                  <th>الرمز</th>
                  <th>الاسم</th>
                  <th>النوع</th>
                  <th>الحالة</th>
                  {canEdit && <th>إجراء</th>}
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <tr key={branch.id}>
                    <td className="font-mono">{branch.branch_code}</td>
                    <td>
                      {branch.name_ar}
                      {branch.name_en && (
                        <span className="block text-xs text-slate-500">
                          {branch.name_en}
                        </span>
                      )}
                    </td>
                    <td className="text-xs">
                      {branch.is_head_office ? "رئيسي" : "فرع"}
                    </td>
                    <td>
                      {branch.is_active ? (
                        <span className="badge badge-success">نشط</span>
                      ) : (
                        <span className="badge badge-muted">معطّل</span>
                      )}
                    </td>
                    {canEdit && (
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(branch)}
                            disabled={isSaving}
                            className="btn btn-sm btn-outline"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(branch)}
                            disabled={isSaving}
                            className="btn btn-sm btn-outline"
                          >
                            {branch.is_active ? "تعطيل" : "تفعيل"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <BranchFormModal
        open={isModalOpen}
        mode={modalMode}
        initialValues={editingBranch}
        isSaving={isSaving}
        error={formError}
        onClose={() => {
          if (isSaving) return;
          setIsModalOpen(false);
          setEditingBranch(null);
          setFormError("");
        }}
        onSubmit={(values) => void onSubmit(values)}
      />
    </main>
  );
}
