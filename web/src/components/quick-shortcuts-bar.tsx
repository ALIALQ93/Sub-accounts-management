"use client";

import { useMemo, useState } from "react";
import { flattenNavCatalog } from "@/config/app-navigation";
import { NavTabLink } from "@/components/nav-tab-link";
import { useQuickShortcuts } from "@/hooks/use-quick-shortcuts";
import { useAuth } from "@/modules/auth/auth-context";
import type { PermissionKey } from "@/modules/settings/permissions/permission-catalog";

export function QuickShortcutsBar() {
  const { profile, authDisabled, hasPermission } = useAuth();
  const { shortcuts, isLoaded, addShortcut, removeShortcut, resetToDefaults } =
    useQuickShortcuts(profile?.id);
  const [isEditing, setIsEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const canAccess = (permission?: PermissionKey) =>
    authDisabled || !permission || hasPermission(permission);

  const catalog = useMemo(() => flattenNavCatalog(), []);

  const visibleShortcuts = useMemo(() => {
    return shortcuts.filter((shortcut) => {
      const catalogItem = catalog.find((item) => item.href === shortcut.href);
      if (!catalogItem?.permission) return true;
      return canAccess(catalogItem.permission);
    });
  }, [shortcuts, catalog, authDisabled, hasPermission]);

  const availableToAdd = useMemo(() => {
    const used = new Set(shortcuts.map((item) => item.href));
    return catalog.filter(
      (item) => canAccess(item.permission) && !used.has(item.href),
    );
  }, [catalog, shortcuts, authDisabled, hasPermission]);

  if (!isLoaded) return null;

  return (
    <div className="no-print border-b border-[var(--brand-border)] bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-xs font-semibold text-slate-500">
          اختصارات
        </span>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {visibleShortcuts.map((shortcut, index) => (
            <div key={shortcut.id} className="group relative flex items-center">
              <NavTabLink
                href={shortcut.href}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  index === 0
                    ? "bg-[var(--brand-navy)] text-white hover:bg-[var(--brand-navy-light)]"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {shortcut.label}
              </NavTabLink>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => removeShortcut(shortcut.id)}
                  className="mr-0.5 rounded px-1 text-xs text-rose-600 hover:bg-rose-50"
                  title="حذف الاختصار"
                  aria-label={`حذف ${shortcut.label}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {isEditing && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen((value) => !value)}
                disabled={availableToAdd.length === 0}
                className="rounded-md border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-800 disabled:opacity-40"
              >
                + إضافة
              </button>

              {pickerOpen && availableToAdd.length > 0 && (
                <div className="absolute top-full right-0 z-50 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {availableToAdd.map((item) => (
                    <button
                      key={`${item.group}-${item.href}`}
                      type="button"
                      onClick={() => {
                        addShortcut({
                          id: `custom-${Date.now()}-${item.href}`,
                          href: item.href,
                          label: item.label,
                        });
                        setPickerOpen(false);
                      }}
                      className="flex w-full flex-col px-3 py-2 text-right text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-800">
                        {item.label}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {item.group}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isEditing && (
            <button
              type="button"
              onClick={() => {
                resetToDefaults();
                setPickerOpen(false);
              }}
              className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              افتراضي
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsEditing((value) => !value);
              setPickerOpen(false);
            }}
            className={`rounded-md px-2 py-1 text-xs font-medium transition ${
              isEditing
                ? "bg-blue-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            title="تعديل الاختصارات"
          >
            {isEditing ? "تم" : "تعديل"}
          </button>
        </div>
      </div>
    </div>
  );
}
