-- =============================================================================
-- patch_reports_audit_fix.sql — إصلاحات تدقيق التقارير (2026-07-26)
-- =============================================================================
-- 1) get_cogs_report: إيراد حقيقي من invoice_material_lines.line_amount
-- 2) get_inventory_movement_ledger: رصيد جاري يبدأ من الرصيد قبل فترة الفلتر
-- =============================================================================

drop function if exists public.get_cogs_report(date, date, uuid, uuid, uuid, varchar) cascade;

create or replace function public.get_cogs_report(
  p_from_date date default null,
  p_to_date date default null,
  p_material_id uuid default null,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null,
  p_group_by varchar default 'material'
)
returns table (
  group_key varchar,
  invoice_id uuid,
  invoice_no varchar,
  invoice_date date,
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  warehouse_code varchar,
  branch_code varchar,
  sale_quantity_base numeric,
  return_quantity_base numeric,
  sales_amount numeric,
  cogs_amount numeric,
  return_cogs_amount numeric,
  net_cogs numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select
      im.movement_kind,
      im.quantity_base_delta,
      im.unit_cost,
      im.total_cost,
      coalesce(iml.line_amount, 0) as line_amount,
      im.material_id,
      im.source_id as invoice_id,
      m.material_code,
      m.name_ar as material_name_ar,
      w.warehouse_code,
      b.branch_code,
      i.invoice_no,
      i.invoice_date
    from public.inventory_movements im
    inner join public.materials m on m.id = im.material_id
    inner join public.warehouses w on w.id = im.warehouse_id
    inner join public.branches b on b.id = im.branch_id
    left join public.invoices i
      on im.source_type = 'invoice' and i.id = im.source_id
    left join public.invoice_material_lines iml
      on im.source_type = 'invoice' and iml.id = im.source_line_id
    where im.movement_kind in ('sale', 'return_sale')
      and (p_from_date is null or im.movement_date >= p_from_date)
      and (p_to_date is null or im.movement_date <= p_to_date)
      and (p_material_id is null or im.material_id = p_material_id)
      and (p_warehouse_id is null or im.warehouse_id = p_warehouse_id)
      and (p_branch_id is null or im.branch_id = p_branch_id)
  )
  select
    case
      when coalesce(p_group_by, 'material') = 'invoice' then
        coalesce(max(s.invoice_no), max(s.invoice_id::text))
      else max(s.material_code)
    end::varchar as group_key,
    case
      when coalesce(p_group_by, 'material') = 'invoice' then (max(s.invoice_id::text))::uuid
      else null::uuid
    end as invoice_id,
    case
      when coalesce(p_group_by, 'material') = 'invoice' then max(s.invoice_no)
      else null::varchar
    end as invoice_no,
    case
      when coalesce(p_group_by, 'material') = 'invoice' then max(s.invoice_date)
      else null::date
    end as invoice_date,
    case
      when coalesce(p_group_by, 'material') = 'material' then (max(s.material_id::text))::uuid
      else null::uuid
    end as material_id,
    case
      when coalesce(p_group_by, 'material') = 'material' then max(s.material_code)
      else null::varchar
    end as material_code,
    case
      when coalesce(p_group_by, 'material') = 'material' then max(s.material_name_ar)
      else null::varchar
    end as material_name_ar,
    case
      when coalesce(p_group_by, 'material') = 'material' then max(s.warehouse_code)
      else null::varchar
    end as warehouse_code,
    case
      when coalesce(p_group_by, 'material') = 'material' then max(s.branch_code)
      else null::varchar
    end as branch_code,
    coalesce(
      sum(case when s.movement_kind = 'sale' then abs(s.quantity_base_delta) else 0 end),
      0
    )::numeric(18, 6) as sale_quantity_base,
    coalesce(
      sum(case when s.movement_kind = 'return_sale' then s.quantity_base_delta else 0 end),
      0
    )::numeric(18, 6) as return_quantity_base,
    coalesce(
      sum(
        case
          when s.movement_kind = 'sale' then coalesce(s.line_amount, 0)
          when s.movement_kind = 'return_sale' then -coalesce(s.line_amount, 0)
          else 0
        end
      ),
      0
    )::numeric(18, 2) as sales_amount,
    coalesce(
      sum(
        case
          when s.movement_kind = 'sale' then
            round((abs(s.quantity_base_delta) * coalesce(s.unit_cost, 0))::numeric, 2)
          else 0
        end
      ),
      0
    )::numeric(18, 2) as cogs_amount,
    coalesce(
      sum(
        case
          when s.movement_kind = 'return_sale' then
            round((s.quantity_base_delta * coalesce(s.unit_cost, 0))::numeric, 2)
          else 0
        end
      ),
      0
    )::numeric(18, 2) as return_cogs_amount,
    coalesce(
      sum(
        case
          when s.movement_kind = 'sale' then
            round((abs(s.quantity_base_delta) * coalesce(s.unit_cost, 0))::numeric, 2)
          when s.movement_kind = 'return_sale' then
            -round((s.quantity_base_delta * coalesce(s.unit_cost, 0))::numeric, 2)
          else 0
        end
      ),
      0
    )::numeric(18, 2) as net_cogs
  from scoped s
  group by
    case
      when coalesce(p_group_by, 'material') = 'invoice' then s.invoice_id::text
      else s.material_id::text
    end
  order by group_key;
