-- =============================================================================
-- patch_inventory_phase2.sql — تسوية مجمّعة + تحليل نواقص/راكد
-- =============================================================================
-- يتطلب: patch_inventory_reports.sql + patch_period_enforcement.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- تسوية جرد متعددة الأسطر — قيد واحد
-- ---------------------------------------------------------------------------

drop function if exists public.post_stock_adjustment_batch(jsonb, uuid, uuid, date, text, uuid) cascade;

create or replace function public.post_stock_adjustment_batch(
  p_lines jsonb,
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
  v_settings public.company_inventory_settings%rowtype;
  v_line jsonb;
  v_material public.materials%rowtype;
  v_warehouse public.warehouses%rowtype;
  v_system_qty numeric(18, 6);
  v_delta numeric(18, 6);
  v_unit_cost numeric(18, 4);
  v_amount numeric(18, 2);
  v_counted numeric(18, 6);
  v_je_id uuid;
  v_entry_no varchar(40);
  v_desc text;
  v_line_results jsonb := '[]'::jsonb;
  v_applied int := 0;
  v_branch_id uuid;
begin
  if p_inventory_account_id is null or p_adjustment_account_id is null then
    raise exception 'Inventory and adjustment accounts are required.';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one adjustment line is required.';
  end if;

  select * into v_settings from public.company_inventory_settings where id = 1;
  if v_settings.inventory_method is null then
    raise exception 'Configure inventory_method before stock adjustment.';
  end if;

  perform public.assert_accounting_period_open(p_adjustment_date, null);

  v_entry_no := 'JE-STKADJ-BATCH-' || to_char(now(), 'YYYYMMDD-HH24MISS');
  v_desc := coalesce(p_description, 'تسوية جرد مجمّعة');

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    select * into v_material
    from public.materials
    where id = (v_line->>'material_id')::uuid and is_active = true;
    if not found then
      raise exception 'Material not found: %', v_line->>'material_id';
    end if;

    select * into v_warehouse
    from public.warehouses
    where id = (v_line->>'warehouse_id')::uuid and is_active = true;
    if not found then
      raise exception 'Warehouse not found: %', v_line->>'warehouse_id';
    end if;

    v_counted := (v_line->>'counted_quantity_base')::numeric;
    if v_counted < 0 then
      raise exception 'Counted quantity cannot be negative for material %.', v_material.material_code;
    end if;

    select coalesce(sum(im.quantity_base_delta), 0)
    into v_system_qty
    from public.inventory_movements im
    where im.material_id = v_material.id
      and im.warehouse_id = v_warehouse.id;

    v_delta := round((v_counted - v_system_qty)::numeric, 6);
    if abs(v_delta) < 0.000001 then
      continue;
    end if;

    select coalesce(
      (
        select sum(im.quantity_base_delta * coalesce(im.unit_cost, 0))
               / nullif(sum(im.quantity_base_delta), 0)
        from public.inventory_movements im
        where im.material_id = v_material.id
          and im.warehouse_id = v_warehouse.id
      ),
      v_material.purchase_price,
      0
    )
    into v_unit_cost;

    v_amount := round((abs(v_delta) * coalesce(v_unit_cost, 0))::numeric, 2);
    if v_amount <= 0 then
      raise exception 'Adjustment value is zero for material %.', v_material.material_code;
    end if;

    if v_je_id is null then
      v_branch_id := v_warehouse.branch_id;
      insert into public.journal_entries (
        entry_no, entry_date, description, status, source_type, source_id, branch_id
      )
      values (
        v_entry_no,
        p_adjustment_date,
        v_desc,
        'posted',
        'stock_adjustment_batch',
        gen_random_uuid(),
        v_branch_id
      )
      returning id into v_je_id;
    end if;

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
        'فائض جرد — ' || v_material.material_code,
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
        'عجز جرد — ' || v_material.material_code,
        p_cost_center_id, v_warehouse.branch_id,
        null, 1,
        null, null, null, null, null, null
      );
    end if;

    insert into public.inventory_movements (
      movement_date, material_id, warehouse_id, branch_id, cost_center_id,
      quantity_delta, quantity_base_delta, unit_cost, total_cost,
      movement_kind, source_type, source_id
    )
    values (
      p_adjustment_date,
      v_material.id,
      v_warehouse.id,
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

    v_applied := v_applied + 1;
    v_line_results := v_line_results || jsonb_build_array(
      jsonb_build_object(
        'material_id', v_material.id,
        'material_code', v_material.material_code,
        'warehouse_id', v_warehouse.id,
        'warehouse_code', v_warehouse.warehouse_code,
        'system_quantity_base', v_system_qty,
        'counted_quantity_base', v_counted,
        'delta_quantity_base', v_delta,
        'adjustment_amount', v_amount
      )
    );
  end loop;

  if v_applied = 0 then
    raise exception 'No adjustment lines with quantity difference.';
  end if;

  perform public.lock_company_inventory_foundation(p_adjustment_date::timestamptz);

  return jsonb_build_object(
    'journal_entry_id', v_je_id,
    'entry_no', v_entry_no,
    'applied_lines', v_applied,
    'lines', v_line_results
  );
end;
$$;

comment on function public.post_stock_adjustment_batch is
  'تسوية جرد متعددة الأسطر في قيد واحد';

-- ---------------------------------------------------------------------------
-- نواقص + مواد راكدة
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
      lm.last_movement_date,
      case
        when lm.last_movement_date is null then null
        else (p_as_of_date - lm.last_movement_date)::int
      end as days_idle
    from balance b
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
    e.inventory_value,
    e.last_movement_date,
    e.days_idle
  from enriched e
  where e.quantity_base <= coalesce(p_shortage_max_qty, 0)

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
  'نواقص (كمية <= حد) ومواد راكدة (بدون حركة منذ N يوم مع رصيد)';
