"use client";

import { useEffect, useMemo, useState } from "react";
import { branchApi, type BranchOption } from "@/modules/branches/services/branch-api";
import { CloseMovementJournalPreview } from "@/modules/vouchers/components/close-movement-journal-preview";
import { CloseMovementFiltersBar } from "@/modules/vouchers/components/close-movement-filters-bar";
import { OpenDimensionSummaries } from "@/modules/vouchers/components/open-dimension-summaries";
import { VoucherAllocations } from "@/modules/vouchers/components/voucher-allocations";
import { VoucherNettingPanel } from "@/modules/vouchers/components/voucher-netting-panel";
import { openMovementsApi } from "@/modules/vouchers/services/open-movements-api";
import type {
  Account,
  CostCenter,
  OpenMovement,
  OpenMovementFilters,
  OpenSide,
  VoucherAllocation,
  VoucherLine,
  VoucherNettingLine,
} from "@/modules/vouchers/types";
import { buildCloseMovementJournalPreview } from "@/modules/vouchers/utils/build-close-movement-journal-preview";
import {
  summarizeOpenByBranch,
  summarizeOpenByCostCenter,
} from "@/modules/vouchers/utils/open-movement-utils";

interface CloseMovementSectionsProps {
  partyType: "customer" | "vendor";
  partyId: string;
  defaultOpenSide: OpenSide;
  branchId: string;
  onBranchIdChange: (branchId: string) => void;
  costCenters: CostCenter[];
  accounts: Account[];
  voucherType: "receipt" | "payment";
  counterAccountId: string;
  voucherLines: VoucherLine[];
  allocations: VoucherAllocation[];
  onAllocationsChange: (allocations: VoucherAllocation[]) => void;
  nettingLines: VoucherNettingLine[];
  onNettingLinesChange: (lines: VoucherNettingLine[]) => void;
  openAmountByLineId?: Record<string, number>;
  readOnly: boolean;
  visible: boolean;
  onOpenMovementsChange?: (movements: OpenMovement[]) => void;
}

export function CloseMovementSections({
  partyType,
  partyId,
  defaultOpenSide,
  branchId,
  onBranchIdChange,
  costCenters,
  accounts,
  voucherType,
  counterAccountId,
  voucherLines,
  allocations,
  onAllocationsChange,
  nettingLines,
  onNettingLinesChange,
  openAmountByLineId,
  readOnly,
  visible,
  onOpenMovementsChange,
}: CloseMovementSectionsProps) {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [openMovements, setOpenMovements] = useState<OpenMovement[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [filters, setFilters] = useState<OpenMovementFilters>({
    openSide: defaultOpenSide,
  });

  useEffect(() => {
    let cancelled = false;
    void branchApi
      .listBranchOptions()
      .then((data) => {
        if (!cancelled) setBranches(data.filter((branch) => branch.is_active));
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (branchId && filters.branchId !== branchId) {
      setFilters((previous) => ({ ...previous, branchId }));
    }
  }, [branchId, filters.branchId]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    setIsLoadingMovements(true);
    setLoadError("");

    const requestFilters: OpenMovementFilters = {
      ...filters,
      partyType: partyId ? partyType : undefined,
      partyId: partyId || undefined,
    };

    void openMovementsApi
      .list(requestFilters)
      .then((data) => {
        if (!cancelled) setOpenMovements(data);
      })
      .catch((error) => {
        if (!cancelled) {
          setOpenMovements([]);
          setLoadError(
            error instanceof Error ? error.message : "فشل تحميل الحركات المفتوحة.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMovements(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, partyType, partyId, filters]);

  const handleFiltersChange = (next: OpenMovementFilters) => {
    setFilters(next);
    if (next.branchId !== branchId) {
      onBranchIdChange(next.branchId ?? "");
    }
  };

  const ccSummaries = useMemo(
    () => summarizeOpenByCostCenter(openMovements),
    [openMovements],
  );
  const branchSummaries = useMemo(
    () => summarizeOpenByBranch(openMovements),
    [openMovements],
  );

  useEffect(() => {
    onOpenMovementsChange?.(openMovements);
  }, [openMovements, onOpenMovementsChange]);

  const previewEntries = useMemo(
    () =>
      buildCloseMovementJournalPreview({
        voucherType,
        counterAccountId,
        voucherLines,
        allocations,
        nettingLines,
        accounts,
        costCenters,
        branches,
      }),
    [
      voucherType,
      counterAccountId,
      voucherLines,
      allocations,
      nettingLines,
      accounts,
      costCenters,
      branches,
    ],
  );

  if (!visible) return null;

  return (
    <div className="space-y-4">
      <CloseMovementFiltersBar
        filters={filters}
        branches={branches}
        costCenters={costCenters.filter((center) => center.is_active)}
        defaultOpenSide={defaultOpenSide}
        onChange={handleFiltersChange}
        disabled={readOnly}
      />

      {isLoadingMovements && (
        <p className="text-sm text-slate-600">جاري تحميل الحركات المفتوحة...</p>
      )}
      {!isLoadingMovements && loadError && (
        <p className="text-sm text-rose-700">{loadError}</p>
      )}
      {!isLoadingMovements && !loadError && (
        <p className="text-xs text-slate-600">
          {openMovements.length} حركة مفتوحة
          {partyId ? "" : " — اختر الطرف لتحديد النطاق"}
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <OpenDimensionSummaries title="صافٍ per مركز كلف" rows={ccSummaries} />
        <OpenDimensionSummaries title="صافٍ per فرع" rows={branchSummaries} />
      </div>

      <VoucherAllocations
        allocations={allocations}
        openMovements={openMovements}
        openAmountByLineId={openAmountByLineId}
        onChange={onAllocationsChange}
        readOnly={readOnly}
        visible
        showDimensions
      />

      <VoucherNettingPanel
        lines={nettingLines}
        costCenters={costCenters.filter((center) => center.is_active)}
        branches={branches}
        readOnly={readOnly}
        onChange={onNettingLinesChange}
      />

      <CloseMovementJournalPreview entries={previewEntries} />
    </div>
  );
}
