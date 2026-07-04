import type { PostVoucherResponse } from "@/modules/vouchers/types";

interface ApproveWithAutoPostParams {
  autoPostEnabled: boolean;
  canPost: boolean;
  canPostPermission: boolean;
  saveApproved: () => Promise<string | null>;
  postVoucher: (id: string) => Promise<PostVoucherResponse>;
  showError: (message: string) => void;
  postBlockedMessage: string;
}

export interface ApproveWithAutoPostResult {
  activeId: string;
  posted: boolean;
  journalEntryId?: string;
  journalEntryNo?: string;
}

export async function approveWithOptionalAutoPost(
  params: ApproveWithAutoPostParams,
): Promise<ApproveWithAutoPostResult | null> {
  const shouldAutoPost =
    params.autoPostEnabled && params.canPostPermission;

  if (shouldAutoPost && !params.canPost) {
    params.showError(params.postBlockedMessage);
    return null;
  }

  const activeId = await params.saveApproved();
  if (!activeId) return null;

  if (!shouldAutoPost) {
    return { activeId, posted: false };
  }

  const response = await params.postVoucher(activeId);
  return {
    activeId,
    posted: true,
    journalEntryId: response.journal_entry_id,
    journalEntryNo: response.journal_entry_no,
  };
}

export function getApproveButtonLabel(autoPostEnabled: boolean): string {
  return autoPostEnabled ? "اعتماد وترحيل" : "اعتماد";
}
