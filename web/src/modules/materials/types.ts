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
  max_stock: number;
  barcode: string | null;
  manufacturer: string | null;
  supplier_name: string | null;
  color: string | null;
  size: string | null;
  weight: number | null;
  notes: string | null;
  has_expiry_date: boolean;
  expiry_days: number | null;
  require_expiry_on_inbound: boolean;
  require_expiry_on_outbound: boolean;
  has_serial_number: boolean;
  require_serial_on_inbound: boolean;
  require_serial_on_outbound: boolean;
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
  max_stock: number;
  barcode: string;
  manufacturer: string;
  supplier_name: string;
  color: string;
  size: string;
  weight: number | null;
  notes: string;
  has_expiry_date: boolean;
  expiry_days: number | null;
  require_expiry_on_inbound: boolean;
  require_expiry_on_outbound: boolean;
  has_serial_number: boolean;
  require_serial_on_inbound: boolean;
  require_serial_on_outbound: boolean;
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
  purchase_price: number | null;
  sale_price: number | null;
  semi_wholesale_price: number | null;
  wholesale_price: number | null;
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
  purchase_price: number | null;
  sale_price: number | null;
  semi_wholesale_price: number | null;
  wholesale_price: number | null;
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
