-- =============================================================================
-- patch_inventory_cost_policy.sql
-- =============================================================================
-- مراحل 0–4: مصفوفة أثر التكلفة، قفل الاتجاه من الطبيعة، تفكيك A/B،
-- طبائع جردية (scrap/shortage/surplus)، تحميل تكاليف المناقلة على transfer_in.
-- يتطلب: patch_composite_disassembly.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) أعمدة الأنماط
-- ---------------------------------------------------------------------------

alter table public.invoice_patterns
  add column if not exists disassembly_cost_mode varchar(40) null;

alter table public.invoice_patterns
  add column if not exists freight_affects_material_cost boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_patterns_disassembly_cost_mode_check'
  ) then
    alter table public.invoice_patterns
      add constraint invoice_patterns_disassembly_cost_mode_check
      check (
        disassembly_cost_mode is null
        or disassembly_cost_mode in (
          'allocate_from_parent',
          'components_at_current_cost'
        )
      );
  end if;
end $$;

comment on column public.invoice_patterns.disassembly_cost_mode is
  'تفكيك: allocate_from_parent (افتراضي) | components_at_current_cost + فرق';
comment on column public.invoice_patterns.freight_affects_material_cost is
  'عند true: تكاليف الحسابات الإضافية على مناقلة الإدخال تُحمَّل على unit_cost';

update public.invoice_patterns
set disassembly_cost_mode = coalesce(disassembly_cost_mode, 'allocate_from_parent')
where commercial_kind = 'disassembly';

-- ---------------------------------------------------------------------------
-- 0) مصفوفة أثر التكلفة حسب الطبيعة
-- ---------------------------------------------------------------------------

create or replace function public.invoice_kind_expected_direction(p_kind varchar)
returns varchar
language sql
immutable
as $$
  select case p_kind
    when 'sale' then 'output'
    when 'purchase' then 'input'
    when 'transfer_out' then 'output'
    when 'transfer_in' then 'input'
    when 'return_sale' then 'input'
    when 'return_purchase' then 'output'
    when 'opening_stock' then 'input'
    when 'manufacturing' then 'output'
    when 'disassembly' then 'output'
    when 'inventory_scrap' then 'output'
    when 'inventory_shortage' then 'output'
    when 'inventory_surplus' then 'input'
    else null
  end;
$$;

comment on function public.invoice_kind_expected_direction(varchar) is
  'الاتجاه المشتق من commercial_kind — مصدر حقيقة للأنماط';

create or replace function public.invoice_kind_cost_impact(p_kind varchar)
returns varchar
language sql
immutable
as $$
  select case p_kind
    -- consume_only: يصرف بتكلفة المخزون دون إعادة تكليف بسعر السطر/البيع
    when 'sale' then 'consume_only'
    when 'transfer_out' then 'consume_only'
    when 'inventory_scrap' then 'inventory_adjust'
    when 'inventory_shortage' then 'inventory_adjust'
    -- update_inbound: يحدّث أساس التكلفة من الوارد
    when 'purchase' then 'update_inbound'
    when 'opening_stock' then 'update_inbound'
    when 'transfer_in' then 'update_inbound'
    when 'inventory_surplus' then 'inventory_adjust'
    when 'return_sale' then 'update_inbound'
    -- reverse_inbound: إخراج يعكس أثر شراء على قيمة المخزون
    when 'return_purchase' then 'reverse_inbound'
    -- allocate_transform: تحويل قيمة بين أسطر consume/produce
    when 'manufacturing' then 'allocate_transform'
    when 'disassembly' then 'allocate_transform'
    else 'none'
  end;
$$;

comment on function public.invoice_kind_cost_impact(varchar) is
  $c$
  أثر التكلفة حسب الطبيعة.
  perpetual: قيد مخزون/تكلفة فوري مع الحركة حيث ينطبق.
  periodic: نفس unit_cost على الحركات؛ قيد المخزون كأصل غير فوري (ما عدا التجاري).
  sale = consume_only — لا يستخدم سعر البيع لإعادة تكليف الباقي.
  return_purchase = reverse_inbound — يجب أن يعدّل قيمة المخزون.
  $c$;

