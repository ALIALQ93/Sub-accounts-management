-- =============================================================================
-- patch_audit_governance_security.sql (#40)
-- =============================================================================
-- تدقيق: قيد افتتاحي بدون فرع + RLS فترات/فروع + invoice_reference_links
-- يتطلب: patch_invoice_pricing_cost.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) قيد افتتاحي مرحّل واحد per (فرع أو بدون فرع، سنة)
--    الفهرس السابق استثنى branch_id is null — ثغرة تكرار للشركات بدون فروع
-- ---------------------------------------------------------------------------

drop index if exists public.idx_vouchers_opening_per_branch_year;

create unique index if not exists idx_vouchers_opening_per_branch_year
  on public.vouchers (
    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    (extract(year from voucher_date)::int)
  )
  where is_opening_entry = true
    and status = 'posted';

comment on index public.idx_vouchers_opening_per_branch_year is
  'قيد افتتاحي مرحّل واحد per سنة — يشمل branch_id null عبر coalesce (نفس نمط الفترات المحاسبية)';

-- ---------------------------------------------------------------------------
-- 2) accounting_periods — تقييد الكتابة بصلاحية إعدادات الشركة
-- ---------------------------------------------------------------------------

drop policy if exists "accounting_periods_all" on public.accounting_periods;
drop policy if exists "accounting_periods_select_all" on public.accounting_periods;
drop policy if exists "accounting_periods_insert_admin" on public.accounting_periods;
drop policy if exists "accounting_periods_update_admin" on public.accounting_periods;
drop policy if exists "accounting_periods_delete_admin" on public.accounting_periods;

create policy "accounting_periods_select_all" on public.accounting_periods
  for select to authenticated using (true);

create policy "accounting_periods_insert_admin" on public.accounting_periods
  for insert to authenticated
  with check (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  );

create policy "accounting_periods_update_admin" on public.accounting_periods
  for update to authenticated
  using (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  )
  with check (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  );

create policy "accounting_periods_delete_admin" on public.accounting_periods
  for delete to authenticated
  using (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  );

-- ---------------------------------------------------------------------------
-- 3) branches — نفس معيار company_settlement_accounts
-- ---------------------------------------------------------------------------

drop policy if exists "branches_insert_all" on public.branches;
drop policy if exists "branches_update_all" on public.branches;
drop policy if exists "branches_insert_admin" on public.branches;
drop policy if exists "branches_update_admin" on public.branches;
drop policy if exists "branches_delete_admin" on public.branches;

create policy "branches_insert_admin" on public.branches
  for insert to authenticated
  with check (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  );

create policy "branches_update_admin" on public.branches
  for update to authenticated
  using (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  )
  with check (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  );

create policy "branches_delete_admin" on public.branches
  for delete to authenticated
  using (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  );

-- ---------------------------------------------------------------------------
-- 4) invoice_reference_links — تفعيل RLS (كان الجدول بدون حماية)
-- ---------------------------------------------------------------------------

alter table public.invoice_reference_links enable row level security;

drop policy if exists "invoice_reference_links_all" on public.invoice_reference_links;
create policy "invoice_reference_links_all" on public.invoice_reference_links
  for all to authenticated using (true) with check (true);
