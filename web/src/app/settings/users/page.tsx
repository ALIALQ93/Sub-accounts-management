"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { useAuth } from "@/modules/auth/auth-context";
import { SettingsNav } from "@/modules/settings/components/settings-nav";
import { permissionsApi } from "@/modules/settings/services/permissions-api";
import { settingsApi } from "@/modules/settings/services/settings-api";
import type { AppRole, CreateUserFormValues, UserProfile } from "@/modules/settings/types";
import { ROLE_LABELS } from "@/modules/settings/types";

const EMPTY_CREATE_FORM: CreateUserFormValues = {
  email: "",
  password: "",
  full_name_ar: "",
  full_name_en: "",
  role: "accountant",
};

export default function UsersSettingsPage() {
  const {
    isAdmin,
    hasPermission,
    profile: currentProfile,
  } = useAuth();
  const canManageUsers =
    isAdmin || hasPermission("settings.users.manage");
  const canManagePermissions =
    isAdmin || hasPermission("settings.permissions.manage");
  const canViewUsers =
    isAdmin || hasPermission("settings.users.view") || canManageUsers;
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserFormValues>(EMPTY_CREATE_FORM);

  const reload = useCallback(async () => {
    const data = await settingsApi.listProfiles();
    setProfiles(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        await reload();
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "فشل تحميل المستخدمين.");
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

  const updateProfileField = async (
    profile: UserProfile,
    payload: Partial<Pick<UserProfile, "role" | "is_active" | "full_name_ar" | "full_name_en">>,
  ) => {
    if (!canManageUsers) return;
    setIsSaving(true);
    setSuccess("");
    setLoadError("");
    try {
      await settingsApi.updateProfile(profile.id, payload);
      await reload();
      setSuccess("تم تحديث المستخدم.");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "فشل التحديث.");
    } finally {
      setIsSaving(false);
    }
  };

  const onCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createForm.email.trim() || !createForm.password || !createForm.full_name_ar.trim()) {
      setFormError("البريد وكلمة المرور والاسم مطلوبة.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    setSuccess("");
    try {
      const created = await settingsApi.createUserViaApi(createForm);
      await permissionsApi.applyRoleTemplate(created.id, createForm.role);
      await reload();
      setCreateForm(EMPTY_CREATE_FORM);
      setIsModalOpen(false);
      setSuccess("تم إنشاء المستخدم.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "فشل إنشاء المستخدم.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canViewUsers) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">المستخدمون</h1>
        <SettingsNav />
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          لا تملك صلاحية عرض المستخدمين.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">المستخدمون</h1>
          <p className="mt-1 text-sm text-slate-600">
            إدارة حسابات الدخول — الصلاحيات التفصيلية من قسم{" "}
            <Link href="/settings/permissions" className="text-[var(--brand-navy)] underline">
              الصلاحيات
            </Link>
            .
          </p>
        </div>
        {canManageUsers && (
          <button
            type="button"
            onClick={() => {
              setFormError("");
              setIsModalOpen(true);
            }}
            className="btn btn-primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            إضافة مستخدم
          </button>
        )}
      </section>

      <SettingsNav />

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

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
        {isLoading ? (
          <p className="text-sm text-slate-600">جاري تحميل المستخدمين...</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>البريد</th>
                  <th>الصلاحية</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id}>
                    <td className="font-medium">
                      {profile.full_name_ar}
                    </td>
                    <td dir="ltr">
                      {profile.email}
                    </td>
                    <td>
                      <select
                        value={profile.role}
                        disabled={isSaving || !canManageUsers || profile.id === currentProfile?.id}
                        onChange={(event) =>
                          void updateProfileField(profile, {
                            role: event.target.value as AppRole,
                          })
                        }
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-60"
                      >
                        {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {profile.is_active ? (
                        <span className="badge badge-success">نشط</span>
                      ) : (
                        <span className="badge badge-muted">معطّل</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {canManagePermissions && (
                          <Link
                            href={`/settings/users/${profile.id}/permissions`}
                            className="btn btn-sm btn-outline text-violet-800"
                          >
                            الصلاحيات
                          </Link>
                        )}
                        {canManageUsers && profile.id !== currentProfile?.id && (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              void updateProfileField(profile, {
                                is_active: !profile.is_active,
                              })
                            }
                            className="btn btn-sm btn-outline text-amber-700"
                          >
                            {profile.is_active ? "تعطيل" : "تفعيل"}
                          </button>
                        )}
                        {profile.id === currentProfile?.id && (
                          <span className="text-xs text-slate-500">أنت</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      لا يوجد مستخدمون — أنشئ أول مستخدم من Supabase Auth أو اضغط «إضافة مستخدم».
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        لإنشاء مستخدمين من الواجهة، أضف{" "}
        <code className="rounded bg-slate-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
        في متغيرات الخادم. بدونه، أنشئ المستخدمين من لوحة Supabase → Authentication.
      </p>

      <Modal
        open={isModalOpen}
        title="إضافة مستخدم"
        description="يُنشأ حساب دخول جديد مع صلاحية محددة."
        onClose={() => {
          if (isSaving) return;
          setIsModalOpen(false);
          setFormError("");
        }}
      >
        <form onSubmit={(event) => void onCreateUser(event)} className="grid gap-4">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">الاسم (عربي) *</span>
            <input
              value={createForm.full_name_ar}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  full_name_ar: event.target.value,
                }))
              }
              required
              disabled={isSaving}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">البريد الإلكتروني *</span>
            <input
              type="email"
              value={createForm.email}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, email: event.target.value }))
              }
              required
              disabled={isSaving}
              className="rounded-md border border-slate-300 px-3 py-2"
              dir="ltr"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">كلمة المرور *</span>
            <input
              type="password"
              value={createForm.password}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, password: event.target.value }))
              }
              required
              minLength={6}
              disabled={isSaving}
              className="rounded-md border border-slate-300 px-3 py-2"
              dir="ltr"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">الصلاحية</span>
            <select
              value={createForm.role}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  role: event.target.value as AppRole,
                }))
              }
              disabled={isSaving}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>

          {formError && (
            <p className="rounded-md border border-[var(--danger)]/25 bg-[var(--danger)]/8 px-3 py-2 text-sm text-[var(--danger)]">
              {formError}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={isSaving} className="btn btn-primary">
              {isSaving ? "جاري الإنشاء..." : "إنشاء"}
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
              className="btn btn-outline"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
