"use client";

import { createAccountWithGeneratedCode } from "@/modules/accounts/utils/create-account-with-code";
import type { PartyFormValues, PartySettings } from "@/modules/parties/types";
import {
  generateCustomerCode,
  generateVendorCode,
} from "@/modules/parties/utils/generate-party-code";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account, Customer, Vendor } from "@/modules/vouchers/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) {
    throw new Error(error.message || "حدث خطأ غير متوقع من قاعدة البيانات.");
  }
}

const DEFAULT_PARTY_SETTINGS: PartySettings = {
  id: 1,
  customer_parent_account_id: null,
  vendor_parent_account_id: null,
};

async function createLinkedAccount(
  parentAccountId: string,
  partyName: string,
  allAccounts: Account[],
): Promise<Account> {
  const parent = allAccounts.find((account) => account.id === parentAccountId);
  if (!parent) {
    throw new Error("حساب الأب غير موجود.");
  }
  if (!parent.currency_id) {
    throw new Error("حساب الأب لا يملك عملة — اختر حساباً آخر.");
  }

  return createAccountWithGeneratedCode(parent, allAccounts, {
    name_ar: partyName.trim(),
    name_en: null,
    currency_id: parent.currency_id,
    is_postable: true,
    is_active: true,
  });
}

export const partyApi = {
  async getPartySettings(): Promise<PartySettings> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("party_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    throwIfSupabaseError(error);

    if (!data) {
      return DEFAULT_PARTY_SETTINGS;
    }

    return data as PartySettings;
  },

  async updatePartySettings(
    payload: Partial<
      Pick<
        PartySettings,
        "customer_parent_account_id" | "vendor_parent_account_id"
      >
    >,
  ): Promise<PartySettings> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("party_settings")
      .upsert({ id: 1, ...payload }, { onConflict: "id" })
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return data as PartySettings;
  },

  async createCustomerWithAccount(
    values: PartyFormValues,
    customers: Customer[],
    allAccounts: Account[],
  ): Promise<Customer> {
    if (!values.name_ar.trim()) {
      throw new Error("اسم العميل مطلوب.");
    }
    if (!values.parent_account_id) {
      throw new Error("يجب اختيار حساب أب لإنشاء حساب الذمم.");
    }

    const account = await createLinkedAccount(
      values.parent_account_id,
      values.name_ar,
      allAccounts,
    );

    const customerCode = generateCustomerCode(customers);

    return voucherApi.createCustomer({
      customer_code: customerCode,
      name_ar: values.name_ar.trim(),
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      receivable_account_id: account.id,
      is_active: true,
    });
  },

  async updateCustomerWithAccountSync(
    customer: Customer,
    values: Omit<PartyFormValues, "parent_account_id">,
  ): Promise<Customer> {
    if (!values.name_ar.trim()) {
      throw new Error("اسم العميل مطلوب.");
    }

    const updated = await voucherApi.updateCustomer(customer.id, {
      name_ar: values.name_ar.trim(),
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
    });

    await voucherApi.updateAccount(customer.receivable_account_id, {
      name_ar: values.name_ar.trim(),
    });

    return updated;
  },

  async createVendorWithAccount(
    values: PartyFormValues,
    vendors: Vendor[],
    allAccounts: Account[],
  ): Promise<Vendor> {
    if (!values.name_ar.trim()) {
      throw new Error("اسم المورد مطلوب.");
    }
    if (!values.parent_account_id) {
      throw new Error("يجب اختيار حساب أب لإنشاء حساب الذمم.");
    }

    const account = await createLinkedAccount(
      values.parent_account_id,
      values.name_ar,
      allAccounts,
    );

    const vendorCode = generateVendorCode(vendors);

    return voucherApi.createVendor({
      vendor_code: vendorCode,
      name_ar: values.name_ar.trim(),
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      payable_account_id: account.id,
      is_active: true,
    });
  },

  async updateVendorWithAccountSync(
    vendor: Vendor,
    values: Omit<PartyFormValues, "parent_account_id">,
  ): Promise<Vendor> {
    if (!values.name_ar.trim()) {
      throw new Error("اسم المورد مطلوب.");
    }

    const updated = await voucherApi.updateVendor(vendor.id, {
      name_ar: values.name_ar.trim(),
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
    });

    await voucherApi.updateAccount(vendor.payable_account_id, {
      name_ar: values.name_ar.trim(),
    });

    return updated;
  },
};
