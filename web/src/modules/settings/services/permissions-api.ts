"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { AppRole } from "@/modules/settings/types";
import {
  ALL_PERMISSION_KEYS,
  ROLE_PERMISSION_DEFAULTS,
  type PermissionKey,
} from "@/modules/settings/permissions/permission-catalog";

function throwIfError(error: { message?: string } | null): void {
  if (error) {
    throw new Error(error.message || "حدث خطأ غير متوقع.");
  }
}

function sanitizePermissionKeys(keys: string[]): PermissionKey[] {
  const allowed = new Set<string>(ALL_PERMISSION_KEYS);
  return [...new Set(keys.filter((key) => allowed.has(key)))] as PermissionKey[];
}

export const permissionsApi = {
  async getCurrentUserPermissions(): Promise<string[]> {
    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    return permissionsApi.getUserPermissions(user.id);
  },

  async getUserPermissions(userId: string): Promise<string[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("user_permissions")
      .select("permission_key")
      .eq("user_id", userId)
      .order("permission_key");
    throwIfError(error);
    return (data ?? []).map(
      (row) => (row as { permission_key: string }).permission_key,
    );
  },

  async setUserPermissions(
    userId: string,
    keys: string[],
  ): Promise<string[]> {
    const supabase = getSupabaseClient();
    const sanitized = sanitizePermissionKeys(keys);

    const { error: deleteError } = await supabase
      .from("user_permissions")
      .delete()
      .eq("user_id", userId);
    throwIfError(deleteError);

    if (sanitized.length === 0) {
      return [];
    }

    const { error: insertError } = await supabase.from("user_permissions").insert(
      sanitized.map((permission_key) => ({
        user_id: userId,
        permission_key,
      })),
    );
    throwIfError(insertError);

    return sanitized;
  },

  async applyRoleTemplate(userId: string, role: AppRole): Promise<string[]> {
    return permissionsApi.setUserPermissions(
      userId,
      ROLE_PERMISSION_DEFAULTS[role],
    );
  },

  async listAllUserPermissionCounts(): Promise<
    Array<{ user_id: string; count: number }>
  > {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("user_permissions")
      .select("user_id");
    throwIfError(error);

    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const userId = (row as { user_id: string }).user_id;
      counts.set(userId, (counts.get(userId) ?? 0) + 1);
    }

    return [...counts.entries()].map(([user_id, count]) => ({
      user_id,
      count,
    }));
  },
};
