import type { InvoiceHeader } from "@/modules/invoices/types";
import type { InvoiceReferenceSettings } from "@/modules/invoices/utils/reference-settings";
import { partyKindForCommercial } from "@/modules/invoices/utils/invoice-line-utils";

export interface ReferenceMatchInput {
  commercialKind: string;
  branchId: string;
  customerId: string;
  vendorId: string;
  currencyId: string;
  settlementMode: string;
}

export function validateReferenceMatch(
  settings: InvoiceReferenceSettings | null | undefined,
  referenceHeader: InvoiceHeader | null | undefined,
  invoice: ReferenceMatchInput,
): string | null {
  if (!settings?.match_reference || !referenceHeader) return null;

  const partyKind = partyKindForCommercial(invoice.commercialKind);

  if (partyKind === "customer") {
    if (
      invoice.customerId &&
      referenceHeader.customer_id &&
      invoice.customerId !== referenceHeader.customer_id
    ) {
      return "العميل لا يطابق الفاتورة المرجعية.";
    }
  }

  if (partyKind === "vendor") {
    if (
      invoice.vendorId &&
      referenceHeader.vendor_id &&
      invoice.vendorId !== referenceHeader.vendor_id
    ) {
      return "المورد لا يطابق الفاتورة المرجعية.";
    }
  }

  if (
    invoice.branchId &&
    referenceHeader.branch_id &&
    invoice.branchId !== referenceHeader.branch_id
  ) {
    return "الفرع لا يطابق الفاتورة المرجعية.";
  }

  if (
    invoice.currencyId &&
    referenceHeader.currency_id &&
    invoice.currencyId !== referenceHeader.currency_id
  ) {
    return "العملة لا تطابق الفاتورة المرجعية.";
  }

  if (
    referenceHeader.settlement_mode &&
    invoice.settlementMode !== referenceHeader.settlement_mode
  ) {
    return "طريقة التسديد لا تطابق الفاتورة المرجعية.";
  }

  return null;
}
