-- =============================================================================
-- patch_composite_disassembly.sql (#50)
-- =============================================================================
-- أوضاع المادة التجميعية:
--   kit            — طقم يُفك عند البيع/الإخراج (السلوك السابق)
--   finished       — منتج نهائي بدون تفكيك (مثل برجر المطعم)
--   disassemblable — قابل لعملية تفكيك مع تسجيل مواد تالفة
-- + نمط فاتورة «تفكيك» (عكس التصنيع جزئياً)
-- يتطلب: patch_invoice_manufacturing.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) composite_mode على المواد
-- ---------------------------------------------------------------------------

alter table public.materials
  add column if not exists composite_mode varchar(20) null;

update public.materials
set composite_mode = 'kit'
where material_kind = 'composite'
  and composite_mode is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'materials_composite_mode_chk'
  ) then
    alter table public.materials
      add constraint materials_composite_mode_chk
      check (
        (
          material_kind = 'normal'
          and composite_mode is null
        )
        or (
          material_kind = 'composite'
          and composite_mode in ('kit', 'finished', 'disassemblable')
        )
      );
  end if;
end $$;

comment on column public.materials.composite_mode is
  'تجميعية فقط: kit=تفكيك عند الإخراج، finished=منتج نهائي، disassemblable=تفكيك مع تالف';

-- عند التحويل لعادية امسح الوضع؛ عند التحويل لتجميعية بدون وضع → kit
create or replace function public.materials_composite_mode_sync()
returns trigger
language plpgsql
as $$
begin
  if new.material_kind = 'normal' then
    new.composite_mode := null;
  elsif new.material_kind = 'composite' and new.composite_mode is null then
    new.composite_mode := 'kit';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_materials_composite_mode_sync on public.materials;
create trigger trg_materials_composite_mode_sync
  before insert or update of material_kind, composite_mode
  on public.materials
  for each row
  execute function public.materials_composite_mode_sync();

-- ---------------------------------------------------------------------------
-- 2) كمية تالفة على أسطر الفاتورة (تفكيك)
-- ---------------------------------------------------------------------------

alter table public.invoice_material_lines
  add column if not exists qty_damaged numeric(18, 6) null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_material_lines_qty_damaged_chk'
  ) then
    alter table public.invoice_material_lines
      add constraint invoice_material_lines_qty_damaged_chk
      check (qty_damaged is null or qty_damaged >= 0);
  end if;
end $$;

comment on column public.invoice_material_lines.qty_damaged is
  'تفكيك: كمية تالفة من المكوّن لا تُعاد للمخزون';

-- ---------------------------------------------------------------------------
-- 3) حركات تفكيك
-- ---------------------------------------------------------------------------

alter table public.inventory_movements
  drop constraint if exists inventory_movements_movement_kind_check;

alter table public.inventory_movements
  add constraint inventory_movements_movement_kind_check
  check (movement_kind in (
    'sale', 'purchase', 'transfer_out', 'transfer_in',
    'return_sale', 'return_purchase', 'opening_stock', 'adjustment',
    'manufacture_consume', 'manufacture_produce',
    'disassemble_consume', 'disassemble_produce'
  ));

-- ---------------------------------------------------------------------------
-- 4) تفكيك عند الإخراج فقط لوضع kit
-- ---------------------------------------------------------------------------

create or replace function public.inventory_movements_explode_composite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind varchar(20);
  v_mode varchar(20);
  v_comp record;
  v_sign numeric;
  v_abs_base numeric;
  v_ratio numeric;
begin
  if new.movement_kind in (
    'manufacture_consume', 'manufacture_produce',
    'disassemble_consume', 'disassemble_produce'
  ) then
    return new;
  end if;

  if current_setting('app.bom_explode_depth', true) = '1' then
    return new;
  end if;

  select material_kind, composite_mode
  into v_kind, v_mode
  from public.materials where id = new.material_id;

  if v_kind is distinct from 'composite' then
    return new;
  end if;

  -- منتج نهائي أو قابل للتفكيك اليدوي: يُحرَّك كوحدة مخزون
  if coalesce(v_mode, 'kit') is distinct from 'kit' then
    return new;
  end if;

  v_abs_base := abs(coalesce(new.quantity_base_delta, 0));
  if v_abs_base = 0 then
    return null;
  end if;

  v_sign := case when new.quantity_base_delta < 0 then -1 else 1 end;
  v_ratio := case
    when abs(coalesce(new.quantity_delta, 0)) > 0
         and abs(coalesce(new.quantity_base_delta, 0)) > 0
    then abs(new.quantity_delta) / abs(new.quantity_base_delta)
    else 1
  end;

  perform set_config('app.bom_explode_depth', '1', true);

  for v_comp in
    select * from public.explode_material_bom(new.material_id, v_abs_base)
  loop
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
      source_id,
      source_line_id,
      expiry_date,
      serial_number
    )
    values (
      new.movement_date,
      v_comp.component_material_id,
      new.warehouse_id,
      new.branch_id,
      new.cost_center_id,
      round((v_sign * v_comp.quantity_base * v_ratio)::numeric, 6),
      round((v_sign * v_comp.quantity_base)::numeric, 6),
      new.unit_cost,
      round((abs(v_comp.quantity_base) * coalesce(new.unit_cost, 0))::numeric, 2)
        * case when v_sign < 0 then -1 else 1 end,
      new.movement_kind,
      new.source_type,
      new.source_id,
      new.source_line_id,
      -- لا ننسخ صلاحية/تسلسل الأب إلى المكوّنات
      null,
      null
    );
  end loop;

  perform set_config('app.bom_explode_depth', '', true);
  return null;
end;
$$;

-- فحص الرصيد يشمل تفكيك
create or replace function public.inventory_movements_enforce_stock()
returns trigger
language plpgsql
as $$
declare
  v_balance numeric(18, 6);
  v_enforce boolean := true;
  v_material_code varchar;
  v_warehouse_code varchar;
begin
  if new.quantity_base_delta >= 0 then
    return new;
  end if;

  if new.movement_kind not in (
    'sale', 'transfer_out', 'return_purchase',
    'manufacture_consume', 'disassemble_consume'
  ) then
    return new;
  end if;

  if new.source_type = 'invoice' and new.source_id is not null then
    select coalesce(ip.enforce_stock_availability, true)
    into v_enforce
    from public.invoices i
    inner join public.invoice_patterns ip on ip.id = i.pattern_id
    where i.id = new.source_id;

    if not coalesce(v_enforce, true) then
      return new;
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.material_id::text || '|' || new.warehouse_id::text, 42)
  );

  v_balance := public.get_material_warehouse_qty_balance(
    new.material_id,
    new.warehouse_id,
    new.movement_date
  );

  if v_balance + new.quantity_base_delta < -0.000001 then
    select m.material_code into v_material_code
    from public.materials m where m.id = new.material_id;

    select w.warehouse_code into v_warehouse_code
    from public.warehouses w where w.id = new.warehouse_id;

    raise exception
      'Insufficient stock for material % in warehouse %. Available: %, requested: %.',
      coalesce(v_material_code, new.material_id::text),
      coalesce(v_warehouse_code, new.warehouse_id::text),
      v_balance,
      abs(new.quantity_base_delta);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) إنشاء مادة يشمل composite_mode
