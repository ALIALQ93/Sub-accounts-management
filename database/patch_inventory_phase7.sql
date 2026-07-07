-- =============================================================================
-- patch_inventory_phase7.sql — تقرير مبيعات تفصيلي (أسطر فواتير)
-- =============================================================================
-- يتطلب: patch_post_invoice.sql
-- =============================================================================

drop function if exists public.get_sales_lines_report(date, date, uuid, uuid, uuid, uuid, boolean) cascade;

create or replace function public.get_sales_lines_report(
  p_from_date date default null,
  p_to_date date default null,
  p_customer_id uuid default null,
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
  customer_name_ar varchar,
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
    coalesce(c.name_ar, '—')::varchar as customer_name_ar,
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
  left join public.customers c on c.id = i.customer_id
  where i.status = 'posted'
    and (
      ip.commercial_kind = 'sale'
      or (
        coalesce(p_include_returns, true)
        and ip.commercial_kind = 'return_sale'
      )
    )
    and (p_from_date is null or i.invoice_date >= p_from_date)
    and (p_to_date is null or i.invoice_date <= p_to_date)
    and (p_customer_id is null or i.customer_id = p_customer_id)
    and (p_material_id is null or iml.material_id = p_material_id)
    and (p_warehouse_id is null or iml.warehouse_id = p_warehouse_id)
    and (p_branch_id is null or iml.branch_id = p_branch_id)
  order by i.invoice_date desc, i.invoice_no, iml.line_no;
$$;

comment on function public.get_sales_lines_report is
  'أسطر فواتير مبيعات/مرتجع مبيعات المرحّلة';