create or replace function public.invoice_is_inbound_kind(p_kind varchar)
returns boolean
language sql
immutable
as $$
  select p_kind in (
    'purchase', 'opening_stock', 'return_sale', 'transfer_in',
    'inventory_surplus'
  );
$$;

create or replace function public.invoice_is_outbound_kind(p_kind varchar)
returns boolean
language sql
immutable
as $$
  select p_kind in (
    'sale', 'return_purchase', 'transfer_out',
    'inventory_scrap', 'inventory_shortage'
  );
$$;

create or replace function public.invoice_kind_affects_material_line_cost(p_kind varchar)
returns boolean
language sql
immutable
as $$
  select public.invoice_kind_cost_impact(p_kind) in (
    'update_inbound',
    'allocate_transform',
    'inventory_adjust'
  )
  and public.invoice_is_inbound_kind(p_kind);
$$;

create or replace function public.invoice_kind_allows_line_price_consumed(p_kind varchar)
returns boolean
language sql
immutable
as $$
  -- line_price على المبيعات يلوّث المتوسط — غير مسموح كسياسة افتراضية
  select p_kind not in ('sale', 'inventory_scrap', 'inventory_shortage');
$$;

-- ---------------------------------------------------------------------------
-- 1) قفل اتجاه النمط من الطبيعة
-- ---------------------------------------------------------------------------

create or replace function public.invoice_patterns_sync_direction_from_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dir varchar(10);
begin
  v_dir := public.invoice_kind_expected_direction(new.commercial_kind);
  if v_dir is null then
    raise exception 'Unsupported commercial_kind on pattern: %', new.commercial_kind;
  end if;
  new.direction := v_dir;
  new.is_return := new.commercial_kind in ('return_sale', 'return_purchase');
  new.is_opening_stock := new.commercial_kind = 'opening_stock';
  if new.commercial_kind = 'disassembly' then
    new.disassembly_cost_mode := coalesce(
      new.disassembly_cost_mode,
      'allocate_from_parent'
    );
  end if;
  if new.commercial_kind in (
    'inventory_scrap', 'inventory_shortage', 'inventory_surplus',
    'opening_stock', 'manufacturing', 'disassembly',
    'transfer_out', 'transfer_in'
  ) then
    new.warehouse_movement := true;
  end if;
  if new.pricing_consumed_mode = 'line_price'
     and not public.invoice_kind_allows_line_price_consumed(new.commercial_kind) then
    raise exception
      'pricing_consumed_mode=line_price is not allowed for commercial_kind=% (would revalue inventory from sale/scrap price).',
      new.commercial_kind;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_patterns_sync_direction on public.invoice_patterns;
create trigger trg_invoice_patterns_sync_direction
  before insert or update of commercial_kind, direction, pricing_consumed_mode, disassembly_cost_mode
  on public.invoice_patterns
  for each row
  execute function public.invoice_patterns_sync_direction_from_kind();

-- مزامنة الصفوف الحالية
update public.invoice_patterns p
set direction = public.invoice_kind_expected_direction(p.commercial_kind)
where public.invoice_kind_expected_direction(p.commercial_kind) is not null
  and p.direction is distinct from public.invoice_kind_expected_direction(p.commercial_kind);

-- ---------------------------------------------------------------------------
-- حركات المخزون — أنواع جردية
-- ---------------------------------------------------------------------------

alter table public.inventory_movements
  drop constraint if exists inventory_movements_movement_kind_check;

alter table public.inventory_movements
  add constraint inventory_movements_movement_kind_check
  check (movement_kind in (
    'sale', 'purchase', 'transfer_out', 'transfer_in',
    'return_sale', 'return_purchase', 'opening_stock', 'adjustment',
    'manufacture_consume', 'manufacture_produce',
    'disassemble_consume', 'disassemble_produce',
    'inventory_scrap', 'inventory_shortage', 'inventory_surplus'
  ));

-- ---------------------------------------------------------------------------
-- 2) تفكيك — allocate_from_parent | components_at_current_cost
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
       or coalesce(v_row.composite_mode, 'kit') is distinct from 'disassemblable' then
      raise exception
        'Disassembly consume line % (%) must be a disassemblable composite material.',
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