-- ---------------------------------------------------------------------------

create or replace function public.create_material_with_base_unit(
  p_material jsonb,
  p_base_unit jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_material_id uuid;
  v_unit_code text;
  v_unit_name text;
  v_unit_id uuid;
  v_kind text;
  v_mode text;
begin
  if coalesce(nullif(trim(p_material->>'material_code'), ''), '') = '' then
    raise exception 'material_code is required.';
  end if;
  if coalesce(nullif(trim(p_material->>'name_ar'), ''), '') = '' then
    raise exception 'name_ar is required.';
  end if;

  v_kind := coalesce(nullif(trim(p_material->>'material_kind'), ''), 'normal');
  if v_kind not in ('normal', 'composite') then
    raise exception 'material_kind must be normal or composite.';
  end if;

  v_mode := nullif(trim(coalesce(p_material->>'composite_mode', '')), '');
  if v_kind = 'composite' then
    v_mode := coalesce(v_mode, 'kit');
    if v_mode not in ('kit', 'finished', 'disassemblable') then
      raise exception 'composite_mode must be kit, finished, or disassemblable.';
    end if;
  else
    v_mode := null;
  end if;

  v_unit_id := nullif(p_base_unit->>'unit_id', '')::uuid;
  v_unit_code := upper(trim(coalesce(p_base_unit->>'unit_code', '')));
  v_unit_name := trim(coalesce(p_base_unit->>'name_ar', ''));

  if v_unit_id is not null then
    select unit_code, name_ar
    into v_unit_code, v_unit_name
    from public.units where id = v_unit_id;
  end if;

  if v_unit_code = '' or v_unit_name = '' then
    raise exception 'Base unit code and name_ar are required.';
  end if;

  insert into public.materials (
    material_code,
    name_ar,
    name_en,
    category_id,
    purchase_price,
    sale_price,
    inventory_account_id,
    is_active,
    min_stock,
    max_stock,
    barcode,
    manufacturer,
    supplier_name,
    color,
    size,
    weight,
    notes,
    has_expiry_date,
    require_expiry_on_inbound,
    require_expiry_on_outbound,
    expiry_days,
    has_serial_number,
    require_serial_on_inbound,
    require_serial_on_outbound,
    material_kind,
    composite_mode
  )
  values (
    upper(trim(p_material->>'material_code')),
    trim(p_material->>'name_ar'),
    nullif(trim(coalesce(p_material->>'name_en', '')), ''),
    nullif(p_material->>'category_id', '')::uuid,
    coalesce((p_material->>'purchase_price')::numeric, 0),
    coalesce((p_material->>'sale_price')::numeric, 0),
    nullif(p_material->>'inventory_account_id', '')::uuid,
    coalesce((p_material->>'is_active')::boolean, true),
    coalesce((p_material->>'min_stock')::numeric, 0),
    coalesce((p_material->>'max_stock')::numeric, 0),
    nullif(trim(coalesce(p_material->>'barcode', '')), ''),
    nullif(trim(coalesce(p_material->>'manufacturer', '')), ''),
    nullif(trim(coalesce(p_material->>'supplier_name', '')), ''),
    nullif(trim(coalesce(p_material->>'color', '')), ''),
    nullif(trim(coalesce(p_material->>'size', '')), ''),
    nullif(p_material->>'weight', '')::numeric,
    nullif(trim(coalesce(p_material->>'notes', '')), ''),
    coalesce((p_material->>'has_expiry_date')::boolean, false),
    coalesce((p_material->>'require_expiry_on_inbound')::boolean, false),
    coalesce((p_material->>'require_expiry_on_outbound')::boolean, false),
    null,
    coalesce((p_material->>'has_serial_number')::boolean, false),
    coalesce((p_material->>'require_serial_on_inbound')::boolean, false),
    coalesce((p_material->>'require_serial_on_outbound')::boolean, false),
    v_kind,
    v_mode
  )
  returning id into v_material_id;

  insert into public.material_units (
    material_id,
    unit_id,
    unit_code,
    name_ar,
    name_en,
    is_base_unit,
    conversion_op,
    conversion_factor,
    factor_to_base,
    purchase_price,
    sale_price,
    semi_wholesale_price,
    wholesale_price,
    is_active,
    sort_order
  )
  values (
    v_material_id,
    v_unit_id,
    v_unit_code,
    v_unit_name,
    nullif(trim(coalesce(p_base_unit->>'name_en', '')), ''),
    true,
    'multiply',
    1,
    1,
    nullif(p_base_unit->>'purchase_price', '')::numeric,
    nullif(p_base_unit->>'sale_price', '')::numeric,
    nullif(p_base_unit->>'semi_wholesale_price', '')::numeric,
    nullif(p_base_unit->>'wholesale_price', '')::numeric,
    coalesce((p_base_unit->>'is_active')::boolean, true),
    0
  );

  return v_material_id;
end;
$$;

grant execute on function public.create_material_with_base_unit(jsonb, jsonb)
  to authenticated;

-- تكلفة الإخراج: تفكيك التكلفة فقط للطقم (kit)
create or replace function public.calc_outbound_line_total_cost(
  p_consumed_mode varchar,
  p_settings public.company_inventory_settings,
  p_material_purchase_price numeric,
  p_line_unit_price numeric,
  p_factor_to_base numeric,
  p_quantity_base numeric,
  p_material_id uuid,
  p_warehouse_id uuid,
  p_cost_center_id uuid,
  p_expiry_date date,
  p_serial_number text,
  p_as_of_date date
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_kind varchar(20);
  v_mode varchar(20);
  v_total numeric(18, 2) := 0;
  v_comp record;
  v_comp_price numeric;
begin
  select material_kind, composite_mode
  into v_kind, v_mode
  from public.materials where id = p_material_id;

  if v_kind = 'composite' and coalesce(v_mode, 'kit') = 'kit' then
    for v_comp in
      select * from public.explode_material_bom(p_material_id, abs(coalesce(p_quantity_base, 0)))
    loop
      select purchase_price into v_comp_price
      from public.materials where id = v_comp.component_material_id;

      v_total := v_total + public.calc_outbound_line_total_cost_normal(
        p_consumed_mode,
        p_settings,
        coalesce(v_comp_price, 0),
        p_line_unit_price,
        1,
        v_comp.quantity_base,
        v_comp.component_material_id,
        p_warehouse_id,
        p_cost_center_id,
        null,
        null,
        p_as_of_date
      );
    end loop;
    return round(v_total::numeric, 2);
  end if;

  return public.calc_outbound_line_total_cost_normal(
    p_consumed_mode,
    p_settings,
    p_material_purchase_price,
    p_line_unit_price,
    p_factor_to_base,
    p_quantity_base,
    p_material_id,
    p_warehouse_id,
    p_cost_center_id,
    p_expiry_date,
    p_serial_number,
    p_as_of_date
  );
end;
$$;

grant execute on function public.calc_outbound_line_total_cost(
  varchar,
  public.company_inventory_settings,
  numeric,
  numeric,
  numeric,
  numeric,
  uuid,
  uuid,
  uuid,
  date,
  text,
  date
) to authenticated;

-- تصنيع: المنتج يجب ألا يكون طقماً يُفك عند البيع
create or replace function public.post_invoice_apply_manufacturing(
  p_invoice_id uuid,
  p_je_id uuid,
  p_inv public.invoices,
  p_pat public.invoice_patterns,
  p_inv_settings public.company_inventory_settings,
  p_inventory_account_id uuid,
  p_rate numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_consume_cost numeric(18, 2);
  v_total_consume numeric(18, 2) := 0;
  v_weight_sum numeric(18, 6) := 0;
  v_line_weight numeric(18, 6);
  v_line_alloc numeric(18, 2);
  v_remaining numeric(18, 2);
  v_unit_cost numeric(18, 4);
  v_consume_count int := 0;
  v_produce_count int := 0;
  v_use_equal_weights boolean := false;
begin
  if exists (
    select 1
    from public.invoice_material_lines iml
    where iml.invoice_id = p_invoice_id
      and (
        iml.manufacturing_role is null
        or iml.manufacturing_role not in ('consume', 'produce')
      )
  ) then
    raise exception 'Manufacturing lines require manufacturing_role consume or produce.';
  end if;

  select
    count(*) filter (where manufacturing_role = 'consume'),
    count(*) filter (where manufacturing_role = 'produce')
  into v_consume_count, v_produce_count
  from public.invoice_material_lines
  where invoice_id = p_invoice_id;

  if v_consume_count < 1 or v_produce_count < 1 then
    raise exception
      'Manufacturing requires at least one consume line and one produce line.';
  end if;

  for v_row in
    select iml.line_no, m.material_kind, m.material_code, m.composite_mode
    from public.invoice_material_lines iml
    inner join public.materials m on m.id = iml.material_id
    where iml.invoice_id = p_invoice_id
      and iml.manufacturing_role = 'produce'
  loop
    if v_row.material_kind is distinct from 'composite' then
      raise exception
        'Manufacturing produce line % must be a composite material (%).',
        v_row.line_no, v_row.material_code;
    end if;
    if coalesce(v_row.composite_mode, 'kit') = 'kit' then
      raise exception
        'Manufacturing produce line % (%) is a kit that explodes on outbound. Set composite_mode to finished or disassemblable.',
        v_row.line_no, v_row.material_code;
    end if;
  end loop;

  for v_row in
    select iml.*, m.purchase_price, mu.factor_to_base
    from public.invoice_material_lines iml
    inner join public.materials m on m.id = iml.material_id
    inner join public.material_units mu on mu.id = iml.material_unit_id
    where iml.invoice_id = p_invoice_id
      and iml.manufacturing_role = 'consume'
    order by iml.line_no
  loop
    v_consume_cost := public.calc_outbound_line_total_cost(
      p_pat.pricing_consumed_mode,
      p_inv_settings,
      v_row.purchase_price,
      v_row.unit_price,
      v_row.factor_to_base,
      v_row.quantity_base,
      v_row.material_id,
      v_row.warehouse_id,
      v_row.cost_center_id,
      v_row.expiry_date,
      v_row.serial_number,
      p_inv.invoice_date
    );
    v_total_consume := v_total_consume + coalesce(v_consume_cost, 0);

    if p_inv_settings.inventory_method = 'perpetual'
       and coalesce(v_consume_cost, 0) > 0 then
      if p_inventory_account_id is null then
        raise exception 'Manufacturing (perpetual) requires inventory account.';
      end if;
      perform public._invoice_add_journal_line(
        p_je_id, p_inventory_account_id, 0, v_consume_cost,
        'تصنيع — إخراج مواد', v_row.cost_center_id, v_row.branch_id,
        p_inv.currency_id, p_rate,
        null, null, null, null, p_invoice_id, v_row.id
      );
    end if;

    insert into public.inventory_movements (
      movement_date, material_id, warehouse_id, branch_id, cost_center_id,
      quantity_delta, quantity_base_delta, unit_cost, total_cost,
      movement_kind, source_type, source_id, source_line_id,
      expiry_date, serial_number
    )
    values (
      p_inv.invoice_date, v_row.material_id, v_row.warehouse_id,
      v_row.branch_id, v_row.cost_center_id,
      -v_row.quantity, -v_row.quantity_base,
      case
        when v_row.quantity_base > 0
          then round((coalesce(v_consume_cost, 0) / v_row.quantity_base)::numeric, 4)
        else 0
      end,
      coalesce(v_consume_cost, 0),
      'manufacture_consume', 'invoice', p_invoice_id, v_row.id,
      v_row.expiry_date, v_row.serial_number
    );
  end loop;

  select coalesce(sum(
    case
      when coalesce(iml.line_amount, 0) > 0 then iml.line_amount
      else iml.quantity_base
    end
  ), 0)
  into v_weight_sum
  from public.invoice_material_lines iml
  where iml.invoice_id = p_invoice_id
    and iml.manufacturing_role = 'produce';

  if v_weight_sum <= 0 then
    v_use_equal_weights := true;
    v_weight_sum := v_produce_count;
  end if;

  v_remaining := v_total_consume;

  for v_row in
    select
      iml.*,
      row_number() over (order by iml.line_no) as rn,
      count(*) over () as cnt
    from public.invoice_material_lines iml
    where iml.invoice_id = p_invoice_id
      and iml.manufacturing_role = 'produce'
    order by iml.line_no
  loop
    if v_row.rn = v_row.cnt then
      v_line_alloc := v_remaining;
    else
      if v_use_equal_weights then
        v_line_weight := 1;
      else
        v_line_weight := case
          when coalesce(v_row.line_amount, 0) > 0 then v_row.line_amount
          else v_row.quantity_base
        end;
      end if;
      v_line_alloc := round((v_total_consume * v_line_weight / v_weight_sum)::numeric, 2);
      v_remaining := v_remaining - v_line_alloc;
    end if;

    v_unit_cost := case
      when v_row.quantity_base > 0
        then round((v_line_alloc / v_row.quantity_base)::numeric, 4)
      else 0
    end;

    if p_inv_settings.inventory_method = 'perpetual' and v_line_alloc > 0 then
      if p_inventory_account_id is null then
        raise exception 'Manufacturing (perpetual) requires inventory account.';
      end if;
      perform public._invoice_add_journal_line(
        p_je_id, p_inventory_account_id, v_line_alloc, 0,
        'تصنيع — إدخال منتج', v_row.cost_center_id, v_row.branch_id,
        p_inv.currency_id, p_rate,
        null, null, null, null, p_invoice_id, v_row.id
      );
    end if;

    insert into public.inventory_movements (
      movement_date, material_id, warehouse_id, branch_id, cost_center_id,
      quantity_delta, quantity_base_delta, unit_cost, total_cost,
      movement_kind, source_type, source_id, source_line_id,
      expiry_date, serial_number
    )
    values (
      p_inv.invoice_date, v_row.material_id, v_row.warehouse_id,
      v_row.branch_id, v_row.cost_center_id,
      v_row.quantity, v_row.quantity_base,
      v_unit_cost, v_line_alloc,
      'manufacture_produce', 'invoice', p_invoice_id, v_row.id,
      v_row.expiry_date, v_row.serial_number
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) ترحيل تفكيك (+ تالف)
-- ---------------------------------------------------------------------------

create or replace function public.post_invoice_apply_disassembly(
  p_invoice_id uuid,
  p_je_id uuid,
  p_inv public.invoices,
  p_pat public.invoice_patterns,
  p_inv_settings public.company_inventory_settings,
  p_inventory_account_id uuid,
  p_cost_account_id uuid,
  p_rate numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_consume_cost numeric(18, 2);
  v_total_consume numeric(18, 2) := 0;
  v_weight_sum numeric(18, 6) := 0;
  v_line_weight numeric(18, 6);
  v_line_alloc numeric(18, 2);
  v_remaining numeric(18, 2);
  v_good_qty numeric(18, 6);
  v_dmg_qty numeric(18, 6);
  v_total_line_qty numeric(18, 6);
  v_good_cost numeric(18, 2);
  v_dmg_cost numeric(18, 2);
  v_unit_cost numeric(18, 4);
  v_consume_count int := 0;
  v_produce_count int := 0;
  v_use_equal_weights boolean := false;
  v_qty_base_good numeric(18, 6);
begin
  if exists (
    select 1
    from public.invoice_material_lines iml
    where iml.invoice_id = p_invoice_id
      and (
        iml.manufacturing_role is null
        or iml.manufacturing_role not in ('consume', 'produce')
      )
  ) then
    raise exception 'Disassembly lines require manufacturing_role consume or produce.';
  end if;

  select
    count(*) filter (where manufacturing_role = 'consume'),
    count(*) filter (where manufacturing_role = 'produce')
  into v_consume_count, v_produce_count
  from public.invoice_material_lines
  where invoice_id = p_invoice_id;

  if v_consume_count < 1 or v_produce_count < 1 then
    raise exception
      'Disassembly requires at least one consume (assembled) line and one produce (component) line.';
  end if;

  for v_row in
    select iml.line_no, m.material_kind, m.material_code, m.composite_mode
    from public.invoice_material_lines iml
    inner join public.materials m on m.id = iml.material_id
    where iml.invoice_id = p_invoice_id
      and iml.manufacturing_role = 'consume'
  loop
    if v_row.material_kind is distinct from 'composite'
       or coalesce(v_row.composite_mode, 'kit') is distinct from 'disassemblable' then
      raise exception
        'Disassembly consume line % (%) must be a disassemblable composite material.',
        v_row.line_no, v_row.material_code;
    end if;
  end loop;

  for v_row in
    select iml.*, m.purchase_price, mu.factor_to_base
    from public.invoice_material_lines iml
    inner join public.materials m on m.id = iml.material_id
    inner join public.material_units mu on mu.id = iml.material_unit_id
    where iml.invoice_id = p_invoice_id
      and iml.manufacturing_role = 'consume'
    order by iml.line_no
  loop
    v_consume_cost := public.calc_outbound_line_total_cost(
      p_pat.pricing_consumed_mode,
      p_inv_settings,
      v_row.purchase_price,
      v_row.unit_price,
      v_row.factor_to_base,
      v_row.quantity_base,
      v_row.material_id,
      v_row.warehouse_id,
      v_row.cost_center_id,
      v_row.expiry_date,
      v_row.serial_number,
      p_inv.invoice_date
    );
    v_total_consume := v_total_consume + coalesce(v_consume_cost, 0);

    if p_inv_settings.inventory_method = 'perpetual'
       and coalesce(v_consume_cost, 0) > 0 then
      if p_inventory_account_id is null then
        raise exception 'Disassembly (perpetual) requires inventory account.';
      end if;
      perform public._invoice_add_journal_line(
        p_je_id, p_inventory_account_id, 0, v_consume_cost,
        'تفكيك — إخراج منتج مجمّع', v_row.cost_center_id, v_row.branch_id,
        p_inv.currency_id, p_rate,
        null, null, null, null, p_invoice_id, v_row.id
      );
    end if;

    insert into public.inventory_movements (
      movement_date, material_id, warehouse_id, branch_id, cost_center_id,
      quantity_delta, quantity_base_delta, unit_cost, total_cost,
      movement_kind, source_type, source_id, source_line_id,
      expiry_date, serial_number
    )
    values (
      p_inv.invoice_date, v_row.material_id, v_row.warehouse_id,
      v_row.branch_id, v_row.cost_center_id,
      -v_row.quantity, -v_row.quantity_base,
      case
        when v_row.quantity_base > 0
          then round((coalesce(v_consume_cost, 0) / v_row.quantity_base)::numeric, 4)
        else 0
      end,
      coalesce(v_consume_cost, 0),
      'disassemble_consume', 'invoice', p_invoice_id, v_row.id,
      v_row.expiry_date, v_row.serial_number
    );
  end loop;

  select coalesce(sum(
    greatest(
      iml.quantity + coalesce(iml.qty_damaged, 0),
      0.000001
    )
  ), 0)
  into v_weight_sum
  from public.invoice_material_lines iml
  where iml.invoice_id = p_invoice_id
    and iml.manufacturing_role = 'produce';

  if v_weight_sum <= 0 then
    v_use_equal_weights := true;
    v_weight_sum := v_produce_count;
  end if;

  v_remaining := v_total_consume;

  for v_row in
    select
      iml.*,
      mu.factor_to_base,
      row_number() over (order by iml.line_no) as rn,
      count(*) over () as cnt
    from public.invoice_material_lines iml
    inner join public.material_units mu on mu.id = iml.material_unit_id
    where iml.invoice_id = p_invoice_id
      and iml.manufacturing_role = 'produce'
    order by iml.line_no
  loop
    v_good_qty := v_row.quantity;
    v_dmg_qty := coalesce(v_row.qty_damaged, 0);
    if v_dmg_qty < 0 then
      raise exception 'qty_damaged cannot be negative on line %.', v_row.line_no;
    end if;
    v_total_line_qty := v_good_qty + v_dmg_qty;

    if v_row.rn = v_row.cnt then
      v_line_alloc := v_remaining;
    else
      if v_use_equal_weights then
        v_line_weight := 1;
      else
        v_line_weight := greatest(v_total_line_qty, 0.000001);
      end if;
      v_line_alloc := round((v_total_consume * v_line_weight / v_weight_sum)::numeric, 2);
      v_remaining := v_remaining - v_line_alloc;
    end if;

    if v_total_line_qty > 0 then
      v_good_cost := round((v_line_alloc * v_good_qty / v_total_line_qty)::numeric, 2);
    else
      v_good_cost := 0;
    end if;
    v_dmg_cost := v_line_alloc - v_good_cost;

    v_qty_base_good := public.material_quantity_to_base(
      v_row.material_unit_id,
      v_good_qty
    );
    v_unit_cost := case
      when v_qty_base_good > 0
        then round((v_good_cost / v_qty_base_good)::numeric, 4)
      else 0
    end;

    if p_inv_settings.inventory_method = 'perpetual' then
      if v_good_cost > 0 then
        if p_inventory_account_id is null then
          raise exception 'Disassembly (perpetual) requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          p_je_id, p_inventory_account_id, v_good_cost, 0,
          'تفكيك — إدخال مكوّن صالح', v_row.cost_center_id, v_row.branch_id,
          p_inv.currency_id, p_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;
      if v_dmg_cost > 0 then
        if p_cost_account_id is null then
          raise exception
            'Disassembly with damaged qty requires cost/scrap account (default_cost_account_id).';
        end if;
        perform public._invoice_add_journal_line(
          p_je_id, p_cost_account_id, v_dmg_cost, 0,
          'تفكيك — مواد تالفة', v_row.cost_center_id, v_row.branch_id,
          p_inv.currency_id, p_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;
    end if;

    if v_good_qty > 0 then
      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id,
        expiry_date, serial_number
      )
      values (
        p_inv.invoice_date, v_row.material_id, v_row.warehouse_id,
        v_row.branch_id, v_row.cost_center_id,
        v_good_qty, v_qty_base_good,
        v_unit_cost, v_good_cost,
        'disassemble_produce', 'invoice', p_invoice_id, v_row.id,
        v_row.expiry_date, v_row.serial_number
      );
    end if;
  end loop;
end;
$$;

comment on function public.post_invoice_apply_disassembly(
  uuid, uuid, public.invoices, public.invoice_patterns,
  public.company_inventory_settings, uuid, uuid, numeric
) is
  'تفكيك منتج مجمّع: إخراج المنتج + إدخال مكوّنات صالحة + مصروف تالف.';

grant execute on function public.post_invoice_apply_disassembly(
  uuid, uuid, public.invoices, public.invoice_patterns,
  public.company_inventory_settings, uuid, uuid, numeric
) to authenticated;

-- بذرة نمط تفكيك
insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind,
  numbering_prefix, warehouse_movement, generate_journal,
  pricing_consumed_mode, pricing_cost_mode, pricing_material_mode,
  enforce_stock_availability, sort_order
)
select
  'تفكيك', 'Disassembly', 'output', 'disassembly',
  'DSA', true, true,
  'weighted_avg', 'line_net', 'none',
  true, 96
where not exists (
  select 1 from public.invoice_patterns
  where commercial_kind = 'disassembly' and name_ar = 'تفكيك'
);

insert into public.invoice_pattern_conditions (pattern_id, require_warehouse)
select p.id, true
from public.invoice_patterns p
where p.commercial_kind = 'disassembly'
  and not exists (
    select 1 from public.invoice_pattern_conditions c where c.pattern_id = p.id
  );

-- تتبع أدوار التفكيك مثل التصنيع
create or replace function public.invoice_material_lines_validate_tracking()
returns trigger
language plpgsql
as $$
declare
  v_kind varchar(30);
  v_status varchar(20);
  v_tracking_kind varchar(30);
begin
  select ip.commercial_kind, i.status
  into v_kind, v_status
  from public.invoices i
  inner join public.invoice_patterns ip on ip.id = i.pattern_id
  where i.id = new.invoice_id;

  if v_status = 'posted' then
    raise exception 'Cannot modify material lines on a posted invoice.';
  end if;

  if v_kind in ('manufacturing', 'disassembly') then
    if new.manufacturing_role is null
       or new.manufacturing_role not in ('consume', 'produce') then
      raise exception 'Manufacturing/disassembly line requires role consume or produce.';
    end if;
    v_tracking_kind := case new.manufacturing_role
      when 'consume' then 'sale'
      when 'produce' then 'purchase'
    end;
  else
    if new.manufacturing_role is not null then
      raise exception 'manufacturing_role is only allowed on manufacturing/disassembly invoices.';
    end if;
    v_tracking_kind := v_kind;
  end if;

  perform public.assert_material_line_tracking(
    new.material_id,
    v_tracking_kind,
    new.expiry_date,
    new.serial_number
  );

  return new;
end;
$$;
-- ---------------------------------------------------------------------------
-- 7) post_invoice مع فرع التفكيك
-- ---------------------------------------------------------------------------

create or replace function public.post_invoice(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_pat public.invoice_patterns%rowtype;
  v_inv_settings public.company_inventory_settings%rowtype;
  v_je_id uuid;
  v_entry_no varchar(40);
  v_rate numeric(18, 6);
  v_creditor uuid;
  v_debtor uuid;
  v_cost uuid;
  v_inventory uuid;
  v_transit uuid;
  v_material_total numeric(18, 2) := 0;
  v_account_debit numeric(18, 2) := 0;
  v_account_credit numeric(18, 2) := 0;
  v_je_debit numeric(18, 2);
  v_je_credit numeric(18, 2);
  v_party_type varchar(20);
  v_party_id uuid;
  v_row record;
  v_line_cost numeric(18, 2);
  v_has_materials boolean;
  v_discount_acct uuid;
  v_extra_acct uuid;
  v_invoice_disc numeric(18, 2) := 0;
  v_line_gross numeric(18, 2);
  v_line_disc numeric(18, 2);
  v_line_extra numeric(18, 2);
  v_qty_recv numeric(18, 6);
  v_qty_base_recv numeric(18, 6);
  v_round_step numeric(18, 4);
  v_party_total numeric(18, 2);
  v_rounded_total numeric(18, 2);
  v_rounding_diff numeric(18, 2);
begin
  perform set_config('app.invoice_posting', 'true', true);

  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found.';
  end if;

  if v_inv.status = 'posted' then
    raise exception 'Invoice is already posted.';
  end if;

  if v_inv.status = 'cancelled' then
    raise exception 'Cannot post cancelled invoice.';
  end if;

  perform public.assert_invoice_may_post(p_invoice_id);

  perform public.assert_accounting_period_open(v_inv.invoice_date, v_inv.branch_id);

  select * into v_pat from public.invoice_patterns where id = v_inv.pattern_id;
  select * into v_inv_settings from public.company_inventory_settings where id = 1;

  v_creditor := coalesce(v_inv.creditor_account_id, v_pat.default_creditor_account_id);
  v_debtor := coalesce(v_inv.debtor_account_id, v_pat.default_debtor_account_id);
  v_cost := coalesce(v_inv.cost_account_id, v_pat.default_cost_account_id);
  v_inventory := coalesce(v_inv.inventory_account_id, v_pat.default_inventory_account_id);
  v_transit := coalesce(v_inv.transfer_transit_account_id, v_pat.transfer_transit_account_id);
  v_rate := coalesce(nullif(v_inv.exchange_rate, 0), 1);

  select coalesce(sum(iml.line_amount), 0)
  into v_material_total
  from public.invoice_material_lines iml
  where iml.invoice_id = p_invoice_id;

  select
    coalesce(sum(case when ial.side = 'debit' then ial.amount else 0 end), 0),
    coalesce(sum(case when ial.side = 'credit' then ial.amount else 0 end), 0)
  into v_account_debit, v_account_credit
  from public.invoice_account_lines ial
  where ial.invoice_id = p_invoice_id;

  v_has_materials := exists (
    select 1 from public.invoice_material_lines iml where iml.invoice_id = p_invoice_id
  );

  if v_has_materials and v_inv_settings.inventory_method is null then
    raise exception 'Configure inventory_method in company_inventory_settings before posting.';
  end if;

  if not v_has_materials and v_account_debit = 0 and v_account_credit = 0 then
    raise exception 'Cannot post empty invoice.';
  end if;

  if v_inv.customer_id is not null then
    v_party_type := 'customer';
    v_party_id := v_inv.customer_id;
  elsif v_inv.vendor_id is not null then
    v_party_type := 'vendor';
    v_party_id := v_inv.vendor_id;
  else
    v_party_type := null;
    v_party_id := null;
  end if;

  v_entry_no := 'JE-' || v_inv.invoice_no;

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
    v_inv.invoice_date,
    coalesce(v_inv.description, 'مرحّل من فاتورة ' || v_inv.invoice_no),
    'posted',
    'invoice',
    p_invoice_id,
    v_inv.branch_id
  )
  returning id into v_je_id;

  -- أسطر الحسابات الإضافية
  for v_row in
    select * from public.invoice_account_lines ial
    where ial.invoice_id = p_invoice_id
    order by ial.line_no
  loop
    perform public._invoice_add_journal_line(
      v_je_id,
      v_row.account_id,
      case when v_row.side = 'debit' then v_row.amount else 0 end,
      case when v_row.side = 'credit' then v_row.amount else 0 end,
      coalesce(v_row.description, 'حساب إضافي — فاتورة ' || v_inv.invoice_no),
      v_row.cost_center_id,
      v_row.branch_id,
      v_inv.currency_id,
      v_rate,
      null, null, null, null,
      p_invoice_id,
      v_row.id
    );
  end loop;

  v_discount_acct := coalesce(v_inv.discount_account_id, v_pat.default_discount_account_id);
  v_extra_acct := coalesce(v_inv.extra_account_id, v_pat.default_extra_account_id);

  -- مواد + قيود حسب النوع التجاري
  case v_pat.commercial_kind
  when 'sale' then
    if v_creditor is null or v_debtor is null then
      raise exception 'Sale invoice requires creditor and debtor accounts.';
    end if;

    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_gross := round((v_row.quantity * v_row.unit_price)::numeric, 2);
      v_line_disc := coalesce(v_row.discount_amount, 0);
      v_line_extra := coalesce(v_row.extra_amount, 0);

      if v_line_disc > 0 and v_discount_acct is null then
        raise exception 'Line discount requires discount_account_id on invoice or pattern.';
      end if;
      if v_line_extra > 0 and v_extra_acct is null then
        raise exception 'Line extra requires extra_account_id on invoice or pattern.';
      end if;

      if v_line_disc > 0 or v_line_extra > 0 then
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_line_gross,
          'مبيعات — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null,
          p_invoice_id, v_row.id
        );
        if v_line_disc > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_discount_acct, v_line_disc, 0,
            'خصم سطر — ' || v_inv.invoice_no,
            v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null,
            p_invoice_id, v_row.id
          );
        end if;
        if v_line_extra > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_extra_acct, 0, v_line_extra,
            'إضافي سطر — ' || v_inv.invoice_no,
            v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null,
            p_invoice_id, v_row.id
          );
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, v_row.line_amount, 0,
          case when v_inv.settlement_mode = 'credit' then 'ذمم عميل' else 'نقدي' end,
          coalesce(v_row.cost_center_id, v_inv.cost_center_id), v_row.branch_id,
          v_inv.currency_id, v_rate,
          case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
          case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.due_date else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.payment_terms_days else null end,
          p_invoice_id, v_row.id
        );
      else
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_row.line_amount,
          'مبيعات — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null,
          p_invoice_id, v_row.id
        );

        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, v_row.line_amount, 0,
          case when v_inv.settlement_mode = 'credit' then 'ذمم عميل' else 'نقدي' end,
          coalesce(v_row.cost_center_id, v_inv.cost_center_id), v_row.branch_id,
          v_inv.currency_id, v_rate,
          case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
          case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.due_date else null end,
          case when v_inv.settlement_mode = 'credit' then v_inv.payment_terms_days else null end,
          p_invoice_id, v_row.id
        );
      end if;

      if v_inv_settings.inventory_method = 'perpetual'
         and v_cost is not null and v_inventory is not null then
        v_line_cost := public.calc_outbound_line_total_cost(
          v_pat.pricing_consumed_mode,
          v_inv_settings,
          v_row.purchase_price,
          v_row.unit_price,
          v_row.factor_to_base,
          v_row.quantity_base,
          v_row.material_id,
          v_row.warehouse_id,
          v_row.cost_center_id,
          v_row.expiry_date,
          v_row.serial_number,
          v_inv.invoice_date
        );
        if v_line_cost > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_cost, v_line_cost, 0,
            'تكلفة مبيعات', v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null, p_invoice_id, v_row.id
          );
          perform public._invoice_add_journal_line(
            v_je_id, v_inventory, 0, v_line_cost,
            'مخزون', v_row.cost_center_id, v_row.branch_id,
            v_inv.currency_id, v_rate,
            null, null, null, null, p_invoice_id, v_row.id
          );
        end if;
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        -v_row.quantity, -v_row.quantity_base,
        v_row.purchase_price, v_row.line_amount,
        'sale', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'purchase' then
    if v_creditor is null then
      raise exception 'Purchase invoice requires creditor account (payable/cash).';
    end if;

    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_gross := round((v_row.quantity * v_row.unit_price)::numeric, 2);
      v_line_disc := coalesce(v_row.discount_amount, 0);
      v_line_extra := coalesce(v_row.extra_amount, 0);

      if v_line_disc > 0
         and not coalesce(v_pat.line_adjustments_affect_material_cost, true)
         and v_discount_acct is null then
        raise exception 'Line discount requires discount_account_id on invoice or pattern.';
      end if;
      if v_line_extra > 0
         and not coalesce(v_pat.line_adjustments_affect_material_cost, true)
         and v_extra_acct is null then
        raise exception 'Line extra requires extra_account_id on invoice or pattern.';
      end if;

      v_line_cost := public.calc_inbound_inventory_amount(
        v_pat.pricing_cost_mode,
        coalesce(v_pat.line_adjustments_affect_material_cost, true),
        v_row.line_amount,
        v_line_gross,
        v_line_disc
      );

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Perpetual purchase requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory,
          v_line_cost,
          0,
          'مشتريات — مخزون', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        if v_debtor is null then
          raise exception 'Periodic purchase requires debtor/purchases account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor,
          v_line_cost,
          0,
          'مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      -- خصم منفصل فقط عندما لا يدخل في تكلفة المخزون (نفس منطق الإضافي)
      if v_line_disc > 0
         and not coalesce(v_pat.line_adjustments_affect_material_cost, true) then
        perform public._invoice_add_journal_line(
          v_je_id, v_discount_acct, 0, v_line_disc,
          'خصم سطر — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      if v_line_extra > 0 and not coalesce(v_pat.line_adjustments_affect_material_cost, true) then
        perform public._invoice_add_journal_line(
          v_je_id, v_extra_acct, v_line_extra, 0,
          'إضافي سطر — ' || v_inv.invoice_no,
          v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      perform public._invoice_add_journal_line(
        v_je_id, v_creditor, 0, v_row.line_amount,
        case when v_inv.settlement_mode = 'credit' then 'ذمم مورد' else 'نقدي' end,
        coalesce(v_row.cost_center_id, v_inv.cost_center_id), v_row.branch_id,
        v_inv.currency_id, v_rate,
        case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
        case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
        case when v_inv.settlement_mode = 'credit' then v_inv.due_date else null end,
        case when v_inv.settlement_mode = 'credit' then v_inv.payment_terms_days else null end,
        p_invoice_id, v_row.id
      );

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_row.quantity, v_row.quantity_base,
        v_row.unit_price, v_row.line_amount,
        'purchase', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'transfer_out' then
    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_cost := public.calc_outbound_line_total_cost(
        v_pat.pricing_consumed_mode,
        v_inv_settings,
        v_row.purchase_price,
        v_row.unit_price,
        v_row.factor_to_base,
        v_row.quantity_base,
        v_row.material_id,
        v_row.warehouse_id,
        v_row.cost_center_id,
        v_row.expiry_date,
        v_row.serial_number,
        v_inv.invoice_date
      );

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Transfer out (perpetual) requires inventory account.';
        end if;
        if v_transit is null then
          raise exception 'Transfer out (perpetual) requires transit account on pattern/invoice.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_transit, v_line_cost, 0,
          'بضاعة بالطريق — إخراج', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, 0, v_line_cost,
          'مخزون مصدر — إخراج', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        -v_row.quantity, -v_row.quantity_base,
        v_row.purchase_price, v_line_cost,
        'transfer_out', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

    if v_inv.inventory_transfer_id is not null then
      update public.inventory_transfers
      set status = 'dispatched', shipped_at = coalesce(shipped_at, now()), out_invoice_id = p_invoice_id
      where id = v_inv.inventory_transfer_id;
    end if;

  when 'transfer_in' then
    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_qty_recv := coalesce(v_row.qty_received, v_row.quantity);
      if v_qty_recv < 0 then
        raise exception 'qty_received cannot be negative.';
      end if;
      if v_qty_recv > v_row.quantity then
        raise exception 'qty_received cannot exceed ordered quantity.';
      end if;

      v_qty_base_recv := public.material_quantity_to_base(
        v_row.material_unit_id,
        v_qty_recv
      );

      v_line_gross := round((v_row.quantity * v_row.unit_price)::numeric, 2);
      v_line_cost := public.calc_inbound_inventory_amount(
        v_pat.pricing_cost_mode,
        coalesce(v_pat.line_adjustments_affect_material_cost, true),
        v_row.line_amount,
        v_line_gross,
        0
      );
      if v_line_cost <= 0 then
        v_line_cost := public.calc_outbound_line_total_cost(
          v_pat.pricing_consumed_mode,
          v_inv_settings,
          v_row.purchase_price,
          v_row.unit_price,
          v_row.factor_to_base,
          v_row.quantity_base,
          v_row.material_id,
          v_row.warehouse_id,
          v_row.cost_center_id,
          v_row.expiry_date,
          v_row.serial_number,
          v_inv.invoice_date
        );
      end if;

      -- تناسب التكلفة مع الكمية المستلمة عند الاستلام الجزئي
      if v_row.quantity_base > 0
         and v_qty_base_recv is distinct from v_row.quantity_base then
        v_line_cost := round(
          (v_line_cost * v_qty_base_recv / v_row.quantity_base)::numeric,
          2
        );
      end if;

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null or v_transit is null then
          raise exception 'Transfer in (perpetual) requires inventory and transit accounts.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, v_line_cost, 0,
          'مخزون هدف — إدخال', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_transit, 0, v_line_cost,
          'إغلاق بالطريق — إدخال', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_qty_recv,
        v_qty_base_recv,
        case
          when v_qty_base_recv > 0 then round((v_line_cost / v_qty_base_recv)::numeric, 4)
          else v_row.purchase_price
        end,
        v_line_cost,
        'transfer_in', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

    if v_inv.inventory_transfer_id is not null then
      update public.inventory_transfers
      set
        status = case
          when exists (
            select 1 from public.inventory_transfer_lines itl
            where itl.transfer_id = v_inv.inventory_transfer_id
              and itl.qty_received < itl.qty_shipped
              and itl.qty_shipped > 0
          ) then 'partially_received'
          else 'received'
        end,
        received_at = coalesce(received_at, now()),
        in_invoice_id = p_invoice_id
      where id = v_inv.inventory_transfer_id;
    end if;

  when 'return_sale' then
    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      perform public._invoice_add_journal_line(
        v_je_id, v_creditor, v_row.line_amount, 0,
        'مرتجع مبيعات', v_row.cost_center_id, v_row.branch_id,
        v_inv.currency_id, v_rate,
        null, null, null, null, p_invoice_id, v_row.id
      );
      perform public._invoice_add_journal_line(
        v_je_id, v_debtor, 0, v_row.line_amount,
        'ذمم عميل — مرتجع', v_row.cost_center_id, v_row.branch_id,
        v_inv.currency_id, v_rate,
        v_party_type, v_party_id, v_inv.due_date, v_inv.payment_terms_days,
        p_invoice_id, v_row.id
      );

      if v_inv_settings.inventory_method = 'perpetual'
         and v_cost is not null and v_inventory is not null then
        v_line_cost := public.calc_outbound_line_total_cost(
          v_pat.pricing_consumed_mode,
          v_inv_settings,
          v_row.purchase_price,
          v_row.unit_price,
          v_row.factor_to_base,
          v_row.quantity_base,
          v_row.material_id,
          v_row.warehouse_id,
          v_row.cost_center_id,
          v_row.expiry_date,
          v_row.serial_number,
          v_inv.invoice_date
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, v_line_cost, 0,
          'مخزون — مرتجع', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate, null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_cost, 0, v_line_cost,
          'تكلفة — مرتجع', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate, null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_row.quantity, v_row.quantity_base,
        v_row.purchase_price, v_row.line_amount,
        'return_sale', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'return_purchase' then
    if v_creditor is null then
      raise exception 'Return purchase requires creditor account (payable).';
    end if;

    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_cost := public.calc_outbound_line_total_cost(
        v_pat.pricing_consumed_mode,
        v_inv_settings,
        v_row.purchase_price,
        v_row.unit_price,
        v_row.factor_to_base,
        v_row.quantity_base,
        v_row.material_id,
        v_row.warehouse_id,
        v_row.cost_center_id,
        v_row.expiry_date,
        v_row.serial_number,
        v_inv.invoice_date
      );

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Return purchase (perpetual) requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, v_row.line_amount, 0,
          'ذمم مورد — مرتجع مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          v_party_type, v_party_id, v_inv.due_date, v_inv.payment_terms_days,
          p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, 0, v_line_cost,
          'مخزون — مرتجع مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        if v_debtor is null then
          raise exception 'Return purchase (periodic) requires debtor/purchases account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, v_row.line_amount, 0,
          'ذمم مورد — مرتجع مشتريات', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          v_party_type, v_party_id, v_inv.due_date, v_inv.payment_terms_days,
          p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, 0, v_row.line_amount,
          'مشتريات — مرتجع', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        -v_row.quantity, -v_row.quantity_base,
        v_row.unit_price, v_row.line_amount,
        'return_purchase', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'opening_stock' then
    if v_creditor is null then
      raise exception 'Opening stock requires creditor account (opening equity / counterpart).';
    end if;

    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
      inner join public.material_units mu on mu.id = iml.material_unit_id
      where iml.invoice_id = p_invoice_id
      order by iml.line_no
    loop
      v_line_cost := public.calc_inbound_inventory_amount(
        v_pat.pricing_cost_mode,
        coalesce(v_pat.line_adjustments_affect_material_cost, true),
        v_row.line_amount,
        round((v_row.quantity * v_row.unit_price)::numeric, 2),
        coalesce(v_row.discount_amount, 0)
      );

      if v_inv_settings.inventory_method = 'perpetual' then
        if v_inventory is null then
          raise exception 'Opening stock (perpetual) requires inventory account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_inventory, v_line_cost, 0,
          'مخزون — بضاعة أول المدة', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_line_cost,
          'بضاعة أول المدة — طرف مقابل', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        if v_debtor is null then
          raise exception 'Opening stock (periodic) requires debtor account.';
        end if;
        perform public._invoice_add_journal_line(
          v_je_id, v_debtor, v_line_cost, 0,
          'بضاعة أول المدة', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          v_je_id, v_creditor, 0, v_line_cost,
          'بضاعة أول المدة — طرف مقابل', v_row.cost_center_id, v_row.branch_id,
          v_inv.currency_id, v_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;

      insert into public.inventory_movements (
        movement_date, material_id, warehouse_id, branch_id, cost_center_id,
        quantity_delta, quantity_base_delta, unit_cost, total_cost,
        movement_kind, source_type, source_id, source_line_id
      )
      values (
        v_inv.invoice_date, v_row.material_id, v_row.warehouse_id, v_row.branch_id, v_row.cost_center_id,
        v_row.quantity, v_row.quantity_base,
        v_row.unit_price, v_row.line_amount,
        'opening_stock', 'invoice', p_invoice_id, v_row.id
      );
    end loop;

  when 'manufacturing' then
    -- المنطق الكامل في patch_invoice_manufacturing.sql
    perform public.post_invoice_apply_manufacturing(
      p_invoice_id,
      v_je_id,
      v_inv,
      v_pat,
      v_inv_settings,
      v_inventory,
      v_rate
    );

  when 'disassembly' then
    perform public.post_invoice_apply_disassembly(
      p_invoice_id,
      v_je_id,
      v_inv,
      v_pat,
      v_inv_settings,
      v_inventory,
      v_cost,
      v_rate
    );

  else
    raise exception 'Unsupported commercial_kind: %', v_pat.commercial_kind;
  end case;

  -- خصم الفاتورة + تدوير الإجمالي (§9 / §التخفيض)
  if coalesce(v_inv.invoice_discount_percent, 0) > 0 then
    v_invoice_disc := round((v_material_total * v_inv.invoice_discount_percent / 100)::numeric, 2);
  elsif coalesce(v_inv.invoice_discount_amount, 0) > 0 then
    v_invoice_disc := v_inv.invoice_discount_amount;
  end if;

  if v_invoice_disc > 0 then
    if v_discount_acct is null then
      raise exception 'Invoice discount requires discount_account_id on invoice or pattern.';
    end if;
    case v_pat.commercial_kind
    when 'sale' then
      if v_debtor is null then
        raise exception 'Sale discount requires debtor account.';
      end if;
      perform public._invoice_add_journal_line(
        v_je_id, v_discount_acct, v_invoice_disc, 0,
        'خصم فاتورة — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        null, null, null, null, p_invoice_id, null
      );
      perform public._invoice_add_journal_line(
        v_je_id, v_debtor, 0, v_invoice_disc,
        'تخفيض ذمم — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
        case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
        null, null, p_invoice_id, null
      );
    when 'purchase' then
      if v_creditor is null then
        raise exception 'Purchase discount requires creditor account.';
      end if;
      perform public._invoice_add_journal_line(
        v_je_id, v_creditor, v_invoice_disc, 0,
        'خصم مشتريات — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
        case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
        null, null, p_invoice_id, null
      );
      perform public._invoice_add_journal_line(
        v_je_id, v_discount_acct, 0, v_invoice_disc,
        'خصم مكتسب — ' || v_inv.invoice_no,
        v_inv.cost_center_id, v_inv.branch_id,
        v_inv.currency_id, v_rate,
        null, null, null, null, p_invoice_id, null
      );
    else
      null;
    end case;
  end if;

  if v_pat.rounding_enabled
     and coalesce(v_pat.rounding_target, 'invoice_total') in ('invoice_total', 'both')
     and v_pat.commercial_kind in ('sale', 'purchase') then
    v_round_step := coalesce(nullif(v_pat.rounding_step, 0), 1);
    v_party_total := v_material_total - v_invoice_disc;
    v_rounded_total := case coalesce(v_pat.rounding_mode, 'nearest')
      when 'up' then ceil(v_party_total / v_round_step - 0.0000001) * v_round_step
      when 'down' then floor(v_party_total / v_round_step + 0.0000001) * v_round_step
      else round(v_party_total / v_round_step) * v_round_step
    end;
    v_rounding_diff := round((v_rounded_total - v_party_total)::numeric, 2);

    if v_rounding_diff <> 0 then
      case v_pat.commercial_kind
      when 'sale' then
        if v_debtor is null then
          raise exception 'Sale rounding requires debtor account.';
        end if;
        if v_rounding_diff > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_debtor, v_rounding_diff, 0,
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        else
          perform public._invoice_add_journal_line(
            v_je_id, v_debtor, 0, abs(v_rounding_diff),
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        end if;
      when 'purchase' then
        if v_creditor is null then
          raise exception 'Purchase rounding requires creditor account.';
        end if;
        if v_rounding_diff > 0 then
          perform public._invoice_add_journal_line(
            v_je_id, v_creditor, 0, v_rounding_diff,
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        else
          perform public._invoice_add_journal_line(
            v_je_id, v_creditor, abs(v_rounding_diff), 0,
            'تدوير فاتورة — ' || v_inv.invoice_no,
            v_inv.cost_center_id, v_inv.branch_id,
            v_inv.currency_id, v_rate,
            case when v_inv.settlement_mode = 'credit' then v_party_type else null end,
            case when v_inv.settlement_mode = 'credit' then v_party_id else null end,
            null, null, p_invoice_id, null
          );
        end if;
      else
        null;
      end case;
    end if;
  end if;

  -- توازن القيد
  select
    coalesce(sum(debit), 0),
    coalesce(sum(credit), 0)
  into v_je_debit, v_je_credit
  from public.journal_entry_lines
  where journal_entry_id = v_je_id;

  if v_je_debit <> v_je_credit then
    raise exception 'Posted invoice journal is unbalanced: debit (%) <> credit (%).', v_je_debit, v_je_credit;
  end if;

  if v_has_materials then
    perform public.lock_company_inventory_foundation(v_inv.invoice_date::timestamptz);
  end if;

  update public.invoices
  set status = 'posted', journal_entry_id = v_je_id, updated_at = now()
  where id = p_invoice_id;

  perform set_config('app.invoice_posting', 'false', true);

  return v_je_id;
exception
  when others then
    perform set_config('app.invoice_posting', 'false', true);
    raise;
end;
$$;

grant execute on function public.post_invoice(uuid) to authenticated;
