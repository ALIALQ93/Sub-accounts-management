-- =============================================================================
-- patch_materials_warehouses_audit_fix.sql (#44)
-- =============================================================================
-- من تدقيق 2026-07-22 (مواد/مستودعات):
-- 1) قفل تزامن advisory عند فحص الرصيد (منع بيع زائد متزامن).
-- 2) ترتيب تريغر: نسخ التتبع قبل enforce_stock حتى يعمل فحص الدفعة.
-- 3) منع تعديل أسطر فاتورة مرحّلة حتى للمدير (تصحيح يتطلب مرتجعاً رسمياً).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) محفز الإخراج — قفل + رصيد عام + دفعة
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

  -- تسلسل فحوصات الرصيد لنفس (مادة، مستودع) داخل المعاملة — يمنع race تحت READ COMMITTED
  perform pg_advisory_xact_lock(
    hashtext(new.material_id::text),
    hashtext(new.warehouse_id::text)
  );

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

comment on function public.inventory_movements_enforce_stock() is
  'يمنع الإخراج الزائد مع قفل advisory على (مادة، مستودع)؛ يفحص رصيد الدفعة عند توفر صلاحية/تسلسلي.';

-- ---------------------------------------------------------------------------
-- 2) نسخ التتبع قبل فحص الرصيد (أبجدياً: 05_ قبل enforce)
-- ---------------------------------------------------------------------------

drop trigger if exists trg_inventory_movements_fill_tracking
  on public.inventory_movements;
drop trigger if exists trg_inventory_movements_05_fill_tracking
  on public.inventory_movements;

create trigger trg_inventory_movements_05_fill_tracking
  before insert on public.inventory_movements
  for each row
  execute function public.inventory_movements_fill_tracking();

-- ---------------------------------------------------------------------------
-- 3) فاتورة مرحّلة: لا تعديل للأسطر حتى للمدير
--    (رأس الفاتورة يبقى كما هو — مثلاً close_invoice_reference)
-- ---------------------------------------------------------------------------

create or replace function public.invoice_lines_prevent_change_when_posted()
returns trigger
language plpgsql
as $$
declare
  v_status varchar(20);
begin
  select i.status into v_status
  from public.invoices i
  where i.id = coalesce(new.invoice_id, old.invoice_id);

  if v_status = 'posted' then
    raise exception 'Cannot modify lines of a posted invoice. Use a return/correction document.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_material_lines_posted_guard on public.invoice_material_lines;
create trigger trg_invoice_material_lines_posted_guard
before insert or update or delete on public.invoice_material_lines
for each row execute function public.invoice_lines_prevent_change_when_posted();

drop trigger if exists trg_invoice_account_lines_posted_guard on public.invoice_account_lines;
create trigger trg_invoice_account_lines_posted_guard
before insert or update or delete on public.invoice_account_lines
for each row execute function public.invoice_lines_prevent_change_when_posted();
