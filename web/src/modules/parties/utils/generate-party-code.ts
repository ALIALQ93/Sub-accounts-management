import type { Customer, Vendor } from "@/modules/vouchers/types";

function parsePartyCodeNumber(code: string, prefix: string): number | null {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, "i");
  const match = code.trim().match(pattern);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function generateCodeFromExisting(
  existingCodes: string[],
  prefix: string,
): string {
  const numbers = existingCodes
    .map((code) => parsePartyCodeNumber(code, prefix))
    .filter((value): value is number => value !== null);

  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  const next = max + 1;
  const width = Math.max(3, String(next).length);

  let candidate = `${prefix}-${String(next).padStart(width, "0")}`;
  const upperExisting = new Set(existingCodes.map((code) => code.toUpperCase()));

  while (upperExisting.has(candidate.toUpperCase())) {
    const parsed = parsePartyCodeNumber(candidate, prefix);
    if (parsed === null) break;
    candidate = `${prefix}-${String(parsed + 1).padStart(width, "0")}`;
  }

  return candidate;
}

export function generateCustomerCode(customers: Customer[]): string {
  return generateCodeFromExisting(
    customers.map((customer) => customer.customer_code),
    "CUST",
  );
}

export function generateVendorCode(vendors: Vendor[]): string {
  return generateCodeFromExisting(
    vendors.map((vendor) => vendor.vendor_code),
    "VEND",
  );
}

export function previewCustomerCode(customers: Customer[]): string {
  return generateCustomerCode(customers);
}

export function previewVendorCode(vendors: Vendor[]): string {
  return generateVendorCode(vendors);
}
