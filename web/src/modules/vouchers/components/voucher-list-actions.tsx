"use client";

import Link from "next/link";
import { useState } from "react";
import { OpenInNewTabLink } from "@/components/open-in-new-tab-link";
import { useNotifications } from "@/components/notifications";
import { useAuth } from "@/modules/auth/auth-context";
import {
  canEditVoucherFromList,
} from "@/modules/vouchers/components/voucher-view-mode-bar";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import { formatVoucherError } from "@/modules/vouchers/utils/voucher-feedback-utils";
import type { VoucherListItem } from "@/modules/vouchers/types";
import { getVoucherTypeLabel } from "@/modules/vouchers/utils/voucher-type-config";

interface VoucherListActionsProps {
  item: VoucherListItem;
  onUpdated?: () => void | Promise<void>;
}

export function VoucherListActions({ item, onUpdated }: VoucherListActionsProps) {
  const { hasPermission, isAdmin, authDisabled } = useAuth();
  const { notifyError } = useNotifications();
  const [busyAction, setBusyAction] = useState<"approve" | "post" | "delete" | null>(
    null,
  );

  const canView = authDisabled || hasPermission("vouchers.view");
  const canEdit = authDisabled || hasPermission("vouchers.edit");
  const canDelete = authDisabled || hasPermission("vouchers.delete");
  const canPostPermission = authDisabled || hasPermission("vouchers.post");
  const showEdit = canEditVoucherFromList(item.status, isAdmin, canEdit);
  const canApprove = canEdit && item.status === "draft";
  const canPost =
    canPostPermission &&
    canEdit &&
    item.status === "approved";
  const canDeleteVoucher = canDelete && item.status !== "cancelled";

  const editHref = `/vouchers/${item.id}`;
  const viewHref = `${editHref}?mode=view`;

  const linkClass =
    "rounded-md border px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50";

  const runAction = async (
    action: "approve" | "post" | "delete",
    handler: () => Promise<void>,
  ) => {
    setBusyAction(action);
    try {
      await handler();
      await onUpdated?.();
    } catch (error) {
      notifyError(formatVoucherError(error));
    } finally {
      setBusyAction(null);
    }
  };

  const confirmDelete = (): boolean => {
    const typeLabel = getVoucherTypeLabel(item.voucher_type);
    const journalNote =
      item.status === "posted"
        ? "\nسيتم حذف القيد المحاسبي المرتبط به أيضاً."
        : "";
    return window.confirm(
      `حذف السند ${item.voucher_no} (${typeLabel})؟${journalNote}\n\nلا يمكن التراجع عن هذا الإجراء.`,
    );
  };

  if (!canView) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-1">
        {showEdit && (
          <Link
            href={editHref}
            className={`${linkClass} border-blue-300 text-blue-800`}
            title="تعديل السند"
          >
            تعديل
          </Link>
        )}
        <Link
          href={viewHref}
          className={`${linkClass} border-slate-300 text-slate-700`}
          title="عرض السند للقراءة فقط"
        >
          عرض
        </Link>
        {canApprove && (
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() =>
              void runAction("approve", () => voucherApi.approveVoucher(item.id))
            }
            className={`${linkClass} border-amber-300 text-amber-800`}
            title="اعتماد السند"
          >
            {busyAction === "approve" ? "…" : "اعتماد"}
          </button>
        )}
        {canPost && (
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() =>
              void runAction("post", () =>
                voucherApi.postVoucher(item.id).then(() => undefined),
              )
            }
            className={`${linkClass} border-emerald-600 bg-emerald-700 text-white hover:bg-emerald-800`}
            title="ترحيل السند إلى قيد يومية"
          >
            {busyAction === "post" ? "…" : "ترحيل"}
          </button>
        )}
        {canDeleteVoucher && (
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => {
              if (!confirmDelete()) return;
              void runAction("delete", () => voucherApi.deleteVoucher(item.id));
            }}
            className={`${linkClass} border-rose-300 text-rose-800 hover:bg-rose-50`}
            title={
              item.status === "posted"
                ? "حذف السند والقيد المرتبط"
                : "حذف السند"
            }
          >
            {busyAction === "delete" ? "…" : "حذف"}
          </button>
        )}
        <OpenInNewTabLink
          href={showEdit ? editHref : viewHref}
          className={`${linkClass} border-slate-300 text-slate-700`}
          title="فتح في تبويب جديد"
        >
          ↗
        </OpenInNewTabLink>
      </div>
    </div>
  );
}
