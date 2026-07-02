"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { VoucherStatus } from "@/modules/vouchers/types";
import {
  getDraftSaveRedirectMessage,
  stashVoucherSaveFeedback,
  consumeVoucherSaveFeedback,
} from "@/modules/vouchers/utils/voucher-save-utils";

interface UseVoucherSaveFlowOptions {
  initialMode: "create" | "edit";
  voucherId: string;
  showSuccess: (message: string) => void;
}

export function useVoucherSaveFlow({
  initialMode,
  voucherId,
  showSuccess,
}: UseVoucherSaveFlowOptions) {
  const router = useRouter();
  const saveInFlightRef = useRef(false);
  const voucherIdRef = useRef(voucherId);

  useEffect(() => {
    voucherIdRef.current = voucherId;
  }, [voucherId]);

  useEffect(() => {
    const message = consumeVoucherSaveFeedback();
    if (message) showSuccess(message);
  }, [showSuccess]);

  const beginSave = (): boolean => {
    if (saveInFlightRef.current) return false;
    saveInFlightRef.current = true;
    return true;
  };

  const endSave = () => {
    saveInFlightRef.current = false;
  };

  const resolveVoucherIdForSave = (): string => voucherIdRef.current;

  const updateSavedVoucherId = (id: string) => {
    voucherIdRef.current = id;
  };

  const redirectAfterDraftSave = (
    activeId: string,
    feedback: string,
    targetStatus: VoucherStatus,
  ): boolean => {
    if (initialMode !== "create" || targetStatus !== "draft") return false;
    stashVoucherSaveFeedback(getDraftSaveRedirectMessage(feedback));
    router.replace(`/vouchers/${activeId}`);
    return true;
  };

  return {
    beginSave,
    endSave,
    resolveVoucherIdForSave,
    updateSavedVoucherId,
    redirectAfterDraftSave,
  };
}
