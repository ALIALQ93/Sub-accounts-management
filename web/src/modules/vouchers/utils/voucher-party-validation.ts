import type { Customer, Vendor } from "@/modules/vouchers/types";

export function validateActiveCustomer(
  customerId: string,
  customers: Customer[],
): string | null {
  if (!customerId) return null;

  const customer = customers.find((item) => item.id === customerId);
  if (!customer) {
    return "العميل المحدد غير موجود.";
  }
  if (!customer.is_active) {
    return "العميل المحدد غير نشط. اختر عميلاً نشطاً أو أزل الربط.";
  }

  return null;
}

export function validateActiveVendor(
  vendorId: string,
  vendors: Vendor[],
): string | null {
  if (!vendorId) return null;

  const vendor = vendors.find((item) => item.id === vendorId);
  if (!vendor) {
    return "المورد المحدد غير موجود.";
  }
  if (!vendor.is_active) {
    return "المورد المحدد غير نشط. اختر مورداً نشطاً أو أزل الربط.";
  }

  return null;
}