comment on function public.post_invoice_apply_disassembly(
  uuid, uuid, public.invoices, public.invoice_patterns,
  public.company_inventory_settings, uuid, uuid, numeric
) is
  'تفكيك: allocate_from_parent (افتراضي) أو components_at_current_cost مع فرق على حساب التكلفة';

-- ---------------------------------------------------------------------------
-- 3) طبائع جردية متقدمة — scrap / shortage / surplus
-- ---------------------------------------------------------------------------

create or replace function public.post_invoice_apply_inventory_nature(
  p_invoice_id uuid,
  p_je_id uuid,
  p_inv public.invoices,
  p_pat public.invoice_patterns,
  p_inv_settings public.company_inventory_settings,
  p_inventory_account_id uuid,
  p_adjustment_account_id uuid,
  p_rate numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_kind varchar(30) := p_pat.commercial_kind;
  v_line_cost numeric(18, 2);
  v_unit_cost numeric(18, 4);
  v_sign numeric(18, 6);
  v_movement_kind varchar(30);
  v_label text;
begin
  if v_kind not in ('inventory_scrap', 'inventory_shortage', 'inventory_surplus') then
    raise exception 'post_invoice_apply_inventory_nature: unexpected kind %', v_kind;
  end if;

  if v_kind = 'inventory_surplus' then
    v_sign := 1;
    v_movement_kind := 'inventory_surplus';
    v_label := 'فائض جرد';
  elsif v_kind = 'inventory_scrap' then
    v_sign := -1;
    v_movement_kind := 'inventory_scrap';
    v_label := 'إخراج تالف';
  else
    v_sign := -1;
    v_movement_kind := 'inventory_shortage';
    v_label := 'عجز جرد';
  end if;

  for v_row in
    select iml.*, m.purchase_price, mu.factor_to_base
    from public.invoice_material_lines iml
    inner join public.materials m on m.id = iml.material_id
    inner join public.material_units mu on mu.id = iml.material_unit_id
    where iml.invoice_id = p_invoice_id
    order by iml.line_no
  loop
    -- دائماً متوسط المخزن (لا سعر بيع)
    v_unit_cost := public.calc_outbound_unit_cost(
      coalesce(nullif(p_pat.pricing_consumed_mode, 'line_price'), 'weighted_avg'),
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
    v_line_cost := round((abs(v_row.quantity_base) * coalesce(v_unit_cost, 0))::numeric, 2);

    if p_inv_settings.inventory_method = 'perpetual' and v_line_cost > 0 then
      if p_inventory_account_id is null then
        raise exception '% (perpetual) requires inventory account.', v_label;
      end if;
      if p_adjustment_account_id is null then
        raise exception '% (perpetual) requires cost/adjustment account.', v_label;
      end if;
      if v_sign > 0 then
        perform public._invoice_add_journal_line(
          p_je_id, p_inventory_account_id, v_line_cost, 0,
          v_label || ' — مخزون', v_row.cost_center_id, v_row.branch_id,
          p_inv.currency_id, p_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          p_je_id, p_adjustment_account_id, 0, v_line_cost,
          v_label || ' — طرف مقابل', v_row.cost_center_id, v_row.branch_id,
          p_inv.currency_id, p_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      else
        perform public._invoice_add_journal_line(
          p_je_id, p_adjustment_account_id, v_line_cost, 0,
          v_label || ' — مصروف/تسوية', v_row.cost_center_id, v_row.branch_id,
          p_inv.currency_id, p_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
        perform public._invoice_add_journal_line(
          p_je_id, p_inventory_account_id, 0, v_line_cost,
          v_label || ' — مخزون', v_row.cost_center_id, v_row.branch_id,
          p_inv.currency_id, p_rate,
          null, null, null, null, p_invoice_id, v_row.id
        );
      end if;
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
      v_sign * v_row.quantity,
      v_sign * v_row.quantity_base,
      coalesce(v_unit_cost, 0),
      v_line_cost,
      v_movement_kind, 'invoice', p_invoice_id, v_row.id,
      v_row.expiry_date, v_row.serial_number
    );
  end loop;
end;
$$;

comment on function public.post_invoice_apply_inventory_nature is
  'أنماط جردية متقدمة: تالف/عجز/فائض — unit_cost = متوسط المخزن دائماً';

grant execute on function public.post_invoice_apply_inventory_nature(
  uuid, uuid, public.invoices, public.invoice_patterns,
  public.company_inventory_settings, uuid, uuid, numeric
) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) تحميل تكاليف المناقلة على transfer_in
-- ---------------------------------------------------------------------------

create or replace function public.apply_transfer_in_freight_to_cost(
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
  v_freight numeric(18, 2);
  v_qty_sum numeric(18, 6);
  v_remaining numeric(18, 2);
  v_alloc numeric(18, 2);
  v_row record;
  v_cnt int;
  v_i int := 0;
  v_contra uuid;
begin
  if p_pat.commercial_kind is distinct from 'transfer_in' then
    return;
  end if;
  if not coalesce(p_pat.freight_affects_material_cost, true) then
    return;
  end if;

  -- مجموع مدين الحسابات الإضافية باستثناء حساب المخزون (لتجنب ازدواج)
  select coalesce(sum(ial.amount), 0)
  into v_freight
  from public.invoice_account_lines ial
  where ial.invoice_id = p_invoice_id
    and ial.side = 'debit'
    and (
      p_inventory_account_id is null
      or ial.account_id is distinct from p_inventory_account_id
    );

  if v_freight <= 0 then
    return;
  end if;

  select coalesce(sum(abs(im.quantity_base_delta)), 0), count(*)
  into v_qty_sum, v_cnt
  from public.inventory_movements im
  where im.source_type = 'invoice'
    and im.source_id = p_invoice_id
    and im.movement_kind = 'transfer_in';

  if v_cnt = 0 or v_qty_sum <= 0 then
    return;
  end if;

  v_remaining := v_freight;

  for v_row in
    select
      im.id,
      im.quantity_base_delta,
      im.total_cost,
      im.unit_cost,
      im.cost_center_id,
      im.branch_id,
      row_number() over (order by im.id) as rn,
      count(*) over () as cnt
    from public.inventory_movements im
    where im.source_type = 'invoice'
      and im.source_id = p_invoice_id
      and im.movement_kind = 'transfer_in'
    order by im.id
  loop
    v_i := v_i + 1;
    if v_row.rn = v_row.cnt then
      v_alloc := v_remaining;
    else
      v_alloc := round(
        (v_freight * abs(v_row.quantity_base_delta) / v_qty_sum)::numeric,
        2
      );
      v_remaining := v_remaining - v_alloc;
    end if;

    update public.inventory_movements
    set
      total_cost = round((coalesce(total_cost, 0) + v_alloc)::numeric, 2),
      unit_cost = case
        when abs(quantity_base_delta) > 0 then
          round(
            ((coalesce(total_cost, 0) + v_alloc) / abs(quantity_base_delta))::numeric,
            4
          )
        else unit_cost
      end
    where id = v_row.id;

    if p_inv_settings.inventory_method = 'perpetual' and v_alloc > 0 then
      if p_inventory_account_id is null then
        raise exception 'Transfer freight (perpetual) requires inventory account.';
      end if;
      -- إعادة تصنيف: مدين مخزون / دائن حساب التكلفة أو الإضافي
      v_contra := coalesce(
        p_pat.default_cost_account_id,
        p_pat.default_extra_account_id,
        p_inv.cost_account_id
      );
      if v_contra is null then
        raise exception
          'Transfer freight capitalization requires cost/extra account on pattern.';
      end if;
      perform public._invoice_add_journal_line(
        p_je_id, p_inventory_account_id, v_alloc, 0,
        'مناقلة — تحميل تكلفة نقل على المخزون',
        v_row.cost_center_id, v_row.branch_id,
        p_inv.currency_id, p_rate,
        null, null, null, null, p_invoice_id, null
      );
      perform public._invoice_add_journal_line(
        p_je_id, v_contra, 0, v_alloc,
        'مناقلة — رسملة مصروف نقل',
        v_row.cost_center_id, v_row.branch_id,
        p_inv.currency_id, p_rate,
        null, null, null, null, p_invoice_id, null
      );
    end if;
  end loop;
end;
$$;

comment on function public.apply_transfer_in_freight_to_cost is
  'يرفع unit_cost لأسطر transfer_in بمبلغ الحسابات الإضافية؛ مستمر: رسملة لمخزون';

grant execute on function public.apply_transfer_in_freight_to_cost(
  uuid, uuid, public.invoices, public.invoice_patterns,
  public.company_inventory_settings, uuid, numeric
) to authenticated;

-- ---------------------------------------------------------------------------
-- 3أ) توثيق تسوية سريعة — متوسط المخزن فقط
-- ---------------------------------------------------------------------------

comment on function public.post_stock_adjustment(
  uuid, uuid, numeric, uuid, uuid, date, text, uuid
) is
  'تسوية جرد سريعة: unit_cost = متوسط المستودع (أو purchase_price). العجز والفائض بنفس المرجع — لا سعر بيع.';

-- ---------------------------------------------------------------------------
-- بذور أنماط جردية متقدمة
-- ---------------------------------------------------------------------------

insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind,
  numbering_prefix, warehouse_movement, generate_journal, sort_order,
  pricing_consumed_mode, pricing_material_mode
)
select
  'إخراج تالف', 'Inventory Scrap', 'output', 'inventory_scrap',
  'SCR', true, true, 85,
  'weighted_avg', 'none'
where not exists (
  select 1 from public.invoice_patterns where commercial_kind = 'inventory_scrap'
);

insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind,
  numbering_prefix, warehouse_movement, generate_journal, sort_order,
  pricing_consumed_mode, pricing_material_mode
)
select
  'عجز جرد', 'Inventory Shortage', 'output', 'inventory_shortage',
  'SHT', true, true, 86,
  'weighted_avg', 'none'
