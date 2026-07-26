-- =============================================================================
-- patch_material_category_cascade_deactivate.sql
-- =============================================================================
-- عند تعطيل صنف أب: تعطيل كل الأصناف الفرعية والمواد التابعة لها تلقائياً.
-- التفعيل لا يُعاد متسلسلاً (قد يكون الفرع عُطِّل يدوياً عن قصد).
-- =============================================================================

create or replace function public.material_categories_cascade_deactivate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- تجاهل التحديثات المتداخلة الناتجة عن نفس التريغر
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.is_active is true
     and new.is_active is false then
    -- أصناف فرعية (كل المستويات)
    with recursive descendants as (
      select c.id
      from public.material_categories c
      where c.parent_id = new.id
      union all
      select c.id
      from public.material_categories c
      inner join descendants d on c.parent_id = d.id
    )
    update public.material_categories mc
    set is_active = false
    where mc.id in (select id from descendants)
      and mc.is_active is true;

    -- مواد هذا الصنف + فروعه
    with recursive tree as (
      select new.id as id
      union all
      select c.id
      from public.material_categories c
      inner join tree t on c.parent_id = t.id
    )
    update public.materials m
    set is_active = false
    where m.category_id in (select id from tree)
      and m.is_active is true;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_material_categories_cascade_deactivate
  on public.material_categories;
create trigger trg_material_categories_cascade_deactivate
after update of is_active on public.material_categories
for each row execute function public.material_categories_cascade_deactivate();

comment on function public.material_categories_cascade_deactivate() is
  'يعطّل الأصناف الفرعية والمواد التابعة عند تعطيل صنف أب';