$$;

comment on function public.get_cogs_report is
  'تكلفة المبيعات من حركات sale/return_sale — إيراد من line_amount للفاتورة، تكلفة من unit_cost؛ مجمّع حسب مادة أو فاتورة';

drop function if exists public.get_inventory_movement_ledger(date, date, uuid, uuid, uuid) cascade;

create or replace function public.get_inventory_movement_ledger(
  p_from_date date default null,
  p_to_date date default null,
  p_material_id uuid default null,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null
)
returns table (
  movement_id uuid,
  movement_date date,
  movement_kind varchar,
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  warehouse_id uuid,
  warehouse_code varchar,
  warehouse_name_ar varchar,
  branch_code varchar,
  quantity_base_delta numeric,
  unit_cost numeric,
  line_value numeric,
  running_balance_base numeric,
  source_type varchar,
  source_id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with opening as (
    select
      im.material_id,
      im.warehouse_id,
      coalesce(sum(im.quantity_base_delta), 0)::numeric(18, 6) as opening_qty
    from public.inventory_movements im
    where p_from_date is not null
      and im.movement_date < p_from_date
      and (p_material_id is null or im.material_id = p_material_id)
      and (p_warehouse_id is null or im.warehouse_id = p_warehouse_id)
      and (p_branch_id is null or im.branch_id = p_branch_id)
    group by im.material_id, im.warehouse_id
  ),
  filtered as (
    select
      im.id as movement_id,
      im.movement_date,
      im.movement_kind,
      im.material_id,
      m.material_code,
      m.name_ar as material_name_ar,
      im.warehouse_id,
      w.warehouse_code,
      w.name_ar as warehouse_name_ar,
      b.branch_code,
      im.quantity_base_delta,
      im.unit_cost,
      round((im.quantity_base_delta * coalesce(im.unit_cost, 0))::numeric, 2) as line_value,
      im.source_type,
      im.source_id,
      im.created_at,
      coalesce(o.opening_qty, 0)::numeric(18, 6) as opening_qty
    from public.inventory_movements im
    inner join public.materials m on m.id = im.material_id
    inner join public.warehouses w on w.id = im.warehouse_id
    inner join public.branches b on b.id = im.branch_id
    left join opening o
      on o.material_id = im.material_id
     and o.warehouse_id = im.warehouse_id
    where (p_from_date is null or im.movement_date >= p_from_date)
      and (p_to_date is null or im.movement_date <= p_to_date)
      and (p_material_id is null or im.material_id = p_material_id)
      and (p_warehouse_id is null or im.warehouse_id = p_warehouse_id)
      and (p_branch_id is null or im.branch_id = p_branch_id)
  )
  select
    f.movement_id,
    f.movement_date,
    f.movement_kind,
    f.material_id,
    f.material_code,
    f.material_name_ar,
    f.warehouse_id,
    f.warehouse_code,
    f.warehouse_name_ar,
    f.branch_code,
    f.quantity_base_delta,
    f.unit_cost,
    f.line_value,
    (
      f.opening_qty
      + sum(f.quantity_base_delta) over (
          partition by f.material_id, f.warehouse_id
          order by f.movement_date, f.created_at, f.movement_id
          rows between unbounded preceding and current row
        )
    )::numeric(18, 6) as running_balance_base,
    f.source_type,
    f.source_id,
    f.created_at
  from filtered f
  order by f.movement_date, f.created_at, f.movement_id;
$$;

comment on function public.get_inventory_movement_ledger is
  'دفتر حركات مخزون مع رصيد تراكمي يشمل الرصيد قبل فترة الفلتر حسب مادة/مستودع';
