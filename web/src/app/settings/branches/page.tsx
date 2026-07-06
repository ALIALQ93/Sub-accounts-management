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
      <h1 className="mb-4 text-2xl font-bold text-slate-900">الفروع</h1>
      <SettingsNav />

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            تعريف فروع المنشأة — مرتبطة بالفواتير والقيود والمستودعات.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              disabled={isSaving}
              className="rounded-md bg-blue-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              فرع جديد
            </button>
          )}
        </div>

        {isLoading && <p className="text-sm text-slate-600">جاري التحميل...</p>}
        {!isLoading && error && (
          <p className="text-sm text-rose-700">{error}</p>
        )}
        {!isLoading && !error && branches.length === 0 && (
          <p className="text-sm text-slate-600">
            لا توجد فروع — شغّل{" "}
            <code className="text-xs">patch_branches.sql</code> أو أضف فرعاً
            جديداً.
          </p>
        )}

        {!isLoading && !error && branches.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border-b border-slate-200 p-2">الرمز</th>
                  <th className="border-b border-slate-200 p-2">الاسم</th>
                  <th className="border-b border-slate-200 p-2">النوع</th>
                  <th className="border-b border-slate-200 p-2">الحالة</th>
                  {canEdit && (
                    <th className="border-b border-slate-200 p-2">إجراء</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <tr key={branch.id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border-b border-slate-100 p-2 font-mono">
                      {branch.branch_code}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {branch.name_ar}
                      {branch.name_en && (
                        <span className="block text-xs text-slate-500">
                          {branch.name_en}
                        </span>
                      )}
                    </td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {branch.is_head_office ? "رئيسي" : "فرع"}
                    </td>
                    <td className="border-b border-slate-100 p-2 text-xs">
                      {branch.is_active ? (
                        <span className="text-emerald-700">نشط</span>
                      ) : (
                        <span className="text-slate-500">معطّل</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="border-b border-slate-100 p-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(branch)}
                            disabled={isSaving}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(branch)}
                            disabled={isSaving}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
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
