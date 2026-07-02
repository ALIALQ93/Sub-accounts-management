export interface PartySettings {
  id: number;
  customer_parent_account_id: string | null;
  vendor_parent_account_id: string | null;
}

export interface PartyFormValues {
  name_ar: string;
  phone: string;
  email: string;
  parent_account_id: string;
}

export type PartyKind = "customer" | "vendor";
