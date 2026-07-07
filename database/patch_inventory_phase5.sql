-- =============================================================================
-- patch_inventory_phase5.sql — حد أدنى per مستودع + ملخص حركات المخزون
-- =============================================================================
-- يتطلب: patch_inventory_phase4.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- حد أدنى per مادة + مستودع
-- ---------------------------------------------------------------------------

create table if not exists public.warehouse_material_limits (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  min_stock numeric(18, 6) not null default 0 check (min_stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouse_material_limits_unique unique (warehouse_id, material_id)
);

comment on table public.warehouse_material_limits is
  'حد أدنى للمخزون per مادة ومستودع — يتفوّق على min_stock في بطاقة المادة';

create index if not exists idx_warehouse_material_limits_wh
  on public.warehouse_material_limits(warehouse_id);
create index if not exists idx_warehouse_material_limits_mat
  on public.warehouse_material_limits(material_id);

alter table public.warehouse_material_limits enable row level security;

drop policy if exists "warehouse_material_limits_select_all" on public.warehouse_material_limits;
create policy "warehouse_material_limits_select_all" on public.warehouse_material_limits
  for select to authenticated using (true);
drop policy if exists "warehouse_material_limits_insert_all" on public.warehouse_material_limits;
create policy "warehouse_material_limits_insert_all" on public.warehouse_material_limits
  for insert to authenticated with check (true);
drop policy if exists "warehouse_material_limits_update_all" on public.warehouse_material_limits;
create policy "warehouse_material_limits_update_all" on public.warehouse_material_limits
  for update to authenticated using (true) with check (true);
drop policy if exists "warehouse_material_limits_delete_all" on public.warehouse_material_limits;
create policy "warehouse_material_limits_delete_all" on public.warehouse_material_limits
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- تحليل نواقص — أولوية: مستودع > بطاقة مادة > حد عام
-- ---------------------------------------------------------------------------

drop function if exists public.get_inventory_analysis(date, numeric, int, uuid, uuid) cascade;

create or replace function public.get_inventory_analysis(
  p_as_of_date date default current_date,
  p_shortage_max_qty numeric default 0,
  p_stagnant_days int default 90,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null
)
returns table (
  analysis_kind varchar,
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  warehouse_id uuid,
  warehouse_code varchar,
  warehouse_name_ar varchar,
  branch_code varchar,
  quantity_base numeric,
  min_stock numeric,
  inventory_value numeric,
  last_movement_date date,
  days_idle int
)
language sql
stable
security definer
set search_path = public
as $$
  with balance as (
    select *
    from public.get_inventory_balance(
      p_as_of_date,
      null,
      p_warehouse_id,
      p_branch_id,
      null,
      false
    )
  ),
  last_move as (
    select
      im.material_id,
      im.warehouse_id,
      max(im.movement_date) as last_movement_date
    from public.inventory_movements im
    where (p_as_of_date is null or im.movement_date <= p_as_of_date)
    group by im.material_id, im.warehouse_id
  ),
  enriched as (
    select
      b.*,
      coalesce(
        nullif(wml.min_stock, 0),
        nullif(m.min_stock, 0),
        0
      ) as min_stock,
      lm.last_movement_date,
      case
        when lm.last_movement_date is null then null
        else (p_as_of_date - lm.last_movement_date)::int
      end as days_idle
    from balance b
    join public.materials m on m.id = b.material_id
    left join public.warehouse_material_limits wml
      on wml.material_id = b.material_id
     and wml.warehouse_id = b.warehouse_id
    left join last_move lm
      on lm.material_id = b.material_id
      and lm.warehouse_id = b.warehouse_id
  )
  select
    'shortage'::varchar as analysis_kind,
    e.material_id,
    e.material_code,
    e.material_name_ar,
    e.warehouse_id,
    e.warehouse_code,
    e.warehouse_name_ar,
    e.branch_code,
    e.quantity_base,
    e.min_stock,
    e.inventory_value,
    e.last_movement_date,
    e.days_idle
  from enriched e
  where (
    (e.min_stock > 0 and e.quantity_base < e.min_stock)
    or (e.min_stock = 0 and e.quantity_base <= coalesce(p_shortage_max_qty, 0))
  )

  union all

  select
    'stagnant'::varchar as analysis_kind,
    e.material_id,
    e.material_code,
    e.material_name_ar,
    e.warehouse_id,
    e.warehouse_code,
    e.warehouse_name_ar,
    e.branch_code,
    e.quantity_base,
    e.min_stock,
    e.inventory_value,
    e.last_movement_date,
    e.days_idle
  from enriched e
  where e.quantity_base > 0
    and coalesce(p_stagnant_days, 0) > 0
    and (
      e.last_movement_date is null
      or e.last_movement_date <= p_as_of_date - p_stagnant_days
    )

  order by analysis_kind, material_code, warehouse_code;
$$;

comment on function public.get_inventory_analysis is
  'نواقص (حد مستودع/مادة أو حد عام) ومواد راكدة';

-- ---------------------------------------------------------------------------
-- ملخص حركات المخزون — per نوع حركة ونوع فاتورة
-- ---------------------------------------------------------------------------

drop function if exists public.get_inventory_movements_summary(date, date, uuid, uuid, uuid) cascade;

create or replace function public.get_inventory_movements_summary(
  p_from_date date default null,
  p_to_date date default null,
  p_material_id uuid default null,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null
)
returns table (
  movement_kind varchar,
  source_type varchar,
  commercial_kind varchar,
  movement_count bigint,
  quantity_in_base numeric,
  quantity_out_base numeric,
  total_value numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    im.movement_kind,
    im.source_type,
    coalesce(ip.commercial_kind, im.source_type)::varchar as commercial_kind,
    count(*)::bigint as movement_count,
    coalesce(
      sum(case when im.quantity_base_delta > 0 then im.quantity_base_delta else 0 end),
      0
    )::numeric(18, 6) as quantity_in_base,
    coalesce(
      sum(case when im.quantity_base_delta < 0 then abs(im.quantity_base_delta) else 0 end),
      0
    )::numeric(18, 6) as quantity_out_base,
    coalesce(sum(coalesce(im.total_cost, 0)), 0)::numeric(18, 2) as total_value
  from public.inventory_movements im
  inner join public.materials m on m.id = im.material_id
  left join public.invoices i
    on im.source_type = 'invoice' and i.id = im.source_id
  left join public.invoice_patterns ip on ip.id = i.pattern_id
  where m.is_active = true
    and (p_from_date is null or im.movement_date >= p_from_date)
    and (p_to_date is null or im.movement_date <= p_to_date)
    and (p_material_id is null or im.material_id = p_material_id)
    and (p_warehouse_id is null or im.warehouse_id = p_warehouse_id)
    and (p_branch_id is null or im.branch_id = p_branch_id)
  group by im.movement_kind, im.source_type, coalesce(ip.commercial_kind, im.source_type)
  order by commercial_kind, movement_kind;
$$;

comment on function public.get_inventory_movements_summary is
  'ملخص حركات المخزون مجمّع per نوع حركة ونوع فاتورة/مصدر';