where not exists (
  select 1 from public.invoice_patterns where commercial_kind = 'inventory_shortage'
);

insert into public.invoice_patterns (
  name_ar, name_en, direction, commercial_kind,
  numbering_prefix, warehouse_movement, generate_journal, sort_order,
  pricing_consumed_mode, pricing_cost_mode, pricing_material_mode
)
select
  'فائض جرد', 'Inventory Surplus', 'input', 'inventory_surplus',
  'SUR', true, true, 87,
  'weighted_avg', 'none', 'none'
where not exists (
  select 1 from public.invoice_patterns where commercial_kind = 'inventory_surplus'
);

update public.invoice_patterns
set freight_affects_material_cost = true
where commercial_kind = 'transfer_in'
  and freight_affects_material_cost is distinct from true;

-- ---------------------------------------------------------------------------
-- post_invoice — فروع جردية + تحميل تكاليف المناقلة
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

  
    perform public.apply_transfer_in_freight_to_cost(
      p_invoice_id,
      v_je_id,
      v_inv,
      v_pat,
      v_inv_settings,
      v_inventory,
      v_rate
    );
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

  when 'inventory_scrap' then
    perform public.post_invoice_apply_inventory_nature(
      p_invoice_id, v_je_id, v_inv, v_pat, v_inv_settings,
      v_inventory, coalesce(v_cost, v_pat.default_extra_account_id), v_rate
    );

  when 'inventory_shortage' then
    perform public.post_invoice_apply_inventory_nature(
      p_invoice_id, v_je_id, v_inv, v_pat, v_inv_settings,
      v_inventory, coalesce(v_cost, v_pat.default_extra_account_id), v_rate
    );

  when 'inventory_surplus' then
    perform public.post_invoice_apply_inventory_nature(
      p_invoice_id, v_je_id, v_inv, v_pat, v_inv_settings,
      v_inventory, coalesce(v_cost, v_pat.default_extra_account_id), v_rate
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

-- ---------------------------------------------------------------------------
-- إعادة تعريف فحص الرصيد ليشمل الطبائع الجردية (عند تطبيق الـpatch منفرداً)
-- ---------------------------------------------------------------------------

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
    'inventory_scrap', 'inventory_shortage', 'adjustment'
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
