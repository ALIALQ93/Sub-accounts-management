-- =============================================================================
-- patch_inventory_reports.sql — تقارير مخزون + تسوية جردية
-- =============================================================================
-- يتطلب: patch_post_invoice.sql (inventory_movements)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- رصيد مخزون per مادة/مستودع
-- ---------------------------------------------------------------------------

drop function if exists public.get_inventory_balance(date, uuid, uuid, uuid, uuid, boolean) cascade;

create or replace function public.get_inventory_balance(
  p_as_of_date date default null,
  p_material_id uuid default null,
  p_warehouse_id uuid default null,
  p_branch_id uuid default null,
  p_category_id uuid default null,
  p_hide_zero boolean default true
)
returns table (
  material_id uuid,
  material_code varchar,
  material_name_ar varchar,
  category_id uuid,
  category_name_ar varchar,
  warehouse_id uuid,
  warehouse_code varchar,
  warehouse_name_ar varchar,
  branch_id uuid,
  branch_code varchar,
  quantity_base numeric,
  inventory_value numeric,
  unit_cost_avg numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped_movements as (
    select im.*
    from public.inventory_movements im
    inner join public.materials m on m.id = im.material_id
    where m.is_active = true
      and (p_as_of_date is null or im.movement_date <= p_as_of_date)
      and (p_material_id is null or im.material_id = p_material_id)
      and (p_warehouse_id is null or im.warehouse_id = p_warehouse_id)
      and (p_branch_id is null or im.branch_id = p_branch_id)
      and (p_category_id is null or m.category_id = p_category_id)
  ),
  agg as (
    select
      sm.material_id,
      sm.warehouse_id,
      coalesce(sum(sm.quantity_base_delta), 0)::numeric(18, 6) as quantity_base,
      coalesce(
        sum(sm.quantity_base_delta * coalesce(sm.unit_cost, 0)),
        0
      )::numeric(18, 2) as inventory_value
    from scoped_movements sm
    group by sm.material_id, sm.warehouse_id
  )
  select
    m.id as material_id,
    m.material_code,
    m.name_ar as material_name_ar,
    m.category_id,
    mc.name_ar as category_name_ar,
    w.id as warehouse_id,
    w.warehouse_code,
    w.name_ar as warehouse_name_ar,
    w.branch_id,
    b.branch_code,
    a.quantity_base,
    a.inventory_value,
    case
      when a.quantity_base <> 0 then
        round((a.inventory_value / a.quantity_base)::numeric, 4)
      else null
    end as unit_cost_avg
  from agg a
  inner join public.materials m on m.id = a.material_id
  inner join public.warehouses w on w.id = a.warehouse_id
  inner join public.branches b on b.id = w.branch_id
  left join public.material_categories mc on mc.id = m.category_id
  where (not p_hide_zero or a.quantity_base <> 0)
  order by m.material_code, w.warehouse_code;
$$;

comment on function public.get_inventory_balance is
  'رصيد مخزون مجمّع per مادة/مستودع — كمية أساس + قيمة تقديرية';

-- ---------------------------------------------------------------------------
-- دفتر حركة مادة في مستودع (مع رصيد تراكمي)
-- ---------------------------------------------------------------------------

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
  with filtered as (
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
      im.created_at
    from public.inventory_movements im
    inner join public.materials m on m.id = im.material_id
    inner join public.warehouses w on w.id = im.warehouse_id
    inner join public.branches b on b.id = im.branch_id
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
    sum(f.quantity_base_delta) over (
      partition by f.material_id, f.warehouse_id
      order by f.movement_date, f.created_at, f.movement_id
      rows between unbounded preceding and current row
    )::numeric(18, 6) as running_balance_base,
    f.source_type,
    f.source_id,
    f.created_at
  from filtered f
  order by f.movement_date, f.created_at, f.movement_id;
$$;

comment on function public.get_inventory_movement_ledger is
  'دفتر حركات مخزون مع رصيد تراكمي per مادة/مستودع';

-- ---------------------------------------------------------------------------
-- تسوية جردية مباشرة (فروقات عدّ فعلي ↔ نظامي)
-- ---------------------------------------------------------------------------

drop function if exists public.post_stock_adjustment(
  uuid, uuid, numeric, uuid, uuid, date, text, uuid
) cascade;

create or replace function public.post_stock_adjustment(
  p_material_id uuid,
  p_warehouse_id uuid,
  p_counted_quantity_base numeric,
  p_inventory_account_id uuid,
  p_adjustment_account_id uuid,
  p_adjustment_date date default current_date,
  p_description text default null,
  p_cost_center_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_material public.materials%rowtype;
  v_warehouse public.warehouses%rowtype;
  v_settings public.company_inventory_settings%rowtype;
  v_system_qty numeric(18, 6);
  v_delta numeric(18, 6);
  v_unit_cost numeric(18, 4);
  v_amount numeric(18, 2);
  v_je_id uuid;
  v_entry_no varchar(40);
  v_desc text;
begin
  if p_counted_quantity_base < 0 then
    raise exception 'Counted quantity cannot be negative.';
  end if;

  if p_inventory_account_id is null or p_adjustment_account_id is null then
    raise exception 'Inventory and adjustment accounts are required.';
  end if;

  select * into v_material
  from public.materials
  where id = p_material_id and is_active = true;
  if not found then
    raise exception 'Material not found or inactive.';
  end if;

  select * into v_warehouse
  from public.warehouses
  where id = p_warehouse_id and is_active = true;
  if not found then
    raise exception 'Warehouse not found or inactive.';
  end if;

  select * into v_settings from public.company_inventory_settings where id = 1;
  if v_settings.inventory_method is null then
    raise exception 'Configure inventory_method before stock adjustment.';
  end if;

  perform public.assert_accounting_period_open(p_adjustment_date, null);

  select coalesce(sum(im.quantity_base_delta), 0)
  into v_system_qty
  from public.inventory_movements im
  where im.material_id = p_material_id
    and im.warehouse_id = p_warehouse_id;

  v_delta := round((p_counted_quantity_base - v_system_qty)::numeric, 6);

  if abs(v_delta) < 0.000001 then
    raise exception 'No adjustment needed — counted quantity matches system balance.';
  end if;

  select coalesce(
    (
      select sum(im.quantity_base_delta * coalesce(im.unit_cost, 0))
             / nullif(sum(im.quantity_base_delta), 0)
      from public.inventory_movements im
      where im.material_id = p_material_id
        and im.warehouse_id = p_warehouse_id
    ),
    v_material.purchase_price,
    0
  )
  into v_unit_cost;

  v_amount := round((abs(v_delta) * coalesce(v_unit_cost, 0))::numeric, 2);
  if v_amount <= 0 then
    raise exception 'Adjustment value is zero — set purchase price or post purchases first.';
  end if;

  v_desc := coalesce(
    p_description,
    'تسوية جرد — ' || v_material.material_code || ' @ ' || v_warehouse.warehouse_code
  );

  v_entry_no := 'JE-STKADJ-' || to_char(now(), 'YYYYMMDD-HH24MISS');

  insert into public.journal_entries (
    entry_no,
    entry_date,
    description,
    status,
    source_type,
    source_id,
    branch_id
  )
  values (
    v_entry_no,
    p_adjustment_date,
    v_desc,
    'posted',
    'stock_adjustment',
    p_material_id,
    v_warehouse.branch_id
  )
  returning id into v_je_id;

  if v_delta > 0 then
    perform public._invoice_add_journal_line(
      v_je_id, p_inventory_account_id, v_amount, 0,
      'فائض جرد — ' || v_material.material_code,
      p_cost_center_id, v_warehouse.branch_id,
      null, 1,
      null, null, null, null, null, null
    );
    perform public._invoice_add_journal_line(
      v_je_id, p_adjustment_account_id, 0, v_amount,
      'فائض جرد — طرف مقابل',
      p_cost_center_id, v_warehouse.branch_id,
      null, 1,
      null, null, null, null, null, null
    );
  else
    perform public._invoice_add_journal_line(
      v_je_id, p_adjustment_account_id, v_amount, 0,
      'عجز جرد — ' || v_material.material_code,
      p_cost_center_id, v_warehouse.branch_id,
      null, 1,
      null, null, null, null, null, null
    );
    perform public._invoice_add_journal_line(
      v_je_id, p_inventory_account_id, 0, v_amount,
      'عجز جرد — مخزون',
      p_cost_center_id, v_warehouse.branch_id,
      null, 1,
      null, null, null, null, null, null
    );
  end if;

  insert into public.inventory_movements (
    movement_date,
    material_id,
    warehouse_id,
    branch_id,
    cost_center_id,
    quantity_delta,
    quantity_base_delta,
    unit_cost,
    total_cost,
    movement_kind,
    source_type,
    source_id
  )
  values (
    p_adjustment_date,
    p_material_id,
    p_warehouse_id,
    v_warehouse.branch_id,
    p_cost_center_id,
    v_delta,
    v_delta,
    v_unit_cost,
    v_amount,
    'adjustment',
    'stock_adjustment',
    v_je_id
  );

  perform public.lock_company_inventory_foundation(p_adjustment_date::timestamptz);

  return jsonb_build_object(
    'journal_entry_id', v_je_id,
    'entry_no', v_entry_no,
    'system_quantity_base', v_system_qty,
    'counted_quantity_base', p_counted_quantity_base,
    'delta_quantity_base', v_delta,
    'adjustment_amount', v_amount,
    'unit_cost', v_unit_cost
  );
end;
$$;

comment on function public.post_stock_adjustment is
  'ترحيل فروقات جرد — قيد + حركة adjustment عند اختلاف العدّ الفعلي عن الرصيد النظامي';
