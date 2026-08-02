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
  BusinessNature,
  CoaTemplateAccountPreview,
  CoaTemplateSummary,
  InvoicePatternCatalogItem,
  RootAccountSummary,
  SchemaSetupStatus,
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

function mapSchemaStatus(raw: Record<string, unknown> | null): SchemaSetupStatus {
  const checksRaw = Array.isArray(raw?.checks) ? raw.checks : [];
  const summaryRaw =
    raw?.summary && typeof raw.summary === "object"
      ? (raw.summary as Record<string, unknown>)
      : null;

  return {
    ok: Boolean(raw?.ok),
    source: String(raw?.source ?? "setup_all"),
    message_ar: String(
      raw?.message_ar ??
        "تعذّر قراءة حالة المخطط — تأكد من تشغيل database/setup_all.sql",
    ),
    checks: checksRaw.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        key: String(row.key ?? ""),
        label_ar: String(row.label_ar ?? row.key ?? ""),
        ok: Boolean(row.ok),
      };
    }),
    summary: summaryRaw
      ? {
          is_setup_complete: Boolean(summaryRaw.is_setup_complete),
          company_name_ar: String(summaryRaw.company_name_ar ?? ""),
          root_accounts: Number(summaryRaw.root_accounts ?? 0),
          branches: Number(summaryRaw.branches ?? 0),
          warehouses: Number(summaryRaw.warehouses ?? 0),
          currencies: Number(summaryRaw.currencies ?? 0),
          materials: Number(summaryRaw.materials ?? 0),
          posted_invoices: Number(summaryRaw.posted_invoices ?? 0),
          inventory_movements: Number(summaryRaw.inventory_movements ?? 0),
        }
      : null,
  };
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
      return true;
    }

    if (data && typeof (data as { is_setup_complete?: unknown }).is_setup_complete === "boolean") {
      return (data as { is_setup_complete: boolean }).is_setup_complete;
    }

    return true;
  },

  async getSchemaSetupStatus(): Promise<SchemaSetupStatus> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("get_schema_setup_status");
    if (error) {
      return {
        ok: false,
        source: "setup_all",
        checks: [],
        message_ar:
          "دالة التحقق غير متوفرة. في مرحلة البناء شغّل database/setup_all.sql ثم أعد المحاولة.",
      };
    }
    return mapSchemaStatus((data ?? null) as Record<string, unknown> | null);
  },

  async listCoaTemplates(): Promise<CoaTemplateSummary[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("coa_templates")
      .select("id, code, name_ar, name_en, standard, supports_natures, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    throwIfError(error);
    return (data ?? []).map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name_ar: String(row.name_ar),
      name_en: (row.name_en as string | null) ?? null,
      standard: String(row.standard),
      supports_natures: Array.isArray(row.supports_natures)
        ? (row.supports_natures as string[])
        : [],
      sort_order: Number(row.sort_order ?? 0),
    }));
  },

  async listTemplateAccounts(templateId: string): Promise<CoaTemplateAccountPreview[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("coa_template_accounts")
      .select("code, parent_code, name_ar, level, is_postable")
      .eq("template_id", templateId)
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true });
    throwIfError(error);
    return (data ?? []).map((row) => ({
      code: String(row.code),
      parent_code: (row.parent_code as string | null) ?? null,
      name_ar: String(row.name_ar),
      level: Number(row.level ?? 1),
      is_postable: Boolean(row.is_postable),
    }));
  },

  async applyCoaTemplate(templateCode: string, nature: BusinessNature) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("apply_coa_template", {
      p_template_code: templateCode,
      p_nature: nature,
    });
    throwIfError(error);
    return data as { ok?: boolean; accounts_created?: number; roles?: string[] };
  },

  async listPatternCatalog(): Promise<InvoicePatternCatalogItem[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("invoice_pattern_catalog")
      .select(
        "id, code, name_ar, name_en, direction, commercial_kind, is_return, is_opening_stock, sort_order, paired_catalog_code",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    throwIfError(error);
    return (data ?? []) as InvoicePatternCatalogItem[];
  },

  async applySelectedInvoicePatterns(codes: string[]) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("apply_selected_invoice_patterns", {
      p_codes: codes,
    });
    throwIfError(error);
    return data as { ok?: boolean; created?: number };
  },

  async loadWizardState(): Promise<SetupWizardState> {
    const [
      company,
      inventory,
      branches,
      warehouses,
      profile,
      rootAccounts,
      schemaStatus,
      coaTemplates,
      patternCatalog,
    ] = await Promise.all([
      settingsApi.getCompanySettings(),
      inventorySettingsApi.getSettings(),
      branchApi.listBranches(),
      warehouseApi.listWarehouses(),
      settingsApi.getCurrentProfile(),
      this.listRootAccounts(),
      this.getSchemaSetupStatus(),
      this.listCoaTemplates(),
      this.listPatternCatalog(),
    ]);

    const head =
      branches.find((branch) => branch.is_head_office) ?? branches[0] ?? null;
    const warehouse =
      (head
        ? warehouses.find((row) => row.branch_id === head.id)
        : null) ??
      warehouses[0] ??
      null;

    const nature = (company.business_nature ?? "") as BusinessNature | "";
    const templateCode =
      coaTemplates.find((t) => t.id === company.coa_template_id)?.code ??
      coaTemplates[0]?.code ??
      "simplified";

    let templatePreview: CoaTemplateAccountPreview[] = [];
    const selectedTemplate = coaTemplates.find((t) => t.code === templateCode);
    if (selectedTemplate) {
      templatePreview = await this.listTemplateAccounts(selectedTemplate.id);
    }

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
        manufacturing_produce_expiry_policy:
          inventory.manufacturing_produce_expiry_policy ?? "min_component",
      },
      businessNature: nature,
      selectedCoaTemplateCode: templateCode,
      coaApplied: Boolean(company.coa_template_id),
      coaTemplates,
      templatePreview,
      rootAccounts,
      patternCatalog,
      selectedPatternCodes: [],
      patternsApplied: false,
      schemaStatus,
      schemaAccepted: schemaStatus.ok,
    };
  },

  async listRootAccounts(): Promise<RootAccountSummary[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("accounts")
      .select("code, name_ar")
      .is("parent_id", null)
      .order("code", { ascending: true });
    throwIfError(error);
    return (data ?? []).map((row) => ({
      code: String(row.code),
      name_ar: String(row.name_ar),
    }));
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
    businessNature: "",
    selectedCoaTemplateCode: "simplified",
    coaApplied: false,
    coaTemplates: [],
    templatePreview: [],
    rootAccounts: [],
    patternCatalog: [],
    selectedPatternCodes: [],
    patternsApplied: false,
    schemaStatus: null,
    schemaAccepted: false,
  };
}
