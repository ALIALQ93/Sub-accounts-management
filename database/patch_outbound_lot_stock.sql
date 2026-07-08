-- =============================================================================
-- patch_outbound_lot_stock.sql (#37)
-- =============================================================================
-- المرحلة 2+3: رصيد per دفعة (تاريخ صلاحية / رقم تسلسلي) لفواتير الإخراج.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- رصيد دفعة: مادة + مستودع + صلاحية + تسلسلي
-- ---------------------------------------------------------------------------

create or replace function public.get_inventory_lot_balance(
  p_material_id uuid,
  p_warehouse_id uuid,
  p_expiry_date date,
  p_serial_number text,
  p_as_of_date date default current_date
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(im.quantity_base_delta), 0)::numeric(18, 6)
  from public.inventory_movements im
  where im.material_id = p_material_id
    and im.warehouse_id = p_warehouse_id
    and im.movement_date <= coalesce(p_as_of_date, current_date)
    and im.expiry_date is not distinct from p_expiry_date
    and nullif(trim(coalesce(im.serial_number, '')), '')
      is not distinct from nullif(trim(coalesce(p_serial_number, '')), '');
$$;

comment on function public.get_inventory_lot_balance is
  'رصيد دفعة مخزون per مادة/مستودع/صلاحية/تسلسلي';

grant execute on function public.get_inventory_lot_balance(uuid, uuid, date, text, date)
  to authenticated;

-- ---------------------------------------------------------------------------
-- قائمة الدفعات المتاحة (رصيد > 0)
-- ---------------------------------------------------------------------------

drop function if exists public.list_inventory_lot_balances(uuid, uuid, date);

create or replace function public.list_inventory_lot_balances(
  p_material_id uuid,
  p_warehouse_id uuid,
  p_as_of_date date default current_date
)
returns table (
  expiry_date date,
  serial_number varchar,
  quantity_base numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    im.expiry_date,
    nullif(trim(im.serial_number), '')::varchar as serial_number,
    sum(im.quantity_base_delta)::numeric(18, 6) as quantity_base
  from public.inventory_movements im
  where im.material_id = p_material_id
    and im.warehouse_id = p_warehouse_id
    and im.movement_date <= coalesce(p_as_of_date, current_date)
  group by im.expiry_date, nullif(trim(im.serial_number), '')
  having sum(im.quantity_base_delta) > 0.000001
  order by im.expiry_date nulls last, nullif(trim(im.serial_number), '');
$$;

comment on function public.list_inventory_lot_balances is
  'دفعات مخزون متاحة per مادة/مستودع';

grant execute on function public.list_inventory_lot_balances(uuid, uuid, date)
  to authenticated;

-- ---------------------------------------------------------------------------
-- محفز الإخراج — رصيد إجمالي + دفعة صلاحية/تسلسلي
-- ---------------------------------------------------------------------------

create or replace function public.inventory_movements_enforce_stock()
returns trigger
language plpgsql
as $$
declare
  v_balance numeric(18, 6);
  v_lot_balance numeric(18, 6);
  v_enforce boolean := true;
  v_material_code varchar;
  v_warehouse_code varchar;
  v_has_expiry boolean;
  v_has_serial boolean;
  v_serial text;
begin
  if new.quantity_base_delta >= 0 then
    return new;
  end if;

  if new.movement_kind not in ('sale', 'transfer_out', 'return_purchase') then
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

  select m.material_code, m.has_expiry_date, m.has_serial_number
  into v_material_code, v_has_expiry, v_has_serial
  from public.materials m
  where m.id = new.material_id;

  select w.warehouse_code into v_warehouse_code
  from public.warehouses w
  where w.id = new.warehouse_id;

  v_serial := nullif(trim(coalesce(new.serial_number, '')), '');

  v_balance := public.get_material_warehouse_qty_balance(
    new.material_id,
    new.warehouse_id,
    new.movement_date
  );

  if v_balance + new.quantity_base_delta < -0.000001 then
    raise exception
      'Insufficient stock for material % in warehouse %. Available: %, requested: %.',
      coalesce(v_material_code, new.material_id::text),
      coalesce(v_warehouse_code, new.warehouse_id::text),
      v_balance,
      abs(new.quantity_base_delta);
  end if;

  if (v_has_expiry and new.expiry_date is not null)
     or (v_has_serial and v_serial is not null) then
    v_lot_balance := public.get_inventory_lot_balance(
      new.material_id,
      new.warehouse_id,
      case when v_has_expiry then new.expiry_date else null end,
      case when v_has_serial then v_serial else null end,
      new.movement_date
    );

    if v_lot_balance + new.quantity_base_delta < -0.000001 then
      raise exception
        'Insufficient lot stock for material % in warehouse %. Expiry: %, serial: %, available: %, requested: %.',
        coalesce(v_material_code, new.material_id::text),
        coalesce(v_warehouse_code, new.warehouse_id::text),
        coalesce(new.expiry_date::text, '—'),
        coalesce(v_serial, '—'),
        v_lot_balance,
        abs(new.quantity_base_delta);
    end if;
  end if;

  return new;
end;
$$;
