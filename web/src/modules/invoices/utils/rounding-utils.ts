export type RoundingMode = "nearest" | "up" | "down";
export type RoundingTarget = "invoice_total" | "line_amount" | "both";

export interface RoundingSettings {
  enabled: boolean;
  target: RoundingTarget | null;
  mode: RoundingMode | null;
  step: number | null;
}

export function roundAmount(
  amount: number,
  step: number,
  mode: RoundingMode,
): number {
  if (!Number.isFinite(amount) || step <= 0) return amount;
  const ratio = amount / step;
  if (mode === "up") return Math.ceil(ratio - 1e-9) * step;
  if (mode === "down") return Math.floor(ratio + 1e-9) * step;
  return Math.round(ratio) * step;
}

export function applyRounding(
  amount: number,
  settings: RoundingSettings,
  scope: "line" | "invoice",
): number {
  if (!settings.enabled || !settings.mode) return amount;
  const target = settings.target ?? "invoice_total";
  const applies =
    target === "both" ||
    (target === "line_amount" && scope === "line") ||
    (target === "invoice_total" && scope === "invoice");
  if (!applies) return amount;
  const step = settings.step ?? 1;
  return roundAmount(amount, step, settings.mode);
}

export function roundingDelta(
  original: number,
  rounded: number,
): number {
  return Math.round((rounded - original) * 100) / 100;
}
