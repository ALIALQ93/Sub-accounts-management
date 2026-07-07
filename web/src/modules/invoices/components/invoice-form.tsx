"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/components/notifications";
import { useAuth } from "@/modules/auth/auth-context";
import { costCenterApi } from "@/modules/cost-centers/services/cost-center-api";
import { currencyApi } from "@/modules/currencies/services/currency-api";
import type { Currency } from "@/modules/currencies/types";
import {
  InvoiceAccountLinesTable,
  type DraftAccountLine,
} from "@/modules/invoices/components/invoice-account-lines-table";
import {
  InvoiceMaterialLinesTable,
  type DraftMaterialLine,
} from "@/modules/invoices/components/invoice-material-lines-table";
import { InvoiceStatusChip } from "@/modules/invoices/components/invoice-status-chip";
import { invoiceApi } from "@/modules/invoices/services/invoice-api";
import { invoiceReferenceLinksApi } from "@/modules/invoices/services/invoice-reference-links-api";
import {
  referenceInvoiceApi,
  type LoadedReferenceData,
  type ReferenceInvoiceOption,
} from "@/modules/invoices/services/reference-invoice-api";
import { ReferenceLinesPicker } from "@/modules/invoices/components/reference-lines-picker";
import { InvoiceOpenMovementsPanel } from "@/modules/invoices/components/invoice-open-movements-panel";
import { InvoiceInventoryMovementsPanel } from "@/modules/invoices/components/invoice-inventory-movements-panel";
import {
  invoicePatternApi,
  DEFAULT_PATTERN_CONDITIONS,
  type BranchOption,
  type WarehouseOption,
} from "@/modules/invoices/services/invoice-pattern-api";
import { materialApi } from "@/modules/invoices/services/material-api";
import { salesRepApi } from "@/modules/invoices/services/sales-rep-api";
import { transferApi } from "@/modules/invoices/services/transfer-api";
import type {
  InvoicePattern,
  InvoicePatternConditions,
  InvoiceMaterialLine,
  InvoiceHeader,
  InvoiceSettlementMode,
  MaterialOption,
  MaterialUnitOption,
  SalesRepOption,
} from "@/modules/invoices/types";
import { partyKindForCommercial, defaultUnitPrice, computeLineNetAmount, computeLineDiscountAmount } from "@/modules/invoices/utils/invoice-line-utils";
import {
  applyRounding,
  roundingDelta,
  type RoundingSettings,
} from "@/modules/invoices/utils/rounding-utils";
import {
  filterMaterialsForPattern,
  isMaterialAllowedForPattern,
} from "@/modules/invoices/utils/material-filter";
import {
  headerFieldRequired,
  lineAttributeFlags,
  salesRepFieldRequired,
  validateInvoice,
} from "@/modules/invoices/utils/validate-invoice";
import { getCommercialKindLabel } from "@/modules/invoices/utils/invoice-kind-config";
import {
  parseReferenceSettings,
  referenceSettingsActive,
} from "@/modules/invoices/utils/reference-settings";
import {
  buildReferenceLineCaps,
  mergeReferenceLineCaps,
  validateReferenceQuantities,
} from "@/modules/invoices/utils/reference-line-caps";
import { validateReferenceMatch } from "@/modules/invoices/utils/validate-reference-match";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import { CustomerSearchField } from "@/modules/vouchers/components/customer-search-field";
import { VendorSearchField } from "@/modules/vouchers/components/vendor-search-field";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account, CostCenter, Customer, Vendor } from "@/modules/vouchers/types";

const inputClass =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100";

interface InvoiceFormProps {
  mode: "create" | "edit";
  patternId?: string;
  invoiceId?: string;
  transferId?: string;
  transferRole?: "out" | "in";
}

function toDraftMaterialLines(
  lines: Array<{
    id: string;
    line_no: number;
    branch_id: string;
    cost_center_id: string | null;
    warehouse_id: string;
    material_id: string;
    material_unit_id: string;
    quantity: number;
    unit_price: number;
    line_description: string | null;
    qty_received?: number | null;
    color?: string | null;
    size?: string | null;
    source?: string | null;
    caliber?: string | null;
    discount_percent?: number | null;
    discount_amount?: number | null;
  }>,
): DraftMaterialLine[] {
  return lines.map((line) => ({
    clientId: line.id,
    id: line.id,
    line_no: line.line_no,
    branch_id: line.branch_id,
    cost_center_id: line.cost_center_id,
    warehouse_id: line.warehouse_id,
    material_id: line.material_id,
    material_unit_id: line.material_unit_id,
    quantity: line.quantity,
    unit_price: line.unit_price,
    line_description: line.line_description,
    qty_received: line.qty_received ?? null,
    color: line.color ?? null,
    size: line.size ?? null,
    source: line.source ?? null,
    caliber: line.caliber ?? null,
    discount_percent: line.discount_percent ?? null,
    discount_amount: line.discount_amount ?? null,
  }));
}

function toDraftAccountLines(
  lines: Array<{
    id: string;
    line_no: number;
    branch_id: string;
    cost_center_id: string | null;
    account_id: string;
    side: "debit" | "credit";
    amount: number;
    description: string | null;
  }>,
): DraftAccountLine[] {
  return lines.map((line) => ({
    clientId: line.id,
    id: line.id,
    line_no: line.line_no,
    branch_id: line.branch_id,
    cost_center_id: line.cost_center_id,
    account_id: line.account_id,
    side: line.side,
    amount: line.amount,
    description: line.description,
  }));
}

