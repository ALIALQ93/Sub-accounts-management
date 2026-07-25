-- =============================================================================
-- Minimal fix: add materials.composite_mode (required by current web app)
-- Safe to re-run. Full manufacturing/disassembly RPCs remain in
-- patch_composite_disassembly.sql — run that when you need kit/finished/disassemble.
-- =============================================================================

alter table public.materials
  add column if not exists composite_mode varchar(20) null;

update public.materials
set composite_mode = 'kit'
where material_kind = 'composite'
  and composite_mode is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'materials_composite_mode_chk'
  ) then
    alter table public.materials
      add constraint materials_composite_mode_chk
      check (
        (
          material_kind = 'normal'
          and composite_mode is null
        )
        or (
          material_kind = 'composite'
          and composite_mode in ('kit', 'finished', 'disassemblable')
        )
      );
  end if;
end $$;

comment on column public.materials.composite_mode is
  'تجميعية فقط: kit=تفكيك عند الإخراج، finished=منتج نهائي، disassemblable=تفكيك مع تالف';

create or replace function public.materials_composite_mode_sync()
returns trigger
language plpgsql
as $$
begin
  if new.material_kind = 'normal' then
    new.composite_mode := null;
  elsif new.material_kind = 'composite' and new.composite_mode is null then
    new.composite_mode := 'kit';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_materials_composite_mode_sync on public.materials;
create trigger trg_materials_composite_mode_sync
  before insert or update of material_kind, composite_mode
  on public.materials
  for each row
  execute function public.materials_composite_mode_sync();

-- Refresh PostgREST schema cache (Supabase)
notify pgrst, 'reload schema';
