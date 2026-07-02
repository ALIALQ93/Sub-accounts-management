-- =============================================================================
-- 02_rls.sql — سياسات Row Level Security (MVP بدون مصادقة)
-- =============================================================================
-- شغّل بعد 01_schema.sql
-- =============================================================================

alter table public.currencies enable row level security;
alter table public.currency_rate_history enable row level security;
alter table public.accounts enable row level security;
alter table public.cost_centers enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;
alter table public.customers enable row level security;
alter table public.vendors enable row level security;
alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.party_settings enable row level security;
alter table public.voucher_settings enable row level security;
alter table public.voucher_number_sequences enable row level security;
alter table public.voucher_type_defaults enable row level security;
alter table public.voucher_line_categories enable row level security;
alter table public.vouchers enable row level security;
alter table public.voucher_lines enable row level security;
alter table public.voucher_allocations enable row level security;

-- currencies
drop policy if exists "currencies_select_all" on public.currencies;
create policy "currencies_select_all" on public.currencies
  for select to anon, authenticated using (true);
drop policy if exists "currencies_insert_all" on public.currencies;
create policy "currencies_insert_all" on public.currencies
  for insert to anon, authenticated with check (true);
drop policy if exists "currencies_update_all" on public.currencies;
create policy "currencies_update_all" on public.currencies
  for update to anon, authenticated using (true) with check (true);

-- currency_rate_history (قراءة فقط من الواجهة — الإدراج عبر دوال SQL)
drop policy if exists "currency_rate_history_select_all" on public.currency_rate_history;
create policy "currency_rate_history_select_all" on public.currency_rate_history
  for select to anon, authenticated using (true);
drop policy if exists "currency_rate_history_insert_all" on public.currency_rate_history;
create policy "currency_rate_history_insert_all" on public.currency_rate_history
  for insert to anon, authenticated with check (true);

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

-- cost_centers
drop policy if exists "cost_centers_select_all" on public.cost_centers;
create policy "cost_centers_select_all" on public.cost_centers
  for select to anon, authenticated using (true);
drop policy if exists "cost_centers_insert_all" on public.cost_centers;
create policy "cost_centers_insert_all" on public.cost_centers
  for insert to anon, authenticated with check (true);
drop policy if exists "cost_centers_update_all" on public.cost_centers;
create policy "cost_centers_update_all" on public.cost_centers
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

-- profiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and is_active = (select p.is_active from public.profiles p where p.id = auth.uid())
  );

-- company_settings
drop policy if exists "company_settings_select" on public.company_settings;
create policy "company_settings_select" on public.company_settings
  for select to authenticated, anon
  using (true);

drop policy if exists "company_settings_update_admin" on public.company_settings;
create policy "company_settings_update_admin" on public.company_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "company_settings_insert_admin" on public.company_settings;
create policy "company_settings_insert_admin" on public.company_settings
  for insert to authenticated
  with check (public.is_admin());

-- party_settings
drop policy if exists "party_settings_select_all" on public.party_settings;
create policy "party_settings_select_all" on public.party_settings
  for select to anon, authenticated using (true);
drop policy if exists "party_settings_insert_all" on public.party_settings;
create policy "party_settings_insert_all" on public.party_settings
  for insert to anon, authenticated with check (true);
drop policy if exists "party_settings_update_all" on public.party_settings;
create policy "party_settings_update_all" on public.party_settings
  for update to anon, authenticated using (true) with check (true);

-- voucher_settings
drop policy if exists "voucher_settings_select_all" on public.voucher_settings;
create policy "voucher_settings_select_all" on public.voucher_settings
  for select to anon, authenticated using (true);
drop policy if exists "voucher_settings_insert_all" on public.voucher_settings;
create policy "voucher_settings_insert_all" on public.voucher_settings
  for insert to anon, authenticated with check (true);
drop policy if exists "voucher_settings_update_all" on public.voucher_settings;
create policy "voucher_settings_update_all" on public.voucher_settings
  for update to anon, authenticated using (true) with check (true);

-- voucher_number_sequences
drop policy if exists "voucher_number_sequences_select_all" on public.voucher_number_sequences;
create policy "voucher_number_sequences_select_all" on public.voucher_number_sequences
  for select to anon, authenticated using (true);
drop policy if exists "voucher_number_sequences_insert_all" on public.voucher_number_sequences;
create policy "voucher_number_sequences_insert_all" on public.voucher_number_sequences
  for insert to anon, authenticated with check (true);
drop policy if exists "voucher_number_sequences_update_all" on public.voucher_number_sequences;
create policy "voucher_number_sequences_update_all" on public.voucher_number_sequences
  for update to anon, authenticated using (true) with check (true);

-- voucher_type_defaults
drop policy if exists "voucher_type_defaults_select_all" on public.voucher_type_defaults;
create policy "voucher_type_defaults_select_all" on public.voucher_type_defaults
  for select to anon, authenticated using (true);
drop policy if exists "voucher_type_defaults_insert_all" on public.voucher_type_defaults;
create policy "voucher_type_defaults_insert_all" on public.voucher_type_defaults
  for insert to anon, authenticated with check (true);
drop policy if exists "voucher_type_defaults_update_all" on public.voucher_type_defaults;
create policy "voucher_type_defaults_update_all" on public.voucher_type_defaults
  for update to anon, authenticated using (true) with check (true);

-- voucher_line_categories
drop policy if exists "voucher_line_categories_select_all" on public.voucher_line_categories;
create policy "voucher_line_categories_select_all" on public.voucher_line_categories
  for select to anon, authenticated using (true);
drop policy if exists "voucher_line_categories_insert_all" on public.voucher_line_categories;
create policy "voucher_line_categories_insert_all" on public.voucher_line_categories
  for insert to anon, authenticated with check (true);
drop policy if exists "voucher_line_categories_update_all" on public.voucher_line_categories;
create policy "voucher_line_categories_update_all" on public.voucher_line_categories
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
