-- =============================================================================
-- patch_opening_entry.sql — قيد افتتاحي + فهرس per فرع/سنة
-- =============================================================================
-- يتطلب: patch_branches.sql، patch_journal_dimensions.sql
-- التالي: (اختياري) تحديث get_trial_balance لفصل حركة الافتتاح
-- =============================================================================

alter table public.vouchers
  add column if not exists is_opening_entry boolean not null default false;

alter table public.journal_entries
  add column if not exists is_opening_entry boolean not null default false;

comment on column public.vouchers.is_opening_entry is
  'سند قيد افتتاحي — ميزانية بداية الفترة';
comment on column public.journal_entries.is_opening_entry is
  'قيد مولّد من سند افتتاحي — يُفصل في ميزان المراجعة';

create index if not exists idx_vouchers_is_opening_entry
  on public.vouchers(is_opening_entry)
  where is_opening_entry = true;

create index if not exists idx_journal_entries_is_opening_entry
  on public.journal_entries(is_opening_entry)
  where is_opening_entry = true;

-- قيد افتتاحي مرحّل واحد per (فرع، سنة)
create unique index if not exists idx_vouchers_opening_per_branch_year
  on public.vouchers (
    branch_id,
    (extract(year from voucher_date)::int)
  )
  where is_opening_entry = true
    and status = 'posted'
    and branch_id is not null;

-- نسخ العلامة إلى القيد عند الترحيل
create or replace function public.sync_voucher_journal_opening_flag()
returns trigger
language plpgsql
as $$
begin
  if new.journal_entry_id is not null and new.is_opening_entry then
    update public.journal_entries
    set is_opening_entry = true
    where id = new.journal_entry_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vouchers_sync_journal_opening on public.vouchers;
create trigger trg_vouchers_sync_journal_opening
after insert or update of journal_entry_id, is_opening_entry on public.vouchers
for each row execute function public.sync_voucher_journal_opening_flag();
