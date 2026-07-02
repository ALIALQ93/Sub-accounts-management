"use client";

import { useAuth } from "@/modules/auth/auth-context";
import type { VoucherStatus } from "@/modules/vouchers/types";

export function useVoucherFormPermissions(
  mode: "create" | "edit",
  status: VoucherStatus,
) {
  const { hasPermission, authDisabled, isAdmin } = useAuth();
  const isPosted = status === "posted";
  const isCancelled = status === "cancelled";
  const canEditPosted = isAdmin && isPosted && !isCancelled;
  const isTerminal = isCancelled || (isPosted && !canEditPosted);

  if (authDisabled) {
    return {
      canSave: !isTerminal,
      canPost: !isTerminal,
      canDeleteLine: !isTerminal,
      formReadOnly: isTerminal,
      isTerminal,
      canEditPosted: isPosted,
    };
  }

  const canCreate = hasPermission("vouchers.create");
  const canEdit = hasPermission("vouchers.edit");
  const canPostPermission = hasPermission("vouchers.post");
  const canDelete = hasPermission("vouchers.delete");

  const canSave =
    mode === "create"
      ? canCreate
      : canEditPosted || (canEdit && !isPosted && !isCancelled);

  const formReadOnly = isCancelled || (isPosted && !canEditPosted) || !canSave;
  const canPost = canPostPermission && canEdit && !isPosted && !isCancelled;
  const canDeleteLine =
    canDelete && canEdit && (!isPosted || canEditPosted) && !isCancelled;

  return {
    canSave,
    canPost,
    canDeleteLine,
    formReadOnly,
    isTerminal,
    canEditPosted,
  };
}
