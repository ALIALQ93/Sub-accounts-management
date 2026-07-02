export function formatVoucherNo(
  prefix: string,
  includeYear: boolean,
  year: number,
  sequence: number,
  padding: number,
): string {
  const seq = String(sequence).padStart(padding, "0");
  return includeYear ? `${prefix}-${year}-${seq}` : `${prefix}-${seq}`;
}

export function computeNextSequencePreview(
  lastNumber: number,
  sequenceYear: number,
  includeYear: boolean,
  currentYear = new Date().getFullYear(),
): number {
  if (includeYear && sequenceYear !== currentYear) {
    return 1;
  }
  return lastNumber + 1;
}
