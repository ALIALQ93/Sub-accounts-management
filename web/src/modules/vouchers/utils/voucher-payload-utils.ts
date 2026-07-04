import type { VoucherHeader } from "@/modules/vouchers/types";

const UUID_FIELDS = new Set([
  "customer_id",
  "vendor_id",
  "currency_id",
  "cost_center_id",
]);

const VOUCHER_HEADER_WRITE_FIELDS = [
  "voucher_no",
  "voucher_type",
  "settlement_mode",
  "voucher_date",
  "description",
  "status",
  "customer_id",
  "vendor_id",
  "currency_id",
  "cost_center_id",
  "exchange_rate",
] as const satisfies ReadonlyArray<keyof VoucherHeader>;

function normalizeUuidField(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value as string;
}

export function sanitizeVoucherHeaderPayload(
  payload: Partial<VoucherHeader>,
): Partial<VoucherHeader> {
  const sanitized: Partial<VoucherHeader> = {};

  for (const field of VOUCHER_HEADER_WRITE_FIELDS) {
    if (!(field in payload) || payload[field] === undefined) continue;

    const value = payload[field];
    if (UUID_FIELDS.has(field)) {
      sanitized[field] = normalizeUuidField(value) as never;
      continue;
    }

    sanitized[field] = value as never;
  }

  return sanitized;
}
