"use client";

import { useMemo, useState } from "react";
import type { AppRole } from "@/modules/settings/types";
import { ROLE_LABELS } from "@/modules/settings/types";
import {
  ALL_PERMISSION_KEYS,
  PERMISSION_MODULES,
} from "@/modules/settings/permissions/permission-catalog";

interface UserPermissionsEditorProps {
  userName: string;
  userRole: AppRole;
  selectedKeys: Set<string>;
  isSaving: boolean;
  onToggle: (key: string, checked: boolean) => void;
  onToggleModule: (moduleKeys: string[], checked: boolean) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onApplyRoleTemplate: (role: AppRole) => void;
}

export function UserPermissionsEditor({
  userName,
  userRole,
  selectedKeys,
  isSaving,
  onToggle,
  onToggleModule,
  onSelectAll,
  onClearAll,
  onApplyRoleTemplate,
}: UserPermissionsEditorProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    () => new Set(PERMISSION_MODULES.map((module) => module.id)),
  );

  const grantedCount = selectedKeys.size;
  const totalCount = ALL_PERMISSION_KEYS.length;

  const toggleModuleExpanded = (moduleId: string) => {
    setExpandedModules((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const moduleStats = useMemo(
    () =>
      PERMISSION_MODULES.map((module) => {
        const keys = module.permissions.map((permission) => permission.key);
        const granted = keys.filter((key) => selectedKeys.has(key)).length;
        return { module, keys, granted, total: keys.length };
      }),
    [selectedKeys],
  );

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p>
          <span className="font-semibold text-slate-900">{userName}</span>
          {" — "}
          الدور الأساسي: {ROLE_LABELS[userRole]}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          مفعّل: {grantedCount} / {totalCount} صلاحية
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
          <button
            key={role}
            type="button"
            disabled={isSaving}
            onClick={() => onApplyRoleTemplate(role)}
            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-900 disabled:opacity-50"
          >
            تطبيق قالب {ROLE_LABELS[role]}
          </button>
        ))}
        <button
          type="button"
          disabled={isSaving}
          onClick={onSelectAll}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
        >
          تحديد الكل
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={onClearAll}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
        >
          إلغاء الكل
        </button>
      </div>

      <div className="grid gap-3">
        {moduleStats.map(({ module, keys, granted, total }) => {
          const expanded = expandedModules.has(module.id);
          const allChecked = granted === total;
          const someChecked = granted > 0 && granted < total;

          return (
            <section
              key={module.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(input) => {
                      if (input) input.indeterminate = someChecked;
                    }}
                    disabled={isSaving}
                    onChange={(event) =>
                      onToggleModule(keys, event.target.checked)
                    }
                    className="h-4 w-4"
                  />
                  <button
                    type="button"
                    onClick={() => toggleModuleExpanded(module.id)}
                    className="text-sm font-semibold text-slate-900"
                  >
                    {module.label}
                    <span className="mr-2 text-xs font-normal text-slate-500">
                      ({granted}/{total})
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => toggleModuleExpanded(module.id)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  {expanded ? "طي ▲" : "فتح ▼"}
                </button>
              </div>

              {expanded && (
                <div className="grid gap-2 p-4 md:grid-cols-2">
                  {module.permissions.map((permission) => (
                    <label
                      key={permission.key}
                      className="flex items-start gap-2 rounded-md border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(permission.key)}
                        disabled={isSaving}
                        onChange={(event) =>
                          onToggle(permission.key, event.target.checked)
                        }
                        className="mt-0.5 h-4 w-4"
                      />
                      <span>
                        <span className="font-medium text-slate-800">
                          {permission.label}
                        </span>
                        <span
                          className="mt-0.5 block font-mono text-[10px] text-slate-400"
                          dir="ltr"
                        >
                          {permission.key}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
