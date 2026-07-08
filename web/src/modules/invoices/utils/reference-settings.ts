export interface InvoiceReferenceSettings {
  enabled: boolean;
  require_reference: boolean;
  lock_reference: boolean;
  allow_partial_load: boolean;
  match_reference: boolean;
  allow_multiple_references: boolean;
  hide_closed_references: boolean;
  load_discount_extra: boolean;
  load_net_unit_price: boolean;
  load_expiry_date: boolean;
  load_serial_number: boolean;
  allow_manual_reference_close: boolean;
  max_reference_age_days: number | null;
  load_party: boolean;
  load_warehouse: boolean;
  load_material_lines: boolean;
  load_cost_center: boolean;
  load_unit_price: boolean;
  load_payment_terms: boolean;
  load_receipt_no: boolean;
  load_invoice_date: boolean;
}

export const DEFAULT_REFERENCE_SETTINGS: InvoiceReferenceSettings = {
  enabled: false,
  require_reference: false,
  lock_reference: false,
  allow_partial_load: true,
  match_reference: false,
  allow_multiple_references: false,
  hide_closed_references: true,
  load_discount_extra: false,
  load_net_unit_price: false,
  load_expiry_date: true,
  load_serial_number: true,
  allow_manual_reference_close: false,
  max_reference_age_days: null,
  load_party: true,
  load_warehouse: true,
  load_material_lines: true,
  load_cost_center: true,
  load_unit_price: true,
  load_payment_terms: true,
  load_receipt_no: false,
  load_invoice_date: false,
};

export function parseReferenceSettings(
  raw: Record<string, unknown> | null | undefined,
): InvoiceReferenceSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_REFERENCE_SETTINGS };
  }
  return {
    enabled: Boolean(raw.enabled),
    require_reference: Boolean(raw.require_reference),
    lock_reference: Boolean(raw.lock_reference),
    allow_partial_load: raw.allow_partial_load !== false,
    match_reference: Boolean(raw.match_reference),
    allow_multiple_references: Boolean(raw.allow_multiple_references),
    hide_closed_references: raw.hide_closed_references !== false,
    load_discount_extra: Boolean(raw.load_discount_extra),
    load_net_unit_price: Boolean(raw.load_net_unit_price),
    load_expiry_date: raw.load_expiry_date !== false,
    load_serial_number: raw.load_serial_number !== false,
    allow_manual_reference_close: Boolean(raw.allow_manual_reference_close),
    max_reference_age_days:
      typeof raw.max_reference_age_days === "number"
        ? raw.max_reference_age_days
        : raw.max_reference_age_days === null
          ? null
          : DEFAULT_REFERENCE_SETTINGS.max_reference_age_days,
    load_party: raw.load_party !== false,
    load_warehouse: raw.load_warehouse !== false,
    load_material_lines: raw.load_material_lines !== false,
    load_cost_center: raw.load_cost_center !== false,
    load_unit_price: raw.load_unit_price !== false,
    load_payment_terms: raw.load_payment_terms !== false,
    load_receipt_no: Boolean(raw.load_receipt_no),
    load_invoice_date: Boolean(raw.load_invoice_date),
  };
}

/** أنماط المرتجع تُفضّل فاتورة مصدر من النوع المعاكس */
export function referenceKindForPattern(commercialKind: string): string | null {
  switch (commercialKind) {
    case "return_sale":
      return "sale";
    case "return_purchase":
      return "purchase";
    default:
      return null;
  }
}

export function referenceSettingsActive(
  settings: InvoiceReferenceSettings,
  isReturn: boolean,
): boolean {
  return settings.enabled || isReturn;
}
