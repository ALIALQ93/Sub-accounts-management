-- =============================================================================
-- patch_create_material_with_base_unit.sql (#42)
-- =============================================================================
-- إنشاء مادة + وحدة الأساس في معاملة واحدة (يمنع مادة بدون وحدة).
-- يتطلب: patch_materials_item_card.sql / patch_materials_tracking.sql
-- =============================================================================

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
begin
  if coalesce(nullif(trim(p_material->>'material_code'), ''), '') = '' then
    raise exception 'material_code is required.';
  end if;
  if coalesce(nullif(trim(p_material->>'name_ar'), ''), '') = '' then
    raise exception 'name_ar is required.';
  end if;

  v_unit_code := upper(trim(coalesce(p_base_unit->>'unit_code', '')));
  v_unit_name := trim(coalesce(p_base_unit->>'name_ar', ''));
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
    require_serial_on_outbound
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
    coalesce((p_material->>'require_serial_on_outbound')::boolean, false)
  )
  returning id into v_material_id;

  insert into public.material_units (
    material_id,
    unit_code,
    name_ar,
    name_en,
    is_base_unit,
    factor_to_base,
    is_active,
    purchase_price,
    sale_price,
    semi_wholesale_price,
    wholesale_price,
    sort_order
  )
  values (
    v_material_id,
    v_unit_code,
    v_unit_name,
    nullif(trim(coalesce(p_base_unit->>'name_en', '')), ''),
    true,
    1,
    coalesce((p_base_unit->>'is_active')::boolean, true),
    coalesce(
      nullif(p_base_unit->>'purchase_price', '')::numeric,
      (p_material->>'purchase_price')::numeric
    ),
    coalesce(
      nullif(p_base_unit->>'sale_price', '')::numeric,
      (p_material->>'sale_price')::numeric
    ),
    nullif(p_base_unit->>'semi_wholesale_price', '')::numeric,
    nullif(p_base_unit->>'wholesale_price', '')::numeric,
    0
  );

  return v_material_id;
end;
$$;

comment on function public.create_material_with_base_unit(jsonb, jsonb) is
  'إنشاء مادة مع وحدة الأساس ذرّياً — يمنع مادة بدون وحدة قياس';

grant execute on function public.create_material_with_base_unit(jsonb, jsonb)
  to authenticated;

-- مساعد: مواد بدون وحدة أساس (للواجهة والتقارير)
create or replace function public.list_material_ids_missing_base_unit()
returns table (material_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from public.materials m
  where not exists (
    select 1
    from public.material_units mu
    where mu.material_id = m.id
      and mu.is_base_unit = true
  );
$$;

grant execute on function public.list_material_ids_missing_base_unit()
  to authenticated;
