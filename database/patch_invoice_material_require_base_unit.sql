-- =============================================================================
-- patch_invoice_material_require_base_unit.sql (#45)
-- =============================================================================
-- يرفض إضافة/تعديل سطر مادة على فاتورة إذا المادة بلا وحدة أساس.
-- (بديل عن ربط materials_require_base_unit عند إنشاء المادة — الإنشاء الذرّي يبقى)
-- =============================================================================

create or replace function public.invoice_material_lines_require_base_unit()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.material_units mu
    where mu.material_id = new.material_id
      and mu.is_base_unit = true
  ) then
    raise exception
      'Material % has no base unit. Complete the material card before using it on invoices.',
      new.material_id;
  end if;
  return new;
end;
$$;

comment on function public.invoice_material_lines_require_base_unit() is
  'يمنع أسطر فاتورة لمادة بلا وحدة أساس (تدقيق مواد #9).';

drop trigger if exists trg_invoice_material_lines_require_base_unit
  on public.invoice_material_lines;

create trigger trg_invoice_material_lines_require_base_unit
  before insert or update of material_id on public.invoice_material_lines
  for each row
  execute function public.invoice_material_lines_require_base_unit();
