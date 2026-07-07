-- =============================================================================
-- patch_audit_remaining.sql (#30)
-- =============================================================================
-- بنود AUDIT_REMAINING.md المنخفضة: دوران تصنيفات المواد + قفل فرع المستودع.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- تصنيفات المواد — منع التسلسل الدائري (مثل دليل الحسابات)
-- ---------------------------------------------------------------------------

create or replace function public.material_categories_apply_hierarchy_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'Material category cannot be parent of itself.';
    end if;

    if tg_op = 'UPDATE' then
      if exists (
        with recursive descendants as (
          select id, parent_id
          from public.material_categories
          where parent_id = old.id
          union all
          select c.id, c.parent_id
          from public.material_categories c
          inner join descendants d on c.parent_id = d.id
        )
        select 1
        from descendants
        where id = new.parent_id
      ) then
        raise exception 'Circular material category hierarchy is not allowed.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_material_categories_hierarchy on public.material_categories;
create trigger trg_material_categories_hierarchy
before insert or update on public.material_categories
for each row execute function public.material_categories_apply_hierarchy_rules();

-- ---------------------------------------------------------------------------
-- المستودعات — منع تغيير الفرع بعد حركات مخزنية
-- ---------------------------------------------------------------------------

create or replace function public.warehouses_prevent_branch_change_with_movements()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.branch_id is distinct from new.branch_id then
    if exists (
      select 1
      from public.inventory_movements im
      where im.warehouse_id = old.id
      limit 1
    ) then
      raise exception
        'Cannot change warehouse branch after inventory movements exist.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_warehouses_prevent_branch_change on public.warehouses;
create trigger trg_warehouses_prevent_branch_change
before update on public.warehouses
for each row execute function public.warehouses_prevent_branch_change_with_movements();

comment on function public.material_categories_apply_hierarchy_rules() is
  'يمنع التصنيف من أن يكون أباً لأحد أسلافه';

comment on function public.warehouses_prevent_branch_change_with_movements() is
  'يمنع نقل المستودع لفرع آخر بعد تسجيل حركات مخزنية';
