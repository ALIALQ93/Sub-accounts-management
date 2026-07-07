import type { InvoicePatternConditions } from "@/modules/invoices/types";
import type { InvoiceSettlementMode } from "@/modules/invoices/types";
import type { DraftAccountLine } from "@/modules/invoices/components/invoice-account-lines-table";
import type { DraftMaterialLine } from "@/modules/invoices/components/invoice-material-lines-table";
import { partyKindForCommercial } from "@/modules/invoices/utils/invoice-line-utils";
import type { MaterialOption } from "@/modules/invoices/types";
import {
  isExpiryRequiredOnLine,
  isInboundStockMovement,
  isSerialRequiredOnLine,
} from "@/modules/materials/utils/material-tracking-utils";

export interface InvoiceDiscountPolicy {
  enabled: boolean;
  maxPercent: number | null;
  appliesTo: "line" | "invoice" | null;
}

import type { InvoiceReferenceSettings } from "@/modules/invoices/utils/reference-settings";

export interface InvoiceValidationContext {
  commercialKind: string;
  warehouseMovement: boolean;
  conditions: InvoicePatternConditions | null;
  referenceSettings?: InvoiceReferenceSettings | null;
  referenceInvoiceId: string;
  discountPolicy?: InvoiceDiscountPolicy | null;
  branchId: string;
  costCenterId: string;
  customerId: string;
  vendorId: string;
  salesRepId: string;
  settlementMode: InvoiceSettlementMode;
  paymentTermsDays: number | null;
  receiptNo: string;
  invoiceDiscountPercent: number | null;
  materialLines: DraftMaterialLine[];
  accountLines: DraftAccountLine[];
  materials?: MaterialOption[];
  forPost: boolean;
}

function activeLines(materialLines: DraftMaterialLine[]): DraftMaterialLine[] {
  return materialLines.filter((line) => line.material_id);
}