export function InvoiceForm({
  mode,
  patternId,
  invoiceId,
  transferId,
  transferRole,
}: InvoiceFormProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { notifySuccess, notifyError } = useNotifications();
  const canEdit = hasPermission("invoices.edit");

  const [pattern, setPattern] = useState<InvoicePattern | null>(null);
  const [patternConditions, setPatternConditions] =
    useState<InvoicePatternConditions | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [status, setStatus] = useState<"draft" | "posted" | "cancelled">("draft");
  const [journalEntryId, setJournalEntryId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState(invoiceId ?? "");

  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [branchId, setBranchId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [salesRepId, setSalesRepId] = useState("");
  const [referenceInvoiceId, setReferenceInvoiceId] = useState("");
  const [additionalReferenceIds, setAdditionalReferenceIds] = useState<string[]>([]);
  const [secondaryReferencePick, setSecondaryReferencePick] = useState("");
  const [referenceDetailHeader, setReferenceDetailHeader] = useState<InvoiceHeader | null>(null);
  const [referenceCandidates, setReferenceCandidates] = useState<
    ReferenceInvoiceOption[]
  >([]);
  const [referenceLineCaps, setReferenceLineCaps] = useState<Record<
    string,
    number
  > | null>(null);
  const [referencePickerLines, setReferencePickerLines] = useState<
    InvoiceMaterialLine[]
  >([]);
  const [referencePickerOpen, setReferencePickerOpen] = useState(false);
  const [referenceClosedAt, setReferenceClosedAt] = useState<string | null>(null);
  const [isClosingReference, setIsClosingReference] = useState(false);
  const [settlementMode, setSettlementMode] =
    useState<InvoiceSettlementMode>("credit");
  const [paymentTermsDays, setPaymentTermsDays] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [currencyId, setCurrencyId] = useState("");
  const [exchangeRate, setExchangeRate] = useState<number | null>(1);
  const [receiptNo, setReceiptNo] = useState("");
  const [invoiceDiscountPercent, setInvoiceDiscountPercent] = useState<number | null>(
    null,
  );
  const [description, setDescription] = useState("");
  const [creditorAccountId, setCreditorAccountId] = useState("");
  const [debtorAccountId, setDebtorAccountId] = useState("");
  const [costAccountId, setCostAccountId] = useState("");
  const [inventoryAccountId, setInventoryAccountId] = useState("");
  const [discountAccountId, setDiscountAccountId] = useState("");
  const [extraAccountId, setExtraAccountId] = useState("");

  const [inventoryTransferId, setInventoryTransferId] = useState(transferId ?? "");
  const [invoiceTransferRole, setInvoiceTransferRole] = useState<"out" | "in" | "">(
    transferRole ?? "",
  );
  const [allowedMaterialIds, setAllowedMaterialIds] = useState<string[]>([]);
  const [allowedCategoryIds, setAllowedCategoryIds] = useState<string[]>([]);
  const [materialLines, setMaterialLines] = useState<DraftMaterialLine[]>([]);
  const [accountLines, setAccountLines] = useState<DraftAccountLine[]>([]);
  const [unitsByMaterial, setUnitsByMaterial] = useState<
    Record<string, MaterialUnitOption[]>
  >({});

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRepOption[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingReference, setIsLoadingReference] = useState(false);
  const [error, setError] = useState("");

  const readOnly = status !== "draft" || !canEdit;

  const referenceSettings = useMemo(
    () => (pattern ? parseReferenceSettings(pattern.reference_settings) : null),
    [pattern],
  );

  const referenceLocked =
    !!referenceSettings?.lock_reference && !!referenceInvoiceId;
  const partyKind = pattern ? partyKindForCommercial(pattern.commercial_kind) : "none";

  const showReference = pattern
    ? referenceSettingsActive(
        parseReferenceSettings(pattern.reference_settings),
        pattern.is_return,
      )
    : false;

  const lineAttrFlags = useMemo(
    () => lineAttributeFlags(patternConditions),
    [patternConditions],
  );

  const showLineDiscount =
    !!pattern?.discount_enabled && pattern.discount_applies_to === "line";

  const showInvoiceDiscount =
    !!pattern?.discount_enabled && pattern.discount_applies_to === "invoice";

  const roundingSettings: RoundingSettings | null = useMemo(() => {
    if (!pattern?.rounding_enabled) return null;
    return {
      enabled: true,
      target: pattern.rounding_target,
      mode: pattern.rounding_mode,
      step: pattern.rounding_step,
    };
  }, [pattern]);

  const materialSubtotal = useMemo(() => {
    return materialLines.reduce(
      (sum, line) =>
        line.material_id
          ? sum +
            computeLineNetAmount(
              line.quantity,
              line.unit_price,
              line.discount_percent,
              line.discount_amount,
            )
          : sum,
      0,
    );
  }, [materialLines]);

  const lineDiscountTotal = useMemo(() => {
    if (!showLineDiscount) return 0;
    return materialLines.reduce((sum, line) => {
      if (!line.material_id) return sum;
      return (
        sum +
        computeLineDiscountAmount(
          line.quantity,
          line.unit_price,
          line.discount_percent,
          line.discount_amount,
        )
      );
    }, 0);
  }, [materialLines, showLineDiscount]);

  const invoiceTotals = useMemo(() => {
    let subtotal = materialSubtotal;
    if (showInvoiceDiscount && invoiceDiscountPercent && invoiceDiscountPercent > 0) {
      subtotal = Math.max(
        0,
        Math.round(subtotal * (1 - invoiceDiscountPercent / 100) * 100) / 100,
      );
    }
    const rounded = roundingSettings
      ? applyRounding(subtotal, roundingSettings, "invoice")
      : subtotal;
    return {
      subtotal: materialSubtotal,
      net: subtotal,
      rounded,
      roundingDelta: roundingSettings ? roundingDelta(subtotal, rounded) : 0,
    };
  }, [
    materialSubtotal,
    showInvoiceDiscount,
    invoiceDiscountPercent,
    roundingSettings,
  ]);

  const filteredMaterials = useMemo(
    () =>
      filterMaterialsForPattern(
        materials,
        allowedMaterialIds,
        allowedCategoryIds,
      ),
    [materials, allowedMaterialIds, allowedCategoryIds],
  );

  const defaultWarehouseId = useMemo(() => {
    if (!pattern?.default_warehouse_id) return "";
    const wh = warehouses.find((w) => w.id === pattern.default_warehouse_id);
    if (wh && wh.branch_id === branchId) return wh.id;
    const first = warehouses.find(
      (w) => w.is_active && w.branch_id === branchId,
    );
    return first?.id ?? "";
  }, [pattern, warehouses, branchId]);

  const loadUnits = useCallback(async (materialId: string) => {
    const units = await materialApi.listMaterialUnits(materialId);
    setUnitsByMaterial((current) => ({ ...current, [materialId]: units }));
    return units;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const sharedLoads = Promise.all([
          invoicePatternApi.listBranches(),
          invoicePatternApi.listWarehouses(),
          materialApi.listMaterials(),
          voucherApi.listAccounts(),
          currencyApi.listActiveCurrencies(),
          costCenterApi.listCostCenters(),
          voucherApi.listCustomers(),
          voucherApi.listVendors(),
          salesRepApi.listSalesReps().catch(() => []),
        ]);

        if (mode === "edit" && invoiceId) {
          const detail = await invoiceApi.getInvoice(invoiceId);
          const [
            branchesData,
            warehousesData,
            materialsData,
            accountsData,
            currenciesData,
            centersData,
            customersData,
            vendorsData,
            salesRepsData,
          ] = await sharedLoads;
          if (cancelled) return;

          const { header, pattern: patternData, materialLines: mLines, accountLines: aLines } =
            detail;

          setPattern(patternData);
          setPatternConditions(
            (await invoicePatternApi.getPatternConditions(patternData.id)) ?? {
              pattern_id: patternData.id,
              ...DEFAULT_PATTERN_CONDITIONS,
            },
          );
          setBranches(branchesData);
          setWarehouses(warehousesData);
          setMaterials(materialsData);
          setAccounts(accountsData);
          setCurrencies(currenciesData);
          setCostCenters(centersData);
          setCustomers(customersData);
          setVendors(vendorsData);
          setSalesReps(salesRepsData);
          setSavedId(header.id);
          setInvoiceNo(header.invoice_no);
          setStatus(header.status);
          setJournalEntryId(header.journal_entry_id);
          setInvoiceDate(header.invoice_date);
          setBranchId(header.branch_id);
          setCostCenterId(header.cost_center_id ?? "");
          setCustomerId(header.customer_id ?? "");
          setVendorId(header.vendor_id ?? "");
          setSalesRepId(header.sales_rep_id ?? "");
          setReferenceInvoiceId(header.reference_invoice_id ?? "");
          setReferenceClosedAt(header.reference_closed_at ?? null);
          const extraRefs =
            await invoiceReferenceLinksApi.listAdditionalReferenceIds(header.id);
          if (!cancelled) setAdditionalReferenceIds(extraRefs);
          setSettlementMode(header.settlement_mode);
          setPaymentTermsDays(header.payment_terms_days);
          setDueDate(header.due_date ?? null);
          setCurrencyId(header.currency_id ?? "");
          setExchangeRate(header.exchange_rate);
          setReceiptNo(header.receipt_no ?? "");
          setInvoiceDiscountPercent(header.invoice_discount_percent ?? null);
          setDescription(header.description ?? "");
          setCreditorAccountId(header.creditor_account_id ?? "");
          setDebtorAccountId(header.debtor_account_id ?? "");
          setCostAccountId(header.cost_account_id ?? "");
          setInventoryAccountId(header.inventory_account_id ?? "");
          setDiscountAccountId(header.discount_account_id ?? "");
          setExtraAccountId(header.extra_account_id ?? "");
          setInventoryTransferId(header.inventory_transfer_id ?? "");
          setInvoiceTransferRole(header.transfer_role ?? "");
          setMaterialLines(toDraftMaterialLines(mLines));
          setAccountLines(toDraftAccountLines(aLines));

          const [allowedMats, allowedCats] = await Promise.all([
            invoicePatternApi.listAllowedMaterialIds(patternData.id),
            invoicePatternApi.listAllowedCategoryIds(patternData.id),
          ]);
          if (!cancelled) {
            setAllowedMaterialIds(allowedMats);
            setAllowedCategoryIds(allowedCats);
          }

          const unitLoads = await Promise.all(
            [...new Set(mLines.map((l) => l.material_id))].map(async (mid) => {
              const units = await materialApi.listMaterialUnits(mid);
              return [mid, units] as const;
            }),
          );
          if (!cancelled) {
            setUnitsByMaterial(Object.fromEntries(unitLoads));
          }
          return;
        }

        if (!patternId) {
          throw new Error("نمط الفاتورة مطلوب.");
        }

        const [
          patternData,
          branchesData,
          warehousesData,
          materialsData,
          accountsData,
          currenciesData,
          centersData,
          customersData,
          vendorsData,
          salesRepsData,
        ] = await Promise.all([
          invoicePatternApi.getInvoicePattern(patternId),
          invoicePatternApi.listBranches(),
          invoicePatternApi.listWarehouses(),
          materialApi.listMaterials(),
          voucherApi.listAccounts(),
          currencyApi.listActiveCurrencies(),
          costCenterApi.listCostCenters(),
          voucherApi.listCustomers(),
          voucherApi.listVendors(),
          salesRepApi.listSalesReps().catch(() => []),
        ]);

        if (cancelled) return;

        setPattern(patternData);
        setPatternConditions(
          (await invoicePatternApi.getPatternConditions(patternData.id)) ?? {
            pattern_id: patternData.id,
            ...DEFAULT_PATTERN_CONDITIONS,
          },
        );
        setBranches(branchesData);
        setWarehouses(warehousesData);
        setMaterials(materialsData);
        setAccounts(accountsData);
        setCurrencies(currenciesData);
        setCostCenters(centersData);
        setCustomers(customersData);
        setVendors(vendorsData);
        setSalesReps(salesRepsData);

        const preview = await invoicePatternApi.peekInvoiceNo(patternId);
        if (cancelled) return;
        setInvoiceNo(preview);
        setBranchId(
          patternData.default_branch_id ??
            branchesData.find((b) => b.is_active)?.id ??
            "",
        );
        setCostCenterId(patternData.default_cost_center_id ?? "");
        setCurrencyId(patternData.default_currency_id ?? "");
        setSettlementMode(patternData.default_settlement_mode);
        setPaymentTermsDays(
          patternData.payment_terms_enabled
            ? patternData.default_payment_terms_days
            : null,
        );
        setCreditorAccountId(patternData.default_creditor_account_id ?? "");
        setDebtorAccountId(patternData.default_debtor_account_id ?? "");
        setCostAccountId(patternData.default_cost_account_id ?? "");
        setInventoryAccountId(patternData.default_inventory_account_id ?? "");
        setDiscountAccountId(patternData.default_discount_account_id ?? "");
        setExtraAccountId(patternData.default_extra_account_id ?? "");

        const [allowedMats, allowedCats] = await Promise.all([
          invoicePatternApi.listAllowedMaterialIds(patternData.id),
          invoicePatternApi.listAllowedCategoryIds(patternData.id),
        ]);
        if (!cancelled) {
          setAllowedMaterialIds(allowedMats);
          setAllowedCategoryIds(allowedCats);
        }

        if (transferId && transferRole && !cancelled) {
          const transfer = await transferApi.getTransfer(transferId);
          const branch =
            transferRole === "out"
              ? transfer.from_branch_id
              : transfer.to_branch_id;
          const warehouse =
            transferRole === "out"
              ? transfer.from_warehouse_id
              : transfer.to_warehouse_id;

          setInventoryTransferId(transfer.id);
          setInvoiceTransferRole(transferRole);
          setBranchId(branch);
          setDescription(
            transfer.notes
              ? `مناقلة ${transfer.transfer_no} — ${transfer.notes}`
              : `مناقلة ${transfer.transfer_no}`,
          );

          const unitMap: Record<string, MaterialUnitOption[]> = {};
          const draftLines: DraftMaterialLine[] = [];

          for (const [index, line] of transfer.lines.entries()) {
            const units = await materialApi.listMaterialUnits(line.material_id);
            unitMap[line.material_id] = units;
            const material = materialsData.find((m) => m.id === line.material_id);
            const unit =
              units.find((u) => u.id === line.material_unit_id) ?? units[0];
            const qty =
              transferRole === "in"
                ? line.qty_shipped || line.qty_ordered
                : line.qty_ordered;

            draftLines.push({
              clientId: crypto.randomUUID(),
              line_no: index + 1,
              branch_id: branch,
              cost_center_id: patternData.default_cost_center_id ?? null,
              warehouse_id: warehouse,
              material_id: line.material_id,
              material_unit_id: line.material_unit_id,
              quantity: qty,
              unit_price:
                material && unit
                  ? defaultUnitPrice(
                      patternData.commercial_kind,
                      material,
                      unit.factor_to_base,
                    )
                  : 0,
              line_description: null,
              qty_received: transferRole === "in" ? qty : null,
            });
          }

          if (!cancelled) {
            setMaterialLines(draftLines);
            setUnitsByMaterial(unitMap);
          }
        }
      } catch (err) {
        if (!cancelled) {
          notifyError(
            err instanceof Error ? err.message : "فشل تحميل بيانات الفاتورة.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [mode, patternId, invoiceId, transferId, transferRole, notifyError]);

  useEffect(() => {
    if (!pattern || !showReference || !referenceSettings) return;
    let cancelled = false;

    void referenceInvoiceApi
      .listCandidates({
        commercialKind: pattern.commercial_kind,
        excludeInvoiceId: savedId || undefined,
        settings: referenceSettings,
      })
      .then((rows) => {
        if (!cancelled) setReferenceCandidates(rows);
      })
      .catch(() => {
        if (!cancelled) setReferenceCandidates([]);
      });

    return () => {
      cancelled = true;
    };
  }, [pattern, showReference, referenceSettings, savedId]);

  useEffect(() => {
    if (!referenceInvoiceId) return;
    setAdditionalReferenceIds((current) =>
      current.filter((id) => id !== referenceInvoiceId),
    );
  }, [referenceInvoiceId]);

  useEffect(() => {
    if (!showReference) {
      setReferenceLineCaps(null);
      setReferenceDetailHeader(null);
      return;
    }

    const refIds = [
      ...(referenceInvoiceId ? [referenceInvoiceId] : []),
      ...additionalReferenceIds,
    ];
    if (refIds.length === 0) {
      setReferenceLineCaps(null);
      setReferenceDetailHeader(null);
      return;
    }

    let cancelled = false;
    void Promise.all(refIds.map((id) => invoiceApi.getInvoice(id)))
      .then((details) => {
        if (cancelled) return;
        const capGroups = details.map((detail) =>
          buildReferenceLineCaps(detail.materialLines),
        );
        setReferenceLineCaps(mergeReferenceLineCaps(capGroups));
        const primaryDetail = referenceInvoiceId
          ? details.find((detail) => detail.header.id === referenceInvoiceId)
          : details[0];
        setReferenceDetailHeader(primaryDetail?.header ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setReferenceLineCaps(null);
          setReferenceDetailHeader(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showReference, referenceInvoiceId, additionalReferenceIds]);

  const secondaryReferenceOptions = useMemo(() => {
    const used = new Set([referenceInvoiceId, ...additionalReferenceIds]);
    return referenceCandidates.filter((candidate) => !used.has(candidate.id));
  }, [referenceCandidates, referenceInvoiceId, additionalReferenceIds]);

  const referenceLabel = useCallback(
    (id: string) => {
      const ref = referenceCandidates.find((candidate) => candidate.id === id);
      if (!ref) return id.slice(0, 8);
      return `${ref.invoice_no} — ${ref.invoice_date}`;
    },
    [referenceCandidates],
  );

  const applyLoadedReferenceData = async (loaded: LoadedReferenceData) => {
    if (loaded.customerId) setCustomerId(loaded.customerId);
    if (loaded.vendorId) setVendorId(loaded.vendorId);
    if (loaded.branchId) setBranchId(loaded.branchId);
    if (loaded.costCenterId) setCostCenterId(loaded.costCenterId);
    if (loaded.currencyId) setCurrencyId(loaded.currencyId);
    if (loaded.settlementMode) setSettlementMode(loaded.settlementMode);
    if (loaded.paymentTermsDays != null) {
      setPaymentTermsDays(loaded.paymentTermsDays);
    }
    if (loaded.discountAccountId) setDiscountAccountId(loaded.discountAccountId);
    if (loaded.extraAccountId) setExtraAccountId(loaded.extraAccountId);
    if (loaded.invoiceDiscountPercent != null) {
      setInvoiceDiscountPercent(loaded.invoiceDiscountPercent);
    }
    if (loaded.receiptNo) setReceiptNo(loaded.receiptNo);
    if (loaded.invoiceDate) setInvoiceDate(loaded.invoiceDate);
    if (loaded.accountLines.length > 0) {
      setAccountLines(
        loaded.accountLines.map((line, index) => ({
          clientId: `ref-acct-${index}`,
          line_no: line.line_no,
          branch_id: line.branch_id,
          cost_center_id: line.cost_center_id,
          account_id: line.account_id,
          side: line.side,
          amount: line.amount,
          description: line.description,
        })),
      );
    }
    if (loaded.materialLines.length > 0) {
      setMaterialLines(loaded.materialLines);
      const unitLoads = await Promise.all(
        loaded.materialIds.map(async (mid) => {
          const units = await materialApi.listMaterialUnits(mid);
          return [mid, units] as const;
        }),
      );
      setUnitsByMaterial((current) => ({
        ...current,
        ...Object.fromEntries(unitLoads),
      }));
    }
  };

  const loadFromReference = async (partial: boolean) => {
    if (!referenceInvoiceId || !referenceSettings || !pattern) {
      setError("اختر فاتورة مرجعية أولاً.");
      return;
    }

    setIsLoadingReference(true);
    setError("");
    try {
      const detail = await invoiceApi.getInvoice(referenceInvoiceId);
      const loaded = referenceInvoiceApi.buildLoadedData(
        detail,
        referenceSettings,
        {
          branchId,
          costCenterId,
          warehouseId: defaultWarehouseId,
        },
        partial,
      );

      await applyLoadedReferenceData(loaded);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "فشل تحميل الفاتورة المرجعية.",
      );
    } finally {
      setIsLoadingReference(false);
    }
  };

  const openReferencePicker = async () => {
    if (!referenceInvoiceId || !referenceSettings || !pattern) {
      setError("اختر فاتورة مرجعية أولاً.");
      return;
    }

    setIsLoadingReference(true);
    setError("");
    try {
      const detail = await invoiceApi.getInvoice(referenceInvoiceId);
      if (detail.materialLines.length === 0) {
        setError("الفاتورة المرجعية لا تحتوي على أسطر مواد.");
        return;
      }
      setReferencePickerLines(detail.materialLines);
      setReferencePickerOpen(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "فشل تحميل أسطر المرجع.",
      );
    } finally {
      setIsLoadingReference(false);
    }
  };

  const handleReferencePickerConfirm = async (
    selection: Array<{ line: InvoiceMaterialLine; quantity: number }>,
  ) => {
    if (!referenceInvoiceId || !referenceSettings || !pattern) return;

    setIsLoadingReference(true);
    setError("");
    try {
      const detail = await invoiceApi.getInvoice(referenceInvoiceId);
      const loaded = referenceInvoiceApi.buildLoadedDataFromSelection(
        detail,
        referenceSettings,
        {
          branchId,
          costCenterId,
          warehouseId: defaultWarehouseId,
        },
        selection,
      );
      await applyLoadedReferenceData(loaded);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "فشل تحميل الأسطر المختارة.",
      );
    } finally {
      setIsLoadingReference(false);
    }
  };

  const runValidation = useCallback(
    async (forPost: boolean): Promise<string | null> => {
      if (!pattern) return "نمط الفاتورة غير محمّل.";

      const validationError = validateInvoice({
        commercialKind: pattern.commercial_kind,
        warehouseMovement: pattern.warehouse_movement,
        conditions: patternConditions,
        discountPolicy: pattern.discount_enabled
          ? {
              enabled: true,
              maxPercent: pattern.max_discount_percent,
              appliesTo: pattern.discount_applies_to,
            }
          : null,
        referenceSettings,
        referenceInvoiceId,
        branchId,
        costCenterId,
        customerId,
        vendorId,
        salesRepId,
        settlementMode,
        paymentTermsDays,
        receiptNo,
        invoiceDiscountPercent,
        materialLines,
        accountLines,
        forPost,
      });
      if (validationError) return validationError;

      for (const line of materialLines) {
        if (!line.material_id) continue;
        const material = materials.find((m) => m.id === line.material_id);
        if (
          material &&
          !isMaterialAllowedForPattern(
            material,
            allowedMaterialIds,
            allowedCategoryIds,
          )
        ) {
          return `المادة ${material.name_ar} غير مسموحة في هذا النمط.`;
        }
      }

      if (
        patternConditions?.prevent_duplicate_receipt_no &&
        receiptNo.trim()
      ) {
        const taken = await invoiceApi.isReceiptNoTaken(
          receiptNo,
          savedId || undefined,
        );
        if (taken) return "رقم الإيصال مستخدم مسبقاً.";
      }

      if (referenceInvoiceId && referenceLineCaps) {
        const capError = validateReferenceQuantities(
          materialLines,
          referenceLineCaps,
        );
        if (capError) return capError;
      }

      if (referenceSettings?.match_reference && referenceDetailHeader) {
        const matchError = validateReferenceMatch(
          referenceSettings,
          referenceDetailHeader,
          {
            commercialKind: pattern.commercial_kind,
            branchId,
            customerId,
            vendorId,
            currencyId,
            settlementMode,
          },
        );
        if (matchError) return matchError;
      }

      if (
        forPost &&
        showLineDiscount &&
        lineDiscountTotal > 0 &&
        !discountAccountId
      ) {
        return "حساب الخصم مطلوب عند ترحيل فاتورة فيها خصم على الأسطر.";
      }

      return null;
    },
    [
      pattern,
      patternConditions,
      referenceSettings,
      referenceInvoiceId,
      branchId,
      costCenterId,
      customerId,
      vendorId,
      salesRepId,
      settlementMode,
      paymentTermsDays,
      receiptNo,
      invoiceDiscountPercent,
      materialLines,
      accountLines,
      materials,
      allowedMaterialIds,
      allowedCategoryIds,
      savedId,
      referenceLineCaps,
      referenceDetailHeader,
      showLineDiscount,
      lineDiscountTotal,
      discountAccountId,
    ],
  );

  const onSave = async (andPost = false) => {
    if (!pattern) return;

    const validationError = await runValidation(andPost || pattern.auto_post);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const saved = await invoiceApi.saveInvoice({
        id: savedId || undefined,
        pattern_id: pattern.id,
        invoice_date: invoiceDate,
        branch_id: branchId,
        cost_center_id: costCenterId || null,
        customer_id: partyKind === "customer" ? customerId || null : null,
        vendor_id: partyKind === "vendor" ? vendorId || null : null,
        sales_rep_id: partyKind === "customer" ? salesRepId || null : null,
        reference_invoice_id: showReference ? referenceInvoiceId || null : null,
        creditor_account_id: creditorAccountId || null,
        debtor_account_id: debtorAccountId || null,
        cost_account_id: costAccountId || null,
        inventory_account_id: inventoryAccountId || null,
        discount_account_id: discountAccountId || null,
        extra_account_id: extraAccountId || null,
        settlement_mode: settlementMode,
        payment_terms_days:
          settlementMode === "credit" ? paymentTermsDays : null,
        currency_id: currencyId || null,
        exchange_rate: exchangeRate,
        receipt_no: receiptNo || null,
        invoice_discount_percent: showInvoiceDiscount
          ? invoiceDiscountPercent
          : null,
        description: description || null,
        inventory_transfer_id: inventoryTransferId || null,
        transfer_role: invoiceTransferRole || null,
        materialLines: materialLines.map(({ clientId: _c, ...line }) => line),
        accountLines: accountLines.map(({ clientId: _c, ...line }) => line),
      });

      setSavedId(saved.id);
      if (showReference && referenceSettings?.allow_multiple_references) {
        await invoiceReferenceLinksApi.syncAdditionalReferences(
          saved.id,
          additionalReferenceIds,
        );
      }
      if (mode === "create") {
        router.replace(`/invoices/${saved.id}`);
      }

      if (andPost) {
        const journalId = await invoiceApi.postInvoice(saved.id);
        setStatus("posted");
        setJournalEntryId(journalId);
        notifySuccess("تم حفظ وترحيل الفاتورة.");
      } else if (pattern.auto_post) {
        const journalId = await invoiceApi.postInvoice(saved.id);
        setStatus("posted");
        setJournalEntryId(journalId);
        notifySuccess("تم حفظ وترحيل الفاتورة تلقائياً.");
      } else {
        notifySuccess("تم حفظ الفاتورة.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حفظ الفاتورة.");
    } finally {
      setIsSaving(false);
    }
  };

  const onPost = async () => {
    if (!savedId) {
      await onSave(true);
      return;
    }

    const validationError = await runValidation(true);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const journalId = await invoiceApi.postInvoice(savedId);
      setStatus("posted");
      setJournalEntryId(journalId);
      notifySuccess("تم ترحيل الفاتورة.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل ترحيل الفاتورة.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-slate-600">جاري تحميل الفاتورة...</p>;
  }

  if (!pattern) {
    return <p className="text-sm text-red-600">لم يُعثر على نمط الفاتورة.</p>;
  }

  const canCloseAsReference =
    status === "posted" &&
    !referenceClosedAt &&
    !!referenceSettings?.allow_manual_reference_close &&
    (pattern.commercial_kind === "sale" || pattern.commercial_kind === "purchase");

  const onCloseReference = async () => {
    if (!savedId || !canCloseAsReference) return;

    setIsClosingReference(true);
    setError("");
    try {
      await referenceInvoiceApi.closeReference(savedId);
      setReferenceClosedAt(new Date().toISOString());
      notifySuccess("تم إغلاق الفاتورة كمرجع — لن تظهر في قوائم المراجع الجديدة.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إغلاق المرجع.");
    } finally {
      setIsClosingReference(false);
    }
  };

  const showSettlementPanel =
    status === "posted" &&
    !!savedId &&
    settlementMode === "credit" &&
    (pattern.commercial_kind === "sale" ||
      pattern.commercial_kind === "purchase" ||
      pattern.commercial_kind === "return_sale" ||
      pattern.commercial_kind === "return_purchase");

  const showInventoryPanel =
    status === "posted" && !!savedId && materialLines.length > 0;

  const req = (flag: boolean, label: string) => (flag ? `${label} *` : label);

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {mode === "create" ? "فاتورة جديدة" : `فاتورة ${invoiceNo}`}
          </h1>
          <p className="text-xs text-slate-600">
            {pattern.name_ar} — {getCommercialKindLabel(pattern.commercial_kind)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InvoiceStatusChip status={status} />
          {journalEntryId && (
            <Link
              href={`/journals/${journalEntryId}`}
              className="text-xs text-blue-700 underline"
            >
              عرض القيد
            </Link>
          )}
        </div>
      </section>

      {(referenceClosedAt || canCloseAsReference) && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <h2 className="mb-2 text-sm font-bold text-amber-900">حالة المرجع</h2>
          {referenceClosedAt ? (
            <p className="text-sm text-amber-800">
              هذه الفاتورة <strong>مغلقة كمرجع</strong> — لا يمكن استخدامها في فواتير
              مرتجع/إلغاء جديدة (حسب إعداد إخفاء المراجع المغلقة).
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-amber-800">
                الفاتورة مرحّلة ويمكن استخدامها كمرجع. يمكن إغلاقها يدوياً لمنع
                استخدامها في فواتير جديدة.
              </p>
              <button
                type="button"
                disabled={isClosingReference}
                onClick={() => void onCloseReference()}
                className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 disabled:opacity-50"
              >
                {isClosingReference ? "جاري الإغلاق..." : "إغلاق المرجع"}
              </button>
            </div>
          )}
        </section>
      )}

      {showSettlementPanel && (
        <InvoiceOpenMovementsPanel
          invoiceId={savedId}
          commercialKind={pattern.commercial_kind}
          settlementMode={settlementMode}
          customerId={customerId}
          vendorId={vendorId}
          dueDate={dueDate}
          paymentTermsDays={paymentTermsDays}
        />
      )}

      {showInventoryPanel && (
        <InvoiceInventoryMovementsPanel
          invoiceId={savedId}
          invoiceNo={invoiceNo}
        />
      )}

      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">رقم الفاتورة</span>
            <input
              readOnly
              dir="ltr"
              className={inputClass}
              value={invoiceNo}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">التاريخ *</span>
            <input
              type="date"
              disabled={readOnly}
              className={inputClass}
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">الفرع *</span>
            <select
              disabled={readOnly}
              className={inputClass}
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">—</option>
              {branches
                .filter((b) => b.is_active)
                .map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.branch_code} — {branch.name_ar}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {req(
                headerFieldRequired(
                  patternConditions,
                  "cost_center",
                  partyKind,
                  settlementMode,
                ),
                "مركز الكلفة",
              )}
            </span>
            <select
              disabled={readOnly}
              className={inputClass}
              value={costCenterId}
              onChange={(e) => setCostCenterId(e.target.value)}
            >
              <option value="">—</option>
              {costCenters
                .filter((c) => c.is_active)
                .map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.code} — {center.name_ar}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">التسوية</span>
            <select
              disabled={readOnly}
              className={inputClass}
              value={settlementMode}
              onChange={(e) =>
                setSettlementMode(e.target.value as InvoiceSettlementMode)
              }
            >
              <option value="credit">آجل</option>
              <option value="cash">نقدي</option>
            </select>
          </label>
          {settlementMode === "credit" && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                {req(
                  headerFieldRequired(
                    patternConditions,
                    "payment_terms",
                    partyKind,
                    settlementMode,
                  ),
                  "أيام السداد",
                )}
              </span>
              <input
                type="number"
                min={0}
                disabled={readOnly}
                className={inputClass}
                value={paymentTermsDays ?? ""}
                onChange={(e) =>
                  setPaymentTermsDays(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">العملة</span>
            <select
              disabled={readOnly}
              className={inputClass}
              value={currencyId}
              onChange={(e) => setCurrencyId(e.target.value)}
            >
              <option value="">—</option>
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.id}>
                  {currency.code}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">سعر الصرف</span>
            <input
              type="number"
              min={0.000001}
              step="any"
              disabled={readOnly}
              className={inputClass}
              value={exchangeRate ?? ""}
              onChange={(e) =>
                setExchangeRate(e.target.value ? Number(e.target.value) : null)
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {req(
                headerFieldRequired(
                  patternConditions,
                  "receipt_no",
                  partyKind,
                  settlementMode,
                ),
                "رقم الإيصال",
              )}
            </span>
            <input
              disabled={readOnly}
              className={inputClass}
              value={receiptNo}
              onChange={(e) => setReceiptNo(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-3">
            <span className="font-medium">البيان</span>
            <input
              disabled={readOnly}
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
      </section>

      {showReference && (
        <section className="rounded-xl border border-slate-200 p-4">
          <h2 className="mb-3 text-sm font-bold text-slate-800">
            الفاتورة المرجعية
            {referenceSettings?.require_reference ? " *" : ""}
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">اختر مرجعاً</span>
              <select
                disabled={readOnly || referenceLocked}
                className={inputClass}
                value={referenceInvoiceId}
                onChange={(e) => setReferenceInvoiceId(e.target.value)}
              >
                <option value="">— اختر فاتورة مرحّلة —</option>
                {referenceCandidates.map((ref) => (
                  <option key={ref.id} value={ref.id}>
                    {ref.invoice_no} — {ref.invoice_date}
                    {ref.party_name_ar ? ` (${ref.party_name_ar})` : ""}
                    {ref.reference_closed_at ? " [مغلق]" : ""}
                  </option>
                ))}
              </select>
            </label>
            {!readOnly && (
              <>
                <button
                  type="button"
                  disabled={isLoadingReference || !referenceInvoiceId}
                  onClick={() => void loadFromReference(false)}
                  className="rounded-md border border-blue-300 px-3 py-2 text-sm font-medium text-blue-800 disabled:opacity-50"
                >
                  {isLoadingReference ? "جاري التحميل..." : "تحميل كامل"}
                </button>
                {referenceSettings?.allow_partial_load && (
                  <button
                    type="button"
                    disabled={isLoadingReference || !referenceInvoiceId}
                    onClick={() => void loadFromReference(true)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                  >
                    تحميل الرأس فقط
                  </button>
                )}
                {referenceSettings?.allow_partial_load && (
                  <button
                    type="button"
                    disabled={isLoadingReference || !referenceInvoiceId}
                    onClick={() => void openReferencePicker()}
                    className="rounded-md border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-800 disabled:opacity-50"
                  >
                    تحميل أسطر مختارة
                  </button>
                )}
              </>
            )}
            {referenceInvoiceId && (
              <Link
                href={`/invoices/${referenceInvoiceId}`}
                target="_blank"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                عرض المرجع
              </Link>
            )}
          </div>
          {referenceLineCaps && Object.keys(referenceLineCaps).length > 0 && (
            <p className="mt-2 text-xs text-slate-600">
              كميات أسطر المواد محدودة بكميات الفاتورة المرجعية.
            </p>
          )}
          {referenceLocked && (
            <p className="mt-2 text-xs text-amber-700">
              المرجع مقفول حسب إعداد النمط — لا يمكن تغييره بعد الربط.
            </p>
          )}
          {referenceSettings?.allow_multiple_references && referenceInvoiceId && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-slate-700">مراجع إضافية</p>
              {!readOnly && secondaryReferenceOptions.length > 0 && (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm">
                    <span className="text-slate-600">إضافة مرجع</span>
                    <select
                      className={inputClass}
                      value={secondaryReferencePick}
                      onChange={(e) => setSecondaryReferencePick(e.target.value)}
                    >
                      <option value="">— اختر —</option>
                      {secondaryReferenceOptions.map((ref) => (
                        <option key={ref.id} value={ref.id}>
                          {ref.invoice_no} — {ref.invoice_date}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!secondaryReferencePick}
                    onClick={() => {
                      if (!secondaryReferencePick) return;
                      setAdditionalReferenceIds((current) =>
                        current.includes(secondaryReferencePick)
                          ? current
                          : [...current, secondaryReferencePick],
                      );
                      setSecondaryReferencePick("");
                    }}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                  >
                    إضافة
                  </button>
                </div>
              )}
              {additionalReferenceIds.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {additionalReferenceIds.map((refId) => (
                    <li
                      key={refId}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <span className="flex-1 text-slate-800">
                        {referenceLabel(refId)}
                      </span>
                      <Link
                        href={`/invoices/${refId}`}
                        target="_blank"
                        className="text-xs font-medium text-blue-800 hover:underline"
                      >
                        عرض
                      </Link>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            setAdditionalReferenceIds((current) =>
                              current.filter((id) => id !== refId),
                            )
                          }
                          className="text-xs font-medium text-red-700 hover:underline"
                        >
                          إزالة
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">
                  لا توجد مراجع إضافية — حدود الكميات تُجمع من المرجع الرئيسي والإضافي.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {partyKind === "customer" && (
        <section className="rounded-xl border border-slate-200 p-4">
          <p className="mb-2 text-sm font-medium text-slate-700">
            {req(
              headerFieldRequired(
                patternConditions,
                "party",
                partyKind,
                settlementMode,
              ),
              "العميل",
            )}
          </p>
          <CustomerSearchField
            customers={customers}
            value={customerId}
            onChange={(id) => setCustomerId(id)}
            disabled={readOnly}
          />
          <label className="mt-3 flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">
              {req(salesRepFieldRequired(patternConditions, partyKind), "مندوب المبيعات")}
            </span>
            <select
              disabled={readOnly}
              className={inputClass}
              value={salesRepId}
              onChange={(e) => setSalesRepId(e.target.value)}
            >
              <option value="">— بدون —</option>
              {salesReps.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.rep_code} — {rep.name_ar}
                </option>
              ))}
            </select>
            {salesReps.length === 0 && (
              <span className="text-xs text-amber-700">
                لا يوجد مندوبون مسجّلون — يمكن إضافتهم لاحقاً من إعدادات المندوبين.
              </span>
            )}
          </label>
        </section>
      )}

      {partyKind === "vendor" && (
        <section className="rounded-xl border border-slate-200 p-4">
          <p className="mb-2 text-sm font-medium text-slate-700">
            {req(
              headerFieldRequired(
                patternConditions,
                "party",
                partyKind,
                settlementMode,
              ),
              "المورد",
            )}
          </p>
          <VendorSearchField
            vendors={vendors}
            value={vendorId}
            onChange={(id) => setVendorId(id)}
            disabled={readOnly}
          />
        </section>
      )}

      <section className="rounded-xl border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-bold text-slate-800">
          حسابات الفاتورة (اختياري — تُستخدم عند الترحيل)
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <AccountSearchField
            label="حساب الدائن"
            accounts={accounts}
            value={creditorAccountId}
            onChange={(id) => setCreditorAccountId(id)}
            disabled={readOnly}
          />
          <AccountSearchField
            label="حساب المدين"
            accounts={accounts}
            value={debtorAccountId}
            onChange={(id) => setDebtorAccountId(id)}
            disabled={readOnly}
          />
          <AccountSearchField
            label="حساب التكلفة"
            accounts={accounts}
            value={costAccountId}
            onChange={(id) => setCostAccountId(id)}
            disabled={readOnly}
          />
          <AccountSearchField
            label="حساب المخزون"
            accounts={accounts}
            value={inventoryAccountId}
            onChange={(id) => setInventoryAccountId(id)}
            disabled={readOnly}
          />
          <AccountSearchField
            label="حساب الخصم"
            accounts={accounts}
            value={discountAccountId}
            onChange={(id) => setDiscountAccountId(id)}
            disabled={readOnly}
          />
          <AccountSearchField
            label="حساب إضافي"
            accounts={accounts}
            value={extraAccountId}
            onChange={(id) => setExtraAccountId(id)}
            disabled={readOnly}
          />
        </div>
      </section>

      {pattern.warehouse_movement && (
        <section className="rounded-xl border border-slate-200 p-4">
          <h2 className="mb-3 text-sm font-bold text-slate-800">أسطر المواد</h2>
          <InvoiceMaterialLinesTable
            lines={materialLines}
            materials={filteredMaterials}
            unitsByMaterial={unitsByMaterial}
            warehouses={warehouses}
            defaultBranchId={branchId}
            defaultCostCenterId={costCenterId}
            defaultWarehouseId={defaultWarehouseId}
            commercialKind={pattern.commercial_kind}
            readOnly={readOnly}
            showQtyReceived={pattern.commercial_kind === "transfer_in"}
            showLineDiscount={showLineDiscount}
            referenceLineCaps={referenceLineCaps}
            lineAttributes={lineAttrFlags}
            onChange={setMaterialLines}
            onMaterialSelected={loadUnits}
          />
        </section>
      )}

      <section className="rounded-xl border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-bold text-slate-800">
          أسطر حسابات إضافية
        </h2>
        <InvoiceAccountLinesTable
          lines={accountLines}
          accounts={accounts}
          defaultBranchId={branchId}
          defaultCostCenterId={costCenterId}
          readOnly={readOnly}
          onChange={setAccountLines}
        />
      </section>

      {(showInvoiceDiscount || roundingSettings?.enabled) && (
        <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <h2 className="mb-3 text-sm font-bold text-slate-800">الإجماليات</h2>
          <div className="flex flex-col gap-2 text-sm text-slate-700">
            <p>
              مجموع المواد:{" "}
              <span className="font-mono font-semibold">
                {invoiceTotals.subtotal.toFixed(2)}
              </span>
            </p>
            {showLineDiscount && lineDiscountTotal > 0 && (
              <p>
                إجمالي خصم الأسطر:{" "}
                <span className="font-mono font-semibold text-amber-800">
                  {lineDiscountTotal.toFixed(2)}
                </span>
                {!discountAccountId && (
                  <span className="mr-2 text-xs text-amber-700">
                    — حدّد حساب الخصم لتوليد قيد الخصم عند الترحيل
                  </span>
                )}
              </p>
            )}
            {showInvoiceDiscount && (
              <label className="flex max-w-xs flex-col gap-1">
                <span className="font-medium">
                  خصم الفاتورة (%)
                  {pattern.max_discount_percent != null &&
                    ` — حد أقصى ${pattern.max_discount_percent}%`}
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  disabled={readOnly}
                  className={inputClass}
                  value={invoiceDiscountPercent ?? ""}
                  onChange={(e) =>
                    setInvoiceDiscountPercent(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                />
              </label>
            )}
            {showInvoiceDiscount &&
              invoiceDiscountPercent != null &&
              invoiceDiscountPercent > 0 && (
                <p>
                  بعد خصم الفاتورة:{" "}
                  <span className="font-mono font-semibold">
                    {invoiceTotals.net.toFixed(2)}
                  </span>
                </p>
              )}
            {roundingSettings?.enabled && (
              <p>
                بعد التدوير:{" "}
                <span className="font-mono font-semibold text-blue-900">
                  {invoiceTotals.rounded.toFixed(2)}
                </span>
                {invoiceTotals.roundingDelta !== 0 && (
                  <span className="text-xs text-slate-500">
                    {" "}
                    (فرق التدوير: {invoiceTotals.roundingDelta.toFixed(2)})
                  </span>
                )}
              </p>
            )}
          </div>
        </section>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!readOnly && (
          <>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void onSave(false)}
              className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSaving ? "جاري الحفظ..." : "حفظ مسودة"}
            </button>
            {pattern.generate_journal && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void onPost()}
                className="rounded-md border border-emerald-400 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 disabled:opacity-50"
              >
                ترحيل
              </button>
            )}
          </>
        )}
        <Link
          href="/invoices"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          رجوع للقائمة
        </Link>
      </div>

      <ReferenceLinesPicker
        open={referencePickerOpen}
        lines={referencePickerLines}
        onClose={() => setReferencePickerOpen(false)}
        onConfirm={(selected) => void handleReferencePickerConfirm(selected)}
      />
    </div>
  );
}
