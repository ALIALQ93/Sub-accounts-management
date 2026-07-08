-- =============================================================================
-- patch_outbound_stock_check.sql (#36)
-- =============================================================================
-- المرحلة 1: منع ترحيل فواتير الإخراج إذا الكمية تتجاوز الرصيد المتاح
-- (مادة + مستودع). يُتحكم به من النمط: enforce_stock_availability.
-- =============================================================================

alter table public.invoice_patterns
  add column if not exists enforce_stock_availability boolean not null default true;

comment on column public.invoice_patterns.enforce_stock_availability is
  'عند true: فواتير الإخراج لا تُرحَّل إذا الكمية تتجاوز رصيد المادة في المستودع';

-- ---------------------------------------------------------------------------
-- رصيد كمية أساس per مادة/مستودع حتى تاريخ معيّن
-- ---------------------------------------------------------------------------

create or replace function public.get_material_warehouse_qty_balance(
  p_material_id uuid,
  p_warehouse_id uuid,
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
    and im.movement_date <= coalesce(p_as_of_date, current_date);
$$;

comment on function public.get_material_warehouse_qty_balance is
  'رصيد الكمية الأساسية لمادة في مستودع حتى تاريخ معيّن';

grant execute on function public.get_material_warehouse_qty_balance(uuid, uuid, date)
  to authenticated;

-- ---------------------------------------------------------------------------
-- محفز: منع حركات الإخراج التي تتجاوز الرصيد
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

drop trigger if exists trg_inventory_movements_enforce_stock
  on public.inventory_movements;

create trigger trg_inventory_movements_enforce_stock
  before insert on public.inventory_movements
  for each row
  execute function public.inventory_movements_enforce_stock();
