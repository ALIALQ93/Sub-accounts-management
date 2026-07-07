-- =============================================================================
-- patch_inventory_phase6.sql — تقرير مشتريات تفصيلي (أسطر فواتير)
-- =============================================================================
-- يتطلب: patch_post_invoice.sql
-- =============================================================================

drop function if exists public.get_purchase_lines_report(date, date, uuid, uuid, uuid, uuid, boolean) cascade;

create or replace function public.get_purchase_lines_report(
  p_from_date date default null,
  p_to_date date default null,
  p_vendor_id uuid default null,
  p_material_id uuid default null,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null,
  p_include_returns boolean default true
)
returns table (
  invoice_id uuid,
  invoice_no varchar,
  invoice_date date,
  commercial_kind varchar,
  vendor_name_ar varchar,
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  warehouse_code varchar,
  branch_code varchar,
  quantity_base numeric,
  unit_price numeric,
  discount_amount numeric,
  line_amount numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id as invoice_id,
    i.invoice_no,
    i.invoice_date,
    ip.commercial_kind,
    coalesce(v.name_ar, '—')::varchar as vendor_name_ar,
    m.id as material_id,
    m.material_code,
    m.name_ar as material_name_ar,
    w.warehouse_code,
    b.branch_code,
    iml.quantity_base,
    iml.unit_price,
    coalesce(iml.discount_amount, 0)::numeric(18, 2) as discount_amount,
    iml.line_amount
  from public.invoices i
  inner join public.invoice_patterns ip on ip.id = i.pattern_id
  inner join public.invoice_material_lines iml on iml.invoice_id = i.id
  inner join public.materials m on m.id = iml.material_id
  inner join public.warehouses w on w.id = iml.warehouse_id
  inner join public.branches b on b.id = iml.branch_id
  left join public.vendors v on v.id = i.vendor_id
  where i.status = 'posted'
    and (
      ip.commercial_kind in ('purchase', 'opening_stock')
      or (
        coalesce(p_include_returns, true)
        and ip.commercial_kind = 'return_purchase'
      )
    )
    and (p_from_date is null or i.invoice_date >= p_from_date)
    and (p_to_date is null or i.invoice_date <= p_to_date)
    and (p_vendor_id is null or i.vendor_id = p_vendor_id)
    and (p_material_id is null or iml.material_id = p_material_id)
    and (p_warehouse_id is null or iml.warehouse_id = p_warehouse_id)
    and (p_branch_id is null or iml.branch_id = p_branch_id)
  order by i.invoice_date desc, i.invoice_no, iml.line_no;
$$;

comment on function public.get_purchase_lines_report is
  'أسطر فواتير مشتريات/مرتجع مشتريات/بضاعة أول المدة المرحّلة';
