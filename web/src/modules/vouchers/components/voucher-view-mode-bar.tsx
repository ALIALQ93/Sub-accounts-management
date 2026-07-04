"use client";

import Link from "next/link";
import { useAuth } from "@/modules/auth/auth-context";
import type { VoucherStatus } from "@/modules/vouchers/types";

function canOpenVoucherEditor(
  status: VoucherStatus,
  isAdmin: boolean,
  canEdit: boolean,
): boolean {
  if (!canEdit) return false;
  if (status === "cancelled") return false;
  if (status === "posted") return isAdmin;
  return true;
}

interface VoucherViewModeBarProps {
  forceViewMode: boolean;
  voucherId: string;
  status: VoucherStatus;
}

export function VoucherViewModeBar({
  forceViewMode,
  voucherId,
  status,
}: VoucherViewModeBarProps) {
  const { hasPermission, isAdmin, authDisabled } = useAuth();
  const canEdit = authDisabled || hasPermission("vouchers.edit");
  const showEdit = canOpenVoucherEditor(status, isAdmin, canEdit);

  if (!forceViewMode) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <span>وضع العرض — القراءة فقط.</span>
      {showEdit && (
        <Link
          href={`/vouchers/${voucherId}`}
          className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-50"
        >
          تعديل
        </Link>
      )}
    </div>
  );
}

export function canEditVoucherFromList(
  status: VoucherStatus,
  isAdmin: boolean,
  canEdit: boolean,
): boolean {
  return canOpenVoucherEditor(status, isAdmin, canEdit);
}
