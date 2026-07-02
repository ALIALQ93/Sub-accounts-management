import type { CurrencyRateChangeSource } from "@/modules/currencies/types";

const SOURCE_LABELS: Record<CurrencyRateChangeSource, string> = {
  manual: "تعديل يدوي",
  base_change: "تغيير العملة الأساسية",
  initial: "سعر ابتدائي",
};

export function getCurrencyRateChangeSourceLabel(
  source: CurrencyRateChangeSource,
): string {
  return SOURCE_LABELS[source] ?? source;
}
