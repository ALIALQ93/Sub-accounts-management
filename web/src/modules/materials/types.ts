export interface Material {
  id: string;
  material_code: string;
  name_ar: string;
  name_en: string | null;
  category_id: string | null;
  purchase_price: number;
  sale_price: number;
  inventory_account_id: string | null;
  min_stock: number;
  is_active: boolean;
}

export interface MaterialListItem extends Material {
  category_code?: string | null;
  category_name_ar?: string | null;
}

export interface MaterialFormValues {
  material_code: string;
  name_ar: string;
  name_en: string;
  category_id: string;
  purchase_price: number;
  sale_price: number;
  inventory_account_id: string;
  min_stock: number;
  is_active: boolean;
}

export interface MaterialUnit {
  id: string;
  material_id: string;
  unit_code: string;
  name_ar: string;
  name_en: string | null;
  is_base_unit: boolean;
  factor_to_base: number;
  is_active: boolean;
  sort_order: number;
}

export interface MaterialUnitFormValues {
  id?: string;
  unit_code: string;
  name_ar: string;
  name_en: string;
  is_base_unit: boolean;
  factor_to_base: number;
  is_active: boolean;
}

export interface MaterialCategory {
  id: string;
  category_code: string;
  name_ar: string;
  name_en: string | null;
  parent_id: string | null;
  is_active: boolean;
}

export interface MaterialCategoryFormValues {
  category_code: string;
  name_ar: string;
  name_en: string;
  parent_id: string;
  is_active: boolean;
}

export interface Warehouse {
  id: string;
  warehouse_code: string;
  name_ar: string;
  name_en: string | null;
  branch_id: string;
  is_active: boolean;
  branch_code?: string;
  branch_name_ar?: string;
}

export interface WarehouseFormValues {
  warehouse_code: string;
  name_ar: string;
  name_en: string;
  branch_id: string;
  is_active: boolean;
}

export type InventoryMethod = "periodic" | "perpetual";
export type CostingMethod =
  | "weighted_avg"
  | "fifo"
  | "standard"
  | "last_purchase";

export interface CompanyInventorySettings {
  id: number;
  inventory_method: InventoryMethod | null;
  costing_method: CostingMethod | null;
  cost_per_warehouse: boolean;
  cost_per_cost_center: boolean;
  track_quantity_on_movement: boolean;
  foundation_locked: boolean;
  foundation_locked_at: string | null;
  first_posted_inventory_at: string | null;
}

export interface InventorySettingsFormValues {
  inventory_method: InventoryMethod | "";
  costing_method: CostingMethod | "";
  cost_per_warehouse: boolean;
  cost_per_cost_center: boolean;
}
