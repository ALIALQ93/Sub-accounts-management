-- Run this in Supabase SQL Editor if the app shows 0 rows
-- but Table Editor shows data (common on hosted deployments).
--
-- Step 1: Check RLS status
-- select relname, relrowsecurity from pg_class
-- where relname in ('accounts','vouchers','journal_entries','customers','vendors');

-- Step 2: Allow anon/authenticated access for MVP (no auth yet)

alter table public.accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;
alter table public.customers enable row level security;
alter table public.vendors enable row level security;
alter table public.vouchers enable row level security;
alter table public.voucher_lines enable row level security;
alter table public.voucher_allocations enable row level security;

-- accounts
drop policy if exists "accounts_select_all" on public.accounts;
create policy "accounts_select_all" on public.accounts
  for select to anon, authenticated using (true);
drop policy if exists "accounts_insert_all" on public.accounts;
create policy "accounts_insert_all" on public.accounts
  for insert to anon, authenticated with check (true);
drop policy if exists "accounts_update_all" on public.accounts;
create policy "accounts_update_all" on public.accounts
  for update to anon, authenticated using (true) with check (true);

-- journal_entries
drop policy if exists "journal_entries_select_all" on public.journal_entries;
create policy "journal_entries_select_all" on public.journal_entries
  for select to anon, authenticated using (true);
drop policy if exists "journal_entries_insert_all" on public.journal_entries;
create policy "journal_entries_insert_all" on public.journal_entries
  for insert to anon, authenticated with check (true);
drop policy if exists "journal_entries_update_all" on public.journal_entries;
create policy "journal_entries_update_all" on public.journal_entries
  for update to anon, authenticated using (true) with check (true);

-- journal_entry_lines
drop policy if exists "journal_entry_lines_select_all" on public.journal_entry_lines;
create policy "journal_entry_lines_select_all" on public.journal_entry_lines
  for select to anon, authenticated using (true);
drop policy if exists "journal_entry_lines_insert_all" on public.journal_entry_lines;
create policy "journal_entry_lines_insert_all" on public.journal_entry_lines
  for insert to anon, authenticated with check (true);
drop policy if exists "journal_entry_lines_update_all" on public.journal_entry_lines;
create policy "journal_entry_lines_update_all" on public.journal_entry_lines
  for update to anon, authenticated using (true) with check (true);

-- customers
drop policy if exists "customers_select_all" on public.customers;
create policy "customers_select_all" on public.customers
  for select to anon, authenticated using (true);
drop policy if exists "customers_insert_all" on public.customers;
create policy "customers_insert_all" on public.customers
  for insert to anon, authenticated with check (true);
drop policy if exists "customers_update_all" on public.customers;
create policy "customers_update_all" on public.customers
  for update to anon, authenticated using (true) with check (true);

-- vendors
drop policy if exists "vendors_select_all" on public.vendors;
create policy "vendors_select_all" on public.vendors
  for select to anon, authenticated using (true);
drop policy if exists "vendors_insert_all" on public.vendors;
create policy "vendors_insert_all" on public.vendors
  for insert to anon, authenticated with check (true);
drop policy if exists "vendors_update_all" on public.vendors;
create policy "vendors_update_all" on public.vendors
  for update to anon, authenticated using (true) with check (true);

-- vouchers
drop policy if exists "vouchers_select_all" on public.vouchers;
create policy "vouchers_select_all" on public.vouchers
  for select to anon, authenticated using (true);
drop policy if exists "vouchers_insert_all" on public.vouchers;
create policy "vouchers_insert_all" on public.vouchers
  for insert to anon, authenticated with check (true);
drop policy if exists "vouchers_update_all" on public.vouchers;
create policy "vouchers_update_all" on public.vouchers
  for update to anon, authenticated using (true) with check (true);

-- voucher_lines
drop policy if exists "voucher_lines_select_all" on public.voucher_lines;
create policy "voucher_lines_select_all" on public.voucher_lines
  for select to anon, authenticated using (true);
drop policy if exists "voucher_lines_insert_all" on public.voucher_lines;
create policy "voucher_lines_insert_all" on public.voucher_lines
  for insert to anon, authenticated with check (true);
drop policy if exists "voucher_lines_update_all" on public.voucher_lines;
create policy "voucher_lines_update_all" on public.voucher_lines
  for update to anon, authenticated using (true) with check (true);

-- voucher_allocations
drop policy if exists "voucher_allocations_select_all" on public.voucher_allocations;
create policy "voucher_allocations_select_all" on public.voucher_allocations
  for select to anon, authenticated using (true);
drop policy if exists "voucher_allocations_insert_all" on public.voucher_allocations;
create policy "voucher_allocations_insert_all" on public.voucher_allocations
  for insert to anon, authenticated with check (true);
drop policy if exists "voucher_allocations_update_all" on public.voucher_allocations;
create policy "voucher_allocations_update_all" on public.voucher_allocations
  for update to anon, authenticated using (true) with check (true);
