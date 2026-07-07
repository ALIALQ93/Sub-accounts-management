-- =============================================================================
-- patch_expiry_from_invoice.sql (#34)
-- =============================================================================
-- تاريخ انتهاء الصلاحية يُدخل في سطر الفاتورة فقط (وليس حساباً بعدد أيام).
-- إعدادات التتبع والإجبار تبقى في بطاقة المادة (has_expiry_date، require_*).
-- =============================================================================

-- إزالة أعمدة نمط الفاتورة إن وُجدت من نسخة سابقة خاطئة
alter table public.invoice_patterns
  drop column if exists track_expiry_date,
  drop column if exists require_expiry_date;

-- ---------------------------------------------------------------------------
-- التحقق من إجبار الصلاحية والرقم التسلسلي — من بطاقة المادة
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
