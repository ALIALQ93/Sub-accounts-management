"use client";

import { useAuth } from "@/modules/auth/auth-context";
import type { VoucherStatus } from "@/modules/vouchers/types";

export function useVoucherFormPermissions(
  mode: "create" | "edit",
  status: VoucherStatus,
) {
  const { hasPermission, authDisabled } = useAuth();
  const isTerminal = status === "posted" || status === "cancelled";

  if (authDisabled) {
    return {
      canSave: !isTerminal,
      canPost: !isTerminal,
      canDeleteLine: !isTerminal,
      formReadOnly: isTerminal,
      isTerminal,
    };
  }

  const canCreate = hasPermission("vouchers.create");
  const canEdit = hasPermission("vouchers.edit");
  const canPostPermission = hasPermission("vouchers.post");
  const canDelete = hasPermission("vouchers.delete");

  const canSave = mode === "create" ? canCreate : canEdit;
  const formReadOnly = isTerminal || !canSave;
  const canPost = canPostPermission && canEdit && !isTerminal;
  const canDeleteLine = canDelete && canEdit && !isTerminal;

  return {
    canSave,
    canPost,
    canDeleteLine,
    formReadOnly,
    isTerminal,
  };
}
