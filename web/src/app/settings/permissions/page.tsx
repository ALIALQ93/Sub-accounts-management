"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/modules/auth/auth-context";
import { SettingsNav } from "@/modules/settings/components/settings-nav";
import {
  ALL_PERMISSION_KEYS,
  PERMISSION_LABELS,
} from "@/modules/settings/permissions/permission-catalog";
import {
  countGrantedPermissions,
  resolveEffectivePermissions,
} from "@/modules/settings/permissions/permission-utils";
import { permissionsApi } from "@/modules/settings/services/permissions-api";
import { settingsApi } from "@/modules/settings/services/settings-api";
import type { UserProfile } from "@/modules/settings/types";
import { ROLE_LABELS } from "@/modules/settings/types";

export default function PermissionsHubPage() {
  const { isAdmin, hasPermission } = useAuth();
  const canManage = isAdmin || hasPermission("settings.permissions.manage");

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [permissionMap, setPermissionMap] = useState<Map<string, string[]>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const users = await settingsApi.listProfiles();
    const entries = await Promise.all(
      users.map(async (user) => {
        const keys = await permissionsApi.getUserPermissions(user.id);
        return [user.id, keys] as const;
      }),
    );
    setProfiles(users);
    setPermissionMap(new Map(entries));
  }, []);

  useEffect(() => {
    if (!canManage) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        await reload();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل البيانات.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [canManage, reload]);

  const rows = useMemo(
    () =>
      profiles.map((profile) => {
        const stored = permissionMap.get(profile.id) ?? [];
        const effective = resolveEffectivePermissions(
          profile.role,
          stored,
          profile.role === "admin",
        );
        return {
          profile,
          storedCount: countGrantedPermissions(stored),
          effectiveCount: effective.size,
        };
      }),
    [profiles, permissionMap],
  );

  if (!canManage) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6">
        <h1 className="text-2xl font-bold text-slate-900">الصلاحيات</h1>
        <SettingsNav />
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          لا تملك صلاحية إدارة الصلاحيات التفصيلية.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">الصلاحيات التفصيلية</h1>
        <p className="mt-1 text-sm text-slate-600">
          تحكم دقيق بصلاحيات كل مستخدم — عرض، إنشاء، تعديل، ترحيل، وإعدادات لكل
          قسم.
        </p>
      </div>

      <SettingsNav />

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">كيف يعمل النظام؟</p>
        <ul className="mt-2 list-disc space-y-1 pr-5 text-xs leading-6">
          <li>
            <strong>مدير النظام</strong> يملك كل الصلاحيات ({ALL_PERMISSION_KEYS.length}{" "}
            صلاحية).
          </li>
          <li>
            إذا لم تُحدَّد صلاحيات مخصّصة، يُستخدم <strong>قالب الدور</strong>{" "}
            (محاسب / عرض فقط).
          </li>
          <li>الصلاحيات المخصّصة تُخزَّن لكل مستخدم وت override القالب.</li>
        </ul>
      </section>

      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-3 md:p-4">
        {isLoading ? (
          <p className="text-sm text-slate-600">جاري التحميل...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-right text-slate-700">
                  <th className="border border-slate-200 p-2">المستخدم</th>
                  <th className="border border-slate-200 p-2">الدور</th>
                  <th className="border border-slate-200 p-2">صلاحيات مخصّصة</th>
                  <th className="border border-slate-200 p-2">الفعّالة</th>
                  <th className="border border-slate-200 p-2">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ profile, storedCount, effectiveCount }) => (
                  <tr key={profile.id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border border-slate-100 p-2">
                      <p className="font-medium">{profile.full_name_ar}</p>
                      <p className="text-xs text-slate-500" dir="ltr">
                        {profile.email}
                      </p>
                    </td>
                    <td className="border border-slate-100 p-2">
                      {ROLE_LABELS[profile.role]}
                    </td>
                    <td className="border border-slate-100 p-2">
                      {storedCount > 0 ? `${storedCount} محددة` : "قالب الدور"}
                    </td>
                    <td className="border border-slate-100 p-2">
                      {effectiveCount} / {ALL_PERMISSION_KEYS.length}
                    </td>
                    <td className="border border-slate-100 p-2">
                      <Link
                        href={`/settings/users/${profile.id}/permissions`}
                        className="rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                      >
                        تعديل الصلاحيات
                      </Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="border border-slate-100 p-6 text-center text-slate-500"
                    >
                      لا يوجد مستخدمون.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">فهرس الصلاحيات</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {ALL_PERMISSION_KEYS.map((key) => (
            <div
              key={key}
              className="rounded-md border border-slate-100 px-3 py-2 text-xs"
            >
              <span className="font-medium text-slate-800">
                {PERMISSION_LABELS[key]}
              </span>
              <span className="mt-0.5 block font-mono text-[10px] text-slate-400" dir="ltr">
                {key}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
