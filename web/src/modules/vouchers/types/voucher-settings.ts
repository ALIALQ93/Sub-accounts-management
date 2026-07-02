import type { VoucherType } from "@/modules/vouchers/types";

export interface VoucherSettings {
  auto_number_enabled: boolean;
  allow_manual_override: boolean;
}

export interface VoucherNumberSequence {
  voucher_type: VoucherType;
  prefix: string;
  padding: number;
  include_year: boolean;
  last_number: number;
  sequence_year: number;
}

export const DEFAULT_VOUCHER_SETTINGS: VoucherSettings = {
  auto_number_enabled: true,
  allow_manual_override: false,
};

export const DEFAULT_VOUCHER_SEQUENCES: VoucherNumberSequence[] = [
  {
    voucher_type: "receipt",
    prefix: "RCP",
    padding: 4,
    include_year: true,
    last_number: 0,
    sequence_year: new Date().getFullYear(),
  },
  {
    voucher_type: "payment",
    prefix: "PAY",
    padding: 4,
    include_year: true,
    last_number: 0,
    sequence_year: new Date().getFullYear(),
  },
  {
    voucher_type: "settlement",
    prefix: "SET",
    padding: 4,
    include_year: true,
    last_number: 0,
    sequence_year: new Date().getFullYear(),
  },
];
