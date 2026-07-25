-- =============================================================================
-- patch_materials_bom_nested.sql (#48)
-- =============================================================================
-- يسمح بتجميع مادة تجميعية من مكوّنات تجميعية أخرى (BOM متعدد المستويات)،
-- وليس فقط من مواد عادية كما كان في patch_materials_card_v2.sql.
--   1) السماح بمكوّن تجميعي (كان يُشترط 'normal' فقط)
--   2) منع الدورات الحلقية (مادة تدخل ضمن مكوّناتها بشكل غير مباشر)
--   3) تفكيك BOM بشكل recursive حتى الوصول لمواد عادية (أوراق الشجرة)
-- يتطلب: patch_materials_card_v2.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) فحص الدورات الحلقية قبل قبول مكوّن تجميعي
-- ---------------------------------------------------------------------------

create or replace function public.material_bom_would_cycle(
  p_parent_material_id uuid,
  p_component_material_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive descendants as (
    select b.component_material_id
    from public.material_bom_components b
    where b.parent_material_id = p_component_material_id

    union

    select b.component_material_id
    from public.material_bom_components b
    join descendants d on b.parent_material_id = d.component_material_id
  )
  select
    p_parent_material_id = p_component_material_id
    or exists (
      select 1 from descendants d where d.component_material_id = p_parent_material_id
    );
$$;

comment on function public.material_bom_would_cycle(uuid, uuid) is
  'true لو إضافة component كمكوّن لـ parent يُنشئ دورة حلقية (parent يظهر ضمن سلسلة مكوّنات component)';

grant execute on function public.material_bom_would_cycle(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) السماح بمكوّن تجميعي + منع الدورات الحلقية
-- ---------------------------------------------------------------------------

create or replace function public.material_bom_components_validate()
returns trigger
language plpgsql
as $$
declare
  v_parent_kind varchar(20);
  v_comp_kind varchar(20);
  v_qty_base numeric(18, 6);
begin
  select material_kind into v_parent_kind
  from public.materials where id = new.parent_material_id;

  if v_parent_kind is distinct from 'composite' then
    raise exception 'BOM components are only allowed on composite materials.';
  end if;

  select material_kind into v_comp_kind
  from public.materials where id = new.component_material_id;

  if v_comp_kind is distinct from 'normal' and v_comp_kind is distinct from 'composite' then
    raise exception 'BOM component must be a normal or composite material.';
  end if;

  if public.material_bom_would_cycle(new.parent_material_id, new.component_material_id) then
    raise exception 'This component would create a circular BOM reference.';
  end if;

  if new.component_unit_id is not null then
    if not exists (
      select 1 from public.material_units mu
      where mu.id = new.component_unit_id
        and mu.material_id = new.component_material_id
        and mu.is_active
    ) then
      raise exception 'component_unit_id must belong to the component material.';
    end if;
    v_qty_base := public.material_quantity_to_base(new.component_unit_id, new.quantity);
  else
    v_qty_base := new.quantity;
  end if;

  if coalesce(v_qty_base, 0) <= 0 then
    raise exception 'BOM quantity_base must be > 0.';
  end if;

  new.quantity_base := round(v_qty_base::numeric, 6);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) لم يعد هناك ما يمنع تحويل مادة إلى تجميعية لمجرد أنها مكوّن في مكان آخر
--    (الحماية من الدورات الحلقية أصبحت عند إدراج/تعديل صف BOM نفسه أعلاه)
-- ---------------------------------------------------------------------------

create or replace function public.materials_kind_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and old.material_kind = 'composite'
     and new.material_kind = 'normal'
     and exists (
       select 1 from public.material_bom_components b
       where b.parent_material_id = new.id
     ) then
    raise exception 'Remove BOM components before changing material kind to normal.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) تفكيك BOM بشكل recursive حتى الوصول لمواد عادية فقط
--    (المستهلكة فعلياً من المخزون والمستخدمة في التكلفة)
-- ---------------------------------------------------------------------------

create or replace function public.explode_material_bom(
  p_material_id uuid,
  p_quantity_base numeric
)
returns table (
  component_material_id uuid,
  quantity_base numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_kind varchar(20);
begin
  select material_kind into v_kind
  from public.materials where id = p_material_id;

  if v_kind is distinct from 'composite' then
    component_material_id := p_material_id;
    quantity_base := p_quantity_base;
    return next;
    return;
  end if;

  if not exists (
    select 1 from public.material_bom_components b
    where b.parent_material_id = p_material_id
  ) then
    raise exception 'Composite material has no BOM components.';
  end if;

  return query
  with recursive exploded as (
    select
      b.component_material_id as component_material_id,
      round((b.quantity_base * p_quantity_base)::numeric, 6) as quantity_base,
      b.sort_order as sort_order,
      1 as depth,
      array[p_material_id] as path
    from public.material_bom_components b
    where b.parent_material_id = p_material_id

    union all

    select
      b.component_material_id,
      round((b.quantity_base * e.quantity_base)::numeric, 6),
      b.sort_order,
      e.depth + 1,
      e.path || b.parent_material_id
    from public.material_bom_components b
    join exploded e on b.parent_material_id = e.component_material_id
    where e.depth < 50
      and not (b.parent_material_id = any(e.path))
  )
  select e.component_material_id, e.quantity_base
  from exploded e
  join public.materials m on m.id = e.component_material_id
  where m.material_kind = 'normal'
  order by e.depth, e.sort_order;
end;
$$;

comment on function public.explode_material_bom(uuid, numeric) is
  'يفكك مادة تجميعية بشكل recursive حتى مواد عادية فقط (أوراق الشجرة) — يدعم تجميعية داخل تجميعية';
