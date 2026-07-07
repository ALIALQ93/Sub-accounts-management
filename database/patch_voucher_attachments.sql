-- =============================================================================
-- patch_voucher_attachments.sql — مرفقات السندات
-- =============================================================================

create table if not exists public.voucher_attachments (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0),
  storage_path text not null,
  uploaded_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_voucher_attachments_voucher_id
  on public.voucher_attachments(voucher_id);

create unique index if not exists idx_voucher_attachments_storage_path
  on public.voucher_attachments(storage_path);

create or replace function public.voucher_attachments_validate()
returns trigger
language plpgsql
as $$
declare
  v_voucher_status varchar(20);
begin
  select status
  into v_voucher_status
  from public.vouchers
  where id = coalesce(new.voucher_id, old.voucher_id);

  if v_voucher_status in ('posted', 'cancelled') then
    raise exception 'Voucher attachments cannot be changed for posted or cancelled vouchers.';
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_voucher_attachments_validate_insert_update on public.voucher_attachments;
create trigger trg_voucher_attachments_validate_insert_update
before insert or update on public.voucher_attachments
for each row execute function public.voucher_attachments_validate();

drop trigger if exists trg_voucher_attachments_validate_delete on public.voucher_attachments;
create trigger trg_voucher_attachments_validate_delete
before delete on public.voucher_attachments
for each row execute function public.voucher_attachments_validate();

alter table public.voucher_attachments enable row level security;

drop policy if exists "voucher_attachments_select_all" on public.voucher_attachments;
create policy "voucher_attachments_select_all" on public.voucher_attachments
  for select to authenticated using (true);

drop policy if exists "voucher_attachments_insert_all" on public.voucher_attachments;
create policy "voucher_attachments_insert_all" on public.voucher_attachments
  for insert to authenticated with check (true);

drop policy if exists "voucher_attachments_delete_all" on public.voucher_attachments;
create policy "voucher_attachments_delete_all" on public.voucher_attachments
  for delete to authenticated using (true);
