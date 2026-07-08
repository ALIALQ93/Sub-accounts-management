-- =============================================================================
-- patch_inventory_cost_dimensions.sql — أبعاد فصل التكلفة (صلاحية / تسلسلي)
-- =============================================================================
-- يتطلب: patch_outbound_lot_stock.sql
-- التالي: —
-- =============================================================================

alter table public.company_inventory_settings
  add column if not exists cost_per_expiry_date boolean not null default false,
  add column if not exists cost_per_serial_number boolean not null default false;

comment on column public.company_inventory_settings.cost_per_expiry_date is
  'عند true: تكلفة الوحدة تُفصل per تاريخ انتهاء الصلاحية (دفعات صلاحية)';
comment on column public.company_inventory_settings.cost_per_serial_number is
  'عند true: تكلفة الوحدة تُفصل per رقم تسلسلي (دفعات تسلسلية)';

create or replace function public.company_inventory_settings_guard_locked()
returns trigger
language plpgsql
as $$
begin
  if old.foundation_locked and (
    new.inventory_method is distinct from old.inventory_method
    or new.costing_method is distinct from old.costing_method
    or new.cost_per_warehouse is distinct from old.cost_per_warehouse
    or new.cost_per_cost_center is distinct from old.cost_per_cost_center
    or new.cost_per_expiry_date is distinct from old.cost_per_expiry_date
    or new.cost_per_serial_number is distinct from old.cost_per_serial_number
    or new.track_quantity_on_movement is distinct from old.track_quantity_on_movement
  ) then
    raise exception
      'Inventory foundation settings are locked. Cannot change inventory_method, costing_method, or cost separation.';
  end if;

  if new.foundation_locked and not old.foundation_locked then
    new.foundation_locked_at := coalesce(new.foundation_locked_at, now());
  end if;

  if new.foundation_locked and old.foundation_locked
     and new.foundation_locked_at is distinct from old.foundation_locked_at then
    if old.foundation_locked_at is not null then
      new.foundation_locked_at := old.foundation_locked_at;
    end if;
  end if;

  return new;
end;
$$;

comment on column public.company_inventory_settings.foundation_locked is
  'عند true: لا تعديل على inventory_method, costing_method, cost_per_* (مستودع، CC، صلاحية، تسلسلي)';
