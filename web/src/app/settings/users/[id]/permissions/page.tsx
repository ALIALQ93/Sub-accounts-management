"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/modules/auth/auth-context";
import { SettingsNav } from "@/modules/settings/components/settings-nav";
import { UserPermissionsEditor } from "@/modules/settings/components/user-permissions-editor";
import {
  ALL_PERMISSION_KEYS,
  ROLE_PERMISSION_DEFAULTS,
} from "@/modules/settings/permissions/permission-catalog";
import { permissionsApi } from "@/modules/settings/services/permissions-api";
import { settingsApi } from "@/modules/settings/services/settings-api";
import type { AppRole, UserProfile } from "@/modules/settings/types";
import { ROLE_LABELS } from "@/modules/settings/types";

export default function UserPermissionsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = params.id;
  const { isAdmin, hasPermission, refreshProfile, profile: currentProfile } =
    useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canManage = isAdmin || hasPermission("settings.permissions.manage");

  const load = useCallback(async () => {
    const [profiles, keys] = await Promise.all([
      settingsApi.listProfiles(),
      permissionsApi.getUserPermissions(userId),
    ]);
    const target = profiles.find((item) => item.id === userId) ?? null;
    setProfile(target);

    if (keys.length > 0) {
      setSelectedKeys(new Set(keys));
    } else if (target) {
      setSelectedKeys(new Set(ROLE_PERMISSION_DEFAULTS[target.role]));
    } else {
      setSelectedKeys(new Set());
    }

    return target;
  }, [userId]);

  useEffect(() => {
    if (!canManage) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل الصلاحيات.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [canManage, load]);

  const onSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      await permissionsApi.setUserPermissions(profile.id, [...selectedKeys]);
      if (currentProfile?.id === profile.id) {
        await refreshProfile();
      }
      setSuccess("تم حفظ الصلاحيات.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حفظ الصلاحيات.");
    } finally {
      setIsSaving(false);
    }
  };

  const onApplyRoleTemplate = (role: AppRole) => {
    setSelectedKeys(new Set(ROLE_PERMISSION_DEFAULTS[role]));
  };

  const editorProps = useMemo(
    () => ({
      userName: profile?.full_name_ar ?? "—",
      userRole: profile?.role ?? "accountant",
      selectedKeys,
      isSaving,
      onToggle: (key: string, checked: boolean) => {
        setSelectedKeys((current) => {
          const next = new Set(current);
          if (checked) next.add(key);
          else next.delete(key);
          return next;
        });
      },
      onToggleModule: (moduleKeys: string[], checked: boolean) => {
        setSelectedKeys((current) => {
          const next = new Set(current);
          for (const key of moduleKeys) {
            if (checked) next.add(key);
            else next.delete(key);
          }
          return next;
        });
      },
      onSelectAll: () => setSelectedKeys(new Set(ALL_PERMISSION_KEYS)),
      onClearAll: () => setSelectedKeys(new Set()),
      onApplyRoleTemplate,
    }),
    [profile, selectedKeys, isSaving],
  );

  if (!canManage) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6">
        <h1 className="text-2xl font-bold text-slate-900">صلاحيات المستخدم</h1>
        <SettingsNav />
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          لا تملك صلاحية إدارة الصلاحيات التفصيلية.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/settings/permissions"
            className="text-xs font-medium text-blue-900 hover:underline"
          >
            ← العودة إلى الصلاحيات
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            صلاحيات المستخدم
          </h1>
          {profile && (
            <p className="mt-1 text-sm text-slate-600">
              {profile.full_name_ar} · {profile.email} ·{" "}
              {ROLE_LABELS[profile.role]}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={isSaving || !profile}
            className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSaving ? "جاري الحفظ..." : "حفظ الصلاحيات"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/settings/permissions")}
            disabled={isSaving}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
          >
            إلغاء
          </button>
        </div>
      </section>

      <SettingsNav />

      {isLoading && (
        <p className="text-sm text-slate-600">جاري تحميل الصلاحيات...</p>
      )}

      {!isLoading && !profile && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          المستخدم غير موجود.
        </p>
      )}

      {!isLoading && profile && (
        <>
          {profile.role === "admin" && (
            <p className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
              مدير النظام يملك جميع الصلاحيات تلقائياً — التعديلات هنا للتوثيق
              فقط ولن تقيّد الوصول.
            </p>
          )}

          <UserPermissionsEditor {...editorProps} />

          {error && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </p>
          )}
        </>
      )}
    </main>
  );
}
