-- =============================================================================
-- init_material_lifecycle.sql
-- =============================================================================
-- تهيئة تزايدية (بدون حذف بيانات) لأنواع المواد + سياسة صلاحية ناتج التصنيع.
--
-- الاستخدام:
--   1) قاعدة مُهيَّأة مسبقاً بـ setup_all.sql أو setup_demo_restaurant.sql
--   2) شغّل هذا الملف في Supabase → SQL Editor
--
-- المصدر الموحّد للتعريفات: آخر نسخة في setup_all.sql
--   (create_material_with_base_unit / post_invoice_apply_manufacturing /
--    post_invoice_apply_disassembly)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) أوضاع composite_mode
-- ---------------------------------------------------------------------------

alter table public.materials drop constraint if exists materials_composite_mode_chk;

alter table public.materials
  add constraint materials_composite_mode_chk
  check (
    (
      material_kind = 'normal'
      and composite_mode is null
    )
    or (
      material_kind = 'composite'
      and composite_mode in (
        'kit',
        'semi',
        'semi_disassemblable',
        'finished',
        'disassemblable'
      )
    )
  );

comment on column public.materials.composite_mode is
  'تجميعية: kit|semi|semi_disassemblable|finished|disassemblable — مرحلة × قابلية تفكيك';

-- ---------------------------------------------------------------------------
-- 2) سياسة صلاحية ناتج التصنيع
-- ---------------------------------------------------------------------------

alter table public.company_inventory_settings
  add column if not exists manufacturing_produce_expiry_policy varchar(30) not null default 'min_component';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'company_inventory_settings_mfg_expiry_policy_chk'
  ) then
    alter table public.company_inventory_settings
      add constraint company_inventory_settings_mfg_expiry_policy_chk
      check (
        manufacturing_produce_expiry_policy in (
          'min_component',
          'production_plus_days',
          'min_of_both',
          'manual'
        )
      );
  end if;
end $$;

comment on column public.company_inventory_settings.manufacturing_produce_expiry_policy is
  'اقتراح صلاحية سطر إنتاج التصنيع: min_component|production_plus_days|min_of_both|manual';

-- ---------------------------------------------------------------------------
-- 3) الدوال المحدَّثة
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
    if v_mode not in ('kit', 'semi', 'semi_disassemblable', 'finished', 'disassemblable') then
      raise exception 'composite_mode must be kit, semi, semi_disassemblable, finished, or disassemblable.';
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
        'Manufacturing produce line % (%) is a kit that explodes on outbound. Set composite_mode to semi/finished (optionally disassemblable).',
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
  v_mode varchar(40);
  v_comp_current_total numeric(18, 2) := 0;
  v_variance numeric(18, 2);
  v_comp_unit numeric(18, 4);
begin
  v_mode := coalesce(p_pat.disassembly_cost_mode, 'allocate_from_parent');

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
       or coalesce(v_row.composite_mode, 'kit') not in ('disassemblable', 'semi_disassemblable') then
      raise exception
        'Disassembly consume line % (%) must be a disassemblable composite (finished or semi).',
        v_row.line_no, v_row.material_code;
    end if;
  end loop;

  -- إخراج المنتج المجمّع بتكلفته الحالية
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

  if v_mode = 'components_at_current_cost' then
    -- إدخال المكوّنات بمتوسطها الحالي؛ الفرق مقابل الأب → ربح/خسارة تفكيك
    for v_row in
      select iml.*, m.purchase_price, mu.factor_to_base
      from public.invoice_material_lines iml
      inner join public.materials m on m.id = iml.material_id
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

      v_qty_base_good := public.material_quantity_to_base(
        v_row.material_unit_id,
        v_good_qty
      );

      v_comp_unit := public.calc_outbound_unit_cost(
        p_pat.pricing_consumed_mode,
        p_inv_settings,
        v_row.purchase_price,
        v_row.unit_price,
        v_row.factor_to_base,
        v_row.material_id,
        v_row.warehouse_id,
        v_row.cost_center_id,
        v_row.expiry_date,
        v_row.serial_number,
        p_inv.invoice_date
      );

      v_good_cost := round((v_qty_base_good * coalesce(v_comp_unit, 0))::numeric, 2);
      v_dmg_cost := round(
        (
          public.material_quantity_to_base(v_row.material_unit_id, v_dmg_qty)
          * coalesce(v_comp_unit, 0)
        )::numeric,
        2
      );
      v_comp_current_total := v_comp_current_total + v_good_cost + v_dmg_cost;

      if p_inv_settings.inventory_method = 'perpetual' then
        if v_good_cost > 0 then
          if p_inventory_account_id is null then
            raise exception 'Disassembly (perpetual) requires inventory account.';
          end if;
          perform public._invoice_add_journal_line(
            p_je_id, p_inventory_account_id, v_good_cost, 0,
            'تفكيك — إدخال مكوّن (تكلفة حالية)', v_row.cost_center_id, v_row.branch_id,
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
          coalesce(v_comp_unit, 0), v_good_cost,
          'disassemble_produce', 'invoice', p_invoice_id, v_row.id,
          v_row.expiry_date, v_row.serial_number
        );
      end if;
    end loop;

    v_variance := round((v_total_consume - v_comp_current_total)::numeric, 2);
    if abs(v_variance) > 0.001 then
      if p_cost_account_id is null then
        raise exception
          'Disassembly variance (components_at_current_cost) requires default_cost_account_id.';
      end if;
      if p_inv_settings.inventory_method = 'perpetual' then
        if v_variance > 0 then
          -- قيمة الأب أعلى من المكوّنات → مصروف/خسارة تفكيك
          perform public._invoice_add_journal_line(
            p_je_id, p_cost_account_id, v_variance, 0,
            'تفكيك — فرق تكلفة', p_inv.cost_center_id, p_inv.branch_id,
            p_inv.currency_id, p_rate,
            null, null, null, null, p_invoice_id, null
          );
        else
          -- قيمة المكوّنات أعلى → تخفيض مصروف / إيراد فرق
          perform public._invoice_add_journal_line(
            p_je_id, p_cost_account_id, 0, abs(v_variance),
            'تفكيك — فرق تكلفة', p_inv.cost_center_id, p_inv.branch_id,
            p_inv.currency_id, p_rate,
            null, null, null, null, p_invoice_id, null
          );
        end if;
      end if;
    end if;

    return;
  end if;

  -- الوضع الافتراضي: distribute parent cost
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

-- =============================================================================
-- اكتملت التهيئة التزايدية
-- تحقق سريع:
--   select composite_mode from public.materials limit 1;
--   select manufacturing_produce_expiry_policy from public.company_inventory_settings where id = 1;
-- =============================================================================