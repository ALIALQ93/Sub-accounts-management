"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import { branchApi } from "@/modules/branches/services/branch-api";
import { inventorySettingsApi } from "@/modules/materials/services/inventory-settings-api";
import { warehouseApi } from "@/modules/materials/services/warehouse-api";
import { settingsApi } from "@/modules/settings/services/settings-api";
import type {
  CompanySettings,
  CompanySettingsFormValues,
  UserProfile,
} from "@/modules/settings/types";
import type {
  RootAccountSummary,
  SetupAdminForm,
  SetupBranchForm,
  SetupWizardState,
} from "@/modules/setup/types";
import { EMPTY_COMPANY_FORM, EMPTY_INVENTORY_FORM } from "@/modules/setup/types";
import type { InventorySettingsFormValues } from "@/modules/materials/types";

function throwIfError(error: { message?: string } | null): void {
  if (error) {
    throw new Error(error.message || "حدث خطأ غير متوقع.");
  }
}

export const setupApi = {
  async getSetupFlag(): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("company_settings")
      .select("is_setup_complete")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      // عمود ناقص أو خطأ مؤقت — لا نُقفل النظام
      return true;
    }

    if (data && typeof (data as { is_setup_complete?: unknown }).is_setup_complete === "boolean") {
      return (data as { is_setup_complete: boolean }).is_setup_complete;
    }

    return true;
  },

  async loadWizardState(): Promise<SetupWizardState> {
    const [company, inventory, branches, warehouses, profile, rootAccounts] =
      await Promise.all([
        settingsApi.getCompanySettings(),
        inventorySettingsApi.getSettings(),
        branchApi.listBranches(),
        warehouseApi.listWarehouses(),
        settingsApi.getCurrentProfile(),
        this.listRootAccounts(),
      ]);

    const head =
      branches.find((branch) => branch.is_head_office) ?? branches[0] ?? null;
    const warehouse =
      (head
        ? warehouses.find((row) => row.branch_id === head.id)
        : null) ??
      warehouses[0] ??
      null;

    return {
      company: {
        legal_name_ar: company.legal_name_ar === "شركتي" ? "" : company.legal_name_ar,
        legal_name_en: company.legal_name_en ?? "",
        tax_number: company.tax_number ?? "",
        address: company.address ?? "",
        phone: company.phone ?? "",
        email: company.email ?? "",
        fiscal_year_start_month: company.fiscal_year_start_month,
        base_currency_id: company.base_currency_id ?? "",
        logo_url: company.logo_url ?? "",
      },
      admin: {
        full_name_ar: profile?.full_name_ar ?? "",
        full_name_en: profile?.full_name_en ?? "",
      },
      adminEmail: profile?.email ?? "",
      branch: {
        branch_code: head?.branch_code ?? "MAIN",
        branch_name_ar: head?.name_ar ?? "الفرع الرئيسي",
        warehouse_code: warehouse?.warehouse_code ?? "WH-MAIN",
        warehouse_name_ar: warehouse?.name_ar ?? "المستودع الرئيسي",
      },
      branchId: head?.id ?? null,
      warehouseId: warehouse?.id ?? null,
      inventory: {
        inventory_method: inventory.inventory_method ?? "",
        costing_method: inventory.costing_method ?? "",
        cost_per_warehouse: inventory.cost_per_warehouse,
        cost_per_cost_center: inventory.cost_per_cost_center,
        cost_per_expiry_date: inventory.cost_per_expiry_date ?? false,
        cost_per_serial_number: inventory.cost_per_serial_number ?? false,
      },
      accountsAccepted: false,
      rootAccounts,
    };
  },

  async listRootAccounts(): Promise<RootAccountSummary[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("accounts")
      .select("account_code, name_ar")
      .is("parent_id", null)
      .order("account_code", { ascending: true });
    throwIfError(error);
    return (data ?? []) as RootAccountSummary[];
  },

  async saveCompany(values: CompanySettingsFormValues): Promise<CompanySettings> {
    return settingsApi.updateCompanySettings(values);
  },

  async saveAdmin(profileId: string, values: SetupAdminForm): Promise<UserProfile> {
    if (!values.full_name_ar.trim()) {
      throw new Error("اسم المدير بالعربية مطلوب.");
    }
    return settingsApi.updateProfile(profileId, {
      full_name_ar: values.full_name_ar.trim(),
      full_name_en: values.full_name_en.trim() || null,
    });
  },

  async saveBranchAndWarehouse(
    branchId: string | null,
    warehouseId: string | null,
    values: SetupBranchForm,
  ): Promise<{ branchId: string; warehouseId: string }> {
    if (!values.branch_code.trim() || !values.branch_name_ar.trim()) {
      throw new Error("رمز الفرع واسمه مطلوبان.");
    }
    if (!values.warehouse_code.trim() || !values.warehouse_name_ar.trim()) {
      throw new Error("رمز المستودع واسمه مطلوبان.");
    }

    let nextBranchId = branchId;
    if (nextBranchId) {
      await branchApi.updateBranch(nextBranchId, {
        branch_code: values.branch_code,
        name_ar: values.branch_name_ar,
        name_en: "",
        is_active: true,
        is_head_office: true,
        address: "",
        phone: "",
      });
    } else {
      const created = await branchApi.createBranch({
        branch_code: values.branch_code,
        name_ar: values.branch_name_ar,
        name_en: "",
        is_active: true,
        is_head_office: true,
        address: "",
        phone: "",
      });
      nextBranchId = created.id;
    }

    let nextWarehouseId = warehouseId;
    if (nextWarehouseId) {
      await warehouseApi.updateWarehouse(nextWarehouseId, {
        warehouse_code: values.warehouse_code,
        name_ar: values.warehouse_name_ar,
        name_en: "",
        branch_id: nextBranchId,
        is_active: true,
      });
    } else {
      const created = await warehouseApi.createWarehouse({
        warehouse_code: values.warehouse_code,
        name_ar: values.warehouse_name_ar,
        name_en: "",
        branch_id: nextBranchId,
        is_active: true,
      });
      nextWarehouseId = created.id;
    }

    return { branchId: nextBranchId, warehouseId: nextWarehouseId };
  },

  async saveInventory(values: InventorySettingsFormValues) {
    if (!values.inventory_method || !values.costing_method) {
      throw new Error("طريقة الجرد ونظام التكلفة مطلوبان.");
    }
    return inventorySettingsApi.updateSettings(values);
  },

  async completeSetup(): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("company_settings")
      .update({
        is_setup_complete: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    throwIfError(error);
  },
};

export function emptyWizardState(): SetupWizardState {
  return {
    company: { ...EMPTY_COMPANY_FORM },
    admin: { full_name_ar: "", full_name_en: "" },
    adminEmail: "",
    branch: {
      branch_code: "MAIN",
      branch_name_ar: "الفرع الرئيسي",
      warehouse_code: "WH-MAIN",
      warehouse_name_ar: "المستودع الرئيسي",
    },
    branchId: null,
    warehouseId: null,
    inventory: { ...EMPTY_INVENTORY_FORM },
    accountsAccepted: false,
    rootAccounts: [],
  };
}
