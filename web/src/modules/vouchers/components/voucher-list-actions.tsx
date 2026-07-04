"use client";

import Link from "next/link";
import { useState } from "react";
import { OpenInNewTabLink } from "@/components/open-in-new-tab-link";
import { useAuth } from "@/modules/auth/auth-context";
import {
  canEditVoucherFromList,
} from "@/modules/vouchers/components/voucher-view-mode-bar";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { VoucherListItem } from "@/modules/vouchers/types";

interface VoucherListActionsProps {
  item: VoucherListItem;
  onUpdated?: () => void | Promise<void>;
}

export function VoucherListActions({ item, onUpdated }: VoucherListActionsProps) {
  const { hasPermission, isAdmin, authDisabled } = useAuth();
  const [busyAction, setBusyAction] = useState<"approve" | "post" | null>(null);
  const [actionError, setActionError] = useState("");

  const canView = authDisabled || hasPermission("vouchers.view");
  const canEdit = authDisabled || hasPermission("vouchers.edit");
  const canPostPermission = authDisabled || hasPermission("vouchers.post");
  const showEdit = canEditVoucherFromList(item.status, isAdmin, canEdit);
  const canApprove = canEdit && item.status === "draft";
  const canPost =
    canPostPermission &&
    canEdit &&
    item.status === "approved";

  const editHref = `/vouchers/${item.id}`;
  const viewHref = `${editHref}?mode=view`;

  const linkClass =
    "rounded-md border px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50";

  const runAction = async (
    action: "approve" | "post",
    handler: () => Promise<void>,
  ) => {
    setActionError("");
    setBusyAction(action);
    try {
      await handler();
      await onUpdated?.();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "تعذّر تنفيذ الإجراء.",
      );
    } finally {
      setBusyAction(null);
    }
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
        <OpenInNewTabLink
          href={showEdit ? editHref : viewHref}
          className={`${linkClass} border-slate-300 text-slate-700`}
          title="فتح في تبويب جديد"
        >
          ↗
        </OpenInNewTabLink>
      </div>
      {actionError && (
        <p className="text-[10px] leading-snug text-rose-700">{actionError}</p>
      )}
    </div>
  );
}
