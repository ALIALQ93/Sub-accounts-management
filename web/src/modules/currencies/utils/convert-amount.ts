export function convertAmount(
  amount: number,
  fromRate: number,
  toRate: number,
): number {
  if (fromRate <= 0 || toRate <= 0) return amount;
  return amount * (fromRate / toRate);
}

export function formatCurrencyAmount(
  amount: number,
  decimalPlaces: number,
  symbol?: string,
): string {
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
  return symbol ? `${formatted} ${symbol}` : formatted;
}
