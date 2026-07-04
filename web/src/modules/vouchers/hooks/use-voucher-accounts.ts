"use client";

import { useCallback, useEffect, useState } from "react";
import { ACCOUNTS_CHANGED_EVENT } from "@/lib/reference-data-events";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account } from "@/modules/vouchers/types";

export function useVoucherAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

  const reloadAccounts = useCallback(async () => {
    const data = await voucherApi.listAccounts();
    setAccounts(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await voucherApi.listAccounts();
        if (!cancelled) setAccounts(data);
      } finally {
        if (!cancelled) setIsLoadingAccounts(false);
      }
    };

    void load();

    const refresh = () => {
      void reloadAccounts();
    };

    window.addEventListener(ACCOUNTS_CHANGED_EVENT, refresh);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener(ACCOUNTS_CHANGED_EVENT, refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reloadAccounts]);

  return { accounts, reloadAccounts, isLoadingAccounts };
}
