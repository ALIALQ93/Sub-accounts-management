"use client";

import Link from "next/link";
import { OpenInNewTabLink } from "@/components/open-in-new-tab-link";
import { useAuth } from "@/modules/auth/auth-context";
import type { VoucherListItem } from "@/modules/vouchers/types";

function canEditVoucher(
  item: VoucherListItem,
  isAdmin: boolean,
  canEdit: boolean,
): boolean {
  if (!canEdit) return false;
  if (item.status === "cancelled") return false;
  if (item.status === "posted") return isAdmin;
  return item.status === "draft" || item.status === "approved";
}

interface VoucherListActionsProps {
  item: VoucherListItem;
}

export function VoucherListActions({ item }: VoucherListActionsProps) {
  const { hasPermission, isAdmin, authDisabled } = useAuth();
  const canView = authDisabled || hasPermission("vouchers.view");
  const canEdit = authDisabled || hasPermission("vouchers.edit");
  const showEdit = canEditVoucher(item, isAdmin, canEdit);

  const editHref = `/vouchers/${item.id}`;
  const viewHref = `${editHref}?mode=view`;

  const linkClass =
    "rounded-md border px-2 py-1 text-xs font-medium hover:bg-slate-50";

  if (!canView) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Link
        href={viewHref}
        className={`${linkClass} border-slate-300 text-slate-700`}
        title="عرض السند للقراءة فقط"
      >
        عرض
      </Link>
      {showEdit && (
        <Link
          href={editHref}
          className={`${linkClass} border-blue-300 text-blue-800`}
          title="تعديل السند"
        >
          تعديل
        </Link>
      )}
      <OpenInNewTabLink
        href={showEdit ? editHref : viewHref}
        className={`${linkClass} border-slate-300 text-slate-700`}
        title="فتح في تبويب جديد"
      >
        ↗
      </OpenInNewTabLink>
    </div>
  );
}
