-- =============================================================================
-- patch_materials_tracking.sql (#32)
-- =============================================================================
-- تتبع المادة: صلاحية + رقم تسلسلي + إجبار عند الإدخال/الإخراج.
-- =============================================================================

alter table public.materials
  add column if not exists has_expiry_date boolean not null default false,
  add column if not exists expiry_days int null
    check (expiry_days is null or expiry_days > 0),
  add column if not exists require_expiry_on_inbound boolean not null default false,
  add column if not exists require_expiry_on_outbound boolean not null default false,
  add column if not exists has_serial_number boolean not null default false,
  add column if not exists require_serial_on_inbound boolean not null default false,
  add column if not exists require_serial_on_outbound boolean not null default false;

comment on column public.materials.has_expiry_date is 'يوجد تاريخ صلاحية للمادة';
comment on column public.materials.expiry_days is 'مدة الصلاحية بالأيام — اختياري';
comment on column public.materials.require_expiry_on_inbound is 'إجبار تاريخ الصلاحية عند الإدخال';
comment on column public.materials.require_expiry_on_outbound is 'إجبار تاريخ الصلاحية عند الإخراج';
comment on column public.materials.has_serial_number is 'تتبع برقم تسلسلي';
comment on column public.materials.require_serial_on_inbound is 'إجبار الرقم التسلسلي عند الإدخال';
comment on column public.materials.require_serial_on_outbound is 'إجبار الرقم التسلسلي عند الإخراج';

alter table public.invoice_material_lines
  add column if not exists expiry_date date null,
  add column if not exists serial_number varchar(100) null;

comment on column public.invoice_material_lines.expiry_date is 'تاريخ صلاحية السطر';
comment on column public.invoice_material_lines.serial_number is 'رقم تسلسلي للسطر';

alter table public.inventory_movements
  add column if not exists expiry_date date null,
  add column if not exists serial_number varchar(100) null;

comment on column public.inventory_movements.expiry_date is 'تاريخ صلاحية الحركة';
comment on column public.inventory_movements.serial_number is 'رقم تسلسلي للحركة';

-- ---------------------------------------------------------------------------
-- مساعدات الاتجاه (إدخال / إخراج)
-- ---------------------------------------------------------------------------

create or replace function public.is_inbound_commercial_kind(p_kind varchar)
returns boolean
language sql
immutable
as $$
  select p_kind in (
    'purchase', 'return_sale', 'opening_stock', 'transfer_in'
  );
$$;

create or replace function public.is_outbound_commercial_kind(p_kind varchar)
returns boolean
language sql
immutable
as $$
  select p_kind in (
    'sale', 'return_purchase', 'transfer_out'
  );
$$;

-- ---------------------------------------------------------------------------
-- التحقق من إجبار الصلاحية والرقم التسلسلي
-- ---------------------------------------------------------------------------

create or replace function public.assert_material_line_tracking(
  p_material_id uuid,
  p_commercial_kind varchar,
  p_expiry_date date,
  p_serial_number text
)
returns void
language plpgsql
as $$
declare
  v_mat public.materials%rowtype;
  v_serial text;
begin
  select * into v_mat
  from public.materials
  where id = p_material_id;

  if not found then
    raise exception 'Material not found.';
  end if;

  v_serial := nullif(trim(coalesce(p_serial_number, '')), '');

  if public.is_inbound_commercial_kind(p_commercial_kind) then
    if v_mat.has_expiry_date
       and v_mat.require_expiry_on_inbound
       and p_expiry_date is null then
      raise exception
        'Material % requires expiry date on inbound (%).',
        v_mat.material_code, p_commercial_kind;
    end if;

    if v_mat.has_serial_number
       and v_mat.require_serial_on_inbound
       and v_serial is null then
      raise exception
        'Material % requires serial number on inbound (%).',
        v_mat.material_code, p_commercial_kind;
    end if;
  elsif public.is_outbound_commercial_kind(p_commercial_kind) then
    if v_mat.has_expiry_date
       and v_mat.require_expiry_on_outbound
       and p_expiry_date is null then
      raise exception
        'Material % requires expiry date on outbound (%).',
        v_mat.material_code, p_commercial_kind;
    end if;

    if v_mat.has_serial_number
       and v_mat.require_serial_on_outbound
       and v_serial is null then
      raise exception
        'Material % requires serial number on outbound (%).',
        v_mat.material_code, p_commercial_kind;
    end if;
  end if;
end;
$$;

comment on function public.assert_material_line_tracking is
  'يتحقق من إجبار تاريخ الصلاحية/الرقم التسلسلي حسب إعدادات المادة ونوع الحركة.';

-- ---------------------------------------------------------------------------
-- محفز أسطر الفواتير
-- ---------------------------------------------------------------------------

create or replace function public.invoice_material_lines_validate_tracking()
returns trigger
language plpgsql
as $$
declare
  v_kind varchar(30);
  v_status varchar(20);
begin
  select ip.commercial_kind, i.status
  into v_kind, v_status
  from public.invoices i
  inner join public.invoice_patterns ip on ip.id = i.pattern_id
  where i.id = new.invoice_id;

  if v_status = 'posted' then
    raise exception 'Cannot modify material lines on a posted invoice.';
  end if;

  perform public.assert_material_line_tracking(
    new.material_id,
    v_kind,
    new.expiry_date,
    new.serial_number
  );

  return new;
end;
$$;

drop trigger if exists trg_invoice_material_lines_validate_tracking
  on public.invoice_material_lines;

create trigger trg_invoice_material_lines_validate_tracking
  before insert or update on public.invoice_material_lines
  for each row
  execute function public.invoice_material_lines_validate_tracking();

-- ---------------------------------------------------------------------------
-- نسخ التتبع من سطر الفاتورة إلى حركة المخزون عند الترحيل
-- ---------------------------------------------------------------------------

create or replace function public.inventory_movements_fill_tracking()
returns trigger
language plpgsql
as $$
begin
  if new.source_type = 'invoice' and new.source_line_id is not null then
    select iml.expiry_date, iml.serial_number
    into new.expiry_date, new.serial_number
    from public.invoice_material_lines iml
    where iml.id = new.source_line_id;
  end if;

  return new;
end;
$$;

-- يجب أن يسبق enforce_stock أبجدياً حتى تُنسخ صلاحية/تسلسلي قبل فحص الدفعة
drop trigger if exists trg_inventory_movements_fill_tracking
  on public.inventory_movements;
drop trigger if exists trg_inventory_movements_05_fill_tracking
  on public.inventory_movements;

create trigger trg_inventory_movements_05_fill_tracking
  before insert on public.inventory_movements
  for each row
  execute function public.inventory_movements_fill_tracking();
