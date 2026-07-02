-- =============================================================================
-- 00_reset.sql — إعادة ضبط كاملة للمخطط المحاسبي
-- =============================================================================
-- تحذير: يحذف جميع البيانات والجداول والدوال والمحفزات والعرض account_direct_balances.
-- استخدمه فقط عند إعادة التثبيت من الصفر (تطوير / بيئة اختبار).
-- =============================================================================

drop view if exists public.account_direct_balances cascade;

drop table if exists public.voucher_allocations cascade;
drop table if exists public.voucher_lines cascade;
drop table if exists public.voucher_line_categories cascade;
drop table if exists public.vouchers cascade;
drop table if exists public.voucher_type_defaults cascade;
drop table if exists public.voucher_number_sequences cascade;
drop table if exists public.voucher_settings cascade;
drop table if exists public.journal_entry_lines cascade;
drop table if exists public.journal_entries cascade;
drop table if exists public.customers cascade;
drop table if exists public.vendors cascade;
drop table if exists public.accounts cascade;
drop table if exists public.cost_centers cascade;
drop table if exists public.currency_rate_history cascade;
drop table if exists public.currencies cascade;

drop function if exists public.peek_voucher_no(varchar) cascade;
drop function if exists public.reserve_voucher_no(varchar) cascade;
drop function if exists public.format_voucher_no(varchar, boolean, int, int, int) cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.accounts_apply_hierarchy_rules() cascade;
drop function if exists public.accounts_on_child_insert_make_parent_non_postable() cascade;
drop function if exists public.prevent_account_delete_when_used() cascade;
drop function if exists public.journal_lines_validate_account_is_postable() cascade;
drop function if exists public.journal_entry_validate_balance_before_post() cascade;
drop function if exists public.customers_vendors_validate_accounts() cascade;
drop function if exists public.vouchers_validate_parties() cascade;
drop function if exists public.voucher_lines_validate_account_is_postable() cascade;
drop function if exists public.voucher_lines_prevent_delete_when_posted() cascade;
drop function if exists public.voucher_allocations_validate() cascade;
drop function if exists public.vouchers_before_update_handle_posting() cascade;
drop function if exists public.vouchers_prevent_delete_when_posted() cascade;
drop function if exists public.currencies_validate_base_rate() cascade;
drop function if exists public.currencies_prevent_deactivate_base() cascade;
drop function if exists public.currencies_prevent_base_change() cascade;
drop function if exists public.has_accounting_activity() cascade;
drop function if exists public.set_base_currency(uuid) cascade;
drop function if exists public.log_currency_rate_change(uuid, numeric, numeric, varchar, date, text) cascade;
drop function if exists public.update_currency_exchange_rate(uuid, numeric, date, text) cascade;
drop function if exists public.get_currency_rate_at_date(uuid, date) cascade;
drop function if exists public.currencies_prevent_direct_rate_change() cascade;