export function validateInvoice(context: InvoiceValidationContext): string | null {
  const conditions = context.conditions;
  const partyKind = partyKindForCommercial(context.commercialKind);
  const lines = activeLines(context.materialLines);

  if (!context.branchId.trim()) {
    return "الفرع مطلوب.";
  }

  if (conditions?.require_party && partyKind !== "none") {
    if (partyKind === "customer" && !context.customerId) {
      return "العميل مطلوب حسب شروط النمط.";
    }
    if (partyKind === "vendor" && !context.vendorId) {
      return "المورد مطلوب حسب شروط النمط.";
    }
  }

  if (conditions?.require_cost_center && !context.costCenterId.trim()) {
    return "مركز الكلفة مطلوب حسب شروط النمط.";
  }

  if (conditions?.require_receipt_no && !context.receiptNo.trim()) {
    return "رقم الإيصال مطلوب حسب شروط النمط.";
  }

  if (
    conditions?.require_payment_terms &&
    context.settlementMode === "credit" &&
    (context.paymentTermsDays === null || context.paymentTermsDays < 0)
  ) {
    return "شروط السداد (أيام السداد) مطلوبة حسب إعداد النمط.";
  }

  if (conditions?.require_sales_rep && partyKind === "customer") {
    if (!context.salesRepId) {
      return "مندوب المبيعات مطلوب حسب شروط النمط.";
    }
  }

  if (
    context.referenceSettings?.enabled &&
    context.referenceSettings.require_reference &&
    !context.referenceInvoiceId
  ) {
    return "الفاتورة المرجعية مطلوبة حسب إعداد النمط.";
  }

  const discountPolicy = context.discountPolicy;
  if (discountPolicy?.enabled && discountPolicy.maxPercent != null) {
    const max = discountPolicy.maxPercent;
    const appliesTo = discountPolicy.appliesTo ?? "line";

    if (appliesTo !== "invoice") {
      for (const line of lines) {
        const pct = line.discount_percent ?? 0;
        if (pct > max) {
          return `سطر ${line.line_no}: نسبة الخصم (${pct}%) تتجاوز الحد (${max}%).`;
        }
        const gross = line.quantity * line.unit_price;
        const amountDisc = line.discount_amount ?? 0;
        if (amountDisc > 0 && gross > 0) {
          const implied = (amountDisc / gross) * 100;
          if (implied > max + 0.01) {
            return `سطر ${line.line_no}: مبلغ الخصم يتجاوز الحد (${max}%).`;
          }
        }
      }
    }

    if (appliesTo !== "line") {
      const pct = context.invoiceDiscountPercent ?? 0;
      if (pct > max) {
        return `خصم الفاتورة (${pct}%) يتجاوز الحد المسموح (${max}%).`;
      }
    }
  }

  if (context.warehouseMovement || lines.length > 0) {
    for (const line of lines) {
      const label = `سطر ${line.line_no}`;

      if (!line.material_id) {
        return `${label}: المادة مطلوبة.`;
      }
      if (!line.material_unit_id) {
        return `${label}: وحدة القياس مطلوبة.`;
      }
      if (!line.quantity || line.quantity <= 0) {
        return `${label}: الكمية يجب أن تكون أكبر من صفر.`;
      }

      if (conditions?.require_warehouse && !line.warehouse_id) {
        return `${label}: المستودع مطلوب حسب شروط النمط.`;
      }
      if (conditions?.require_color && !line.color?.trim()) {
        return `${label}: اللون مطلوب حسب شروط النمط.`;
      }
      if (conditions?.require_size && !line.size?.trim()) {
        return `${label}: المقاس مطلوب حسب شروط النمط.`;
      }
      if (conditions?.require_source && !line.source?.trim()) {
        return `${label}: المصدر مطلوب حسب شروط النمط.`;
      }
      if (conditions?.require_caliber && !line.caliber?.trim()) {
        return `${label}: العيار مطلوب حسب شروط النمط.`;
      }

      const material = context.materials?.find((row) => row.id === line.material_id);
      if (material) {
        if (
          isExpiryRequiredOnLine(material, context.commercialKind) &&
          !line.expiry_date
        ) {
          return `${label}: تاريخ انتهاء الصلاحية مطلوب — أدخله في سطر الفاتورة حسب إعداد بطاقة المادة.`;
        }
        if (
          isSerialRequiredOnLine(material, context.commercialKind) &&
          !line.serial_number?.trim()
        ) {
          return `${label}: الرقم التسلسلي مطلوب لهذه المادة عند ${
            isInboundStockMovement(context.commercialKind) ? "الإدخال" : "الإخراج"
          }.`;
        }
      }
    }
  }

  if (context.forPost) {
    const hasMaterials = context.warehouseMovement && lines.length > 0;
    const hasAccounts = context.accountLines.some(
      (line) => line.account_id && line.amount > 0,
    );

    if (context.warehouseMovement && lines.length === 0) {
      return "لا يمكن الترحيل بدون أسطر مواد.";
    }

    if (!hasMaterials && !hasAccounts) {
      return "لا يمكن ترحيل فاتورة فارغة.";
    }

    for (const line of lines) {
      if (line.unit_price == null || line.unit_price < 0) {
        return `سطر ${line.line_no}: السعر غير صالح للترحيل.`;
      }
    }
  }

  return null;
}

export function lineAttributeFlags(conditions: InvoicePatternConditions | null) {
  return {
    showColor: conditions?.require_color ?? false,
    showSize: conditions?.require_size ?? false,
    showSource: conditions?.require_source ?? false,
    showCaliber: conditions?.require_caliber ?? false,
  };
}

export function headerFieldRequired(
  conditions: InvoicePatternConditions | null,
  field: "party" | "cost_center" | "receipt_no" | "payment_terms",
  partyKind: "customer" | "vendor" | "none",
  settlementMode: InvoiceSettlementMode,
): boolean {
  if (!conditions) return false;
  switch (field) {
    case "party":
      return conditions.require_party && partyKind !== "none";
    case "cost_center":
      return conditions.require_cost_center;
    case "receipt_no":
      return conditions.require_receipt_no;
    case "payment_terms":
      return conditions.require_payment_terms && settlementMode === "credit";
    default:
      return false;
  }
}

export function salesRepFieldRequired(
  conditions: InvoicePatternConditions | null,
  partyKind: "customer" | "vendor" | "none",
): boolean {
  return (conditions?.require_sales_rep ?? false) && partyKind === "customer";
}
