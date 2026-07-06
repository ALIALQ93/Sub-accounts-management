export function formatInvoiceNo(
  prefix: string,
  includeYear: boolean,
  year: number,
  sequence: number,
  padding: number,
): string {
  const seq = String(sequence).padStart(padding, "0");
  return includeYear ? `${prefix}-${year}-${seq}` : `${prefix}-${seq}`;
}
