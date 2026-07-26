-- =============================================================================
-- patch_schema_setup_status.sql — حالة جاهزية المخطط لويزارد /setup
-- =============================================================================
-- مصدر الحقيقة للتهيئة: database/setup_all.sql (إعادة بناء كاملة في مرحلة البناء).
-- =============================================================================

create or replace function public.get_schema_setup_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ok boolean := true;
  v_checks jsonb := '[]'::jsonb;
  v_has boolean;
begin
  -- عمود إتمام ويزارد الإعداد
  v_has := exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'company_settings'
      and c.column_name = 'is_setup_complete'
  );
  v_checks := v_checks || jsonb_build_array(
    jsonb_build_object(
      'key', 'company_settings.is_setup_complete',
      'label_ar', 'عمود إتمام الإعداد',
      'ok', v_has
    )
  );
  v_ok := v_ok and v_has;

  -- صلاحيات التقارير (تدقيق التقارير)
  v_has := to_regprocedure('public.assert_can_view_reports()') is not null;
  v_checks := v_checks || jsonb_build_array(
    jsonb_build_object(
      'key', 'assert_can_view_reports',
      'label_ar', 'فحص صلاحية التقارير',
      'ok', v_has
    )
  );
  v_ok := v_ok and v_has;

  -- ميزان مراجعة بفلتر فرع (7 معاملات)
  v_has := exists (
    select 1
    from pg_proc p
    inner join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_trial_balance'
      and p.pronargs = 7
  );
  v_checks := v_checks || jsonb_build_array(
    jsonb_build_object(
      'key', 'get_trial_balance.branch',
      'label_ar', 'ميزان المراجعة (فلتر فرع)',
      'ok', v_has
    )
  );
  v_ok := v_ok and v_has;

  -- تقرير COGS
  v_has := exists (
    select 1
    from pg_proc p
    inner join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_cogs_report'
  );
  v_checks := v_checks || jsonb_build_array(
    jsonb_build_object(
      'key', 'get_cogs_report',
      'label_ar', 'تقرير تكلفة المبيعات',
      'ok', v_has
    )
  );
  v_ok := v_ok and v_has;

  -- دفتر حركة مخزون
  v_has := exists (
    select 1
    from pg_proc p
    inner join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_inventory_movement_ledger'
  );
  v_checks := v_checks || jsonb_build_array(
    jsonb_build_object(
      'key', 'get_inventory_movement_ledger',
      'label_ar', 'دفتر حركة المخزون',
      'ok', v_has
    )
  );
  v_ok := v_ok and v_has;

  -- أعمار الذمم / حركات مفتوحة بالعملة الأساسية
  v_has := exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'open_items_view'
      and c.column_name = 'currency_code'
  );
  v_checks := v_checks || jsonb_build_array(
    jsonb_build_object(
      'key', 'open_items_view.currency_code',
      'label_ar', 'الحركات المفتوحة (عملة)',
      'ok', v_has
    )
  );
  v_ok := v_ok and v_has;

  -- جذور دليل الحسابات
  v_has := (
    select count(*) >= 7
    from public.accounts a
    where a.parent_id is null
  );
  v_checks := v_checks || jsonb_build_array(
    jsonb_build_object(
      'key', 'accounts.roots',
      'label_ar', 'دليل الحسابات (جذور 1–7)',
      'ok', v_has
    )
  );
  v_ok := v_ok and v_has;

  return jsonb_build_object(
    'ok', v_ok,
    'source', 'setup_all',
    'checks', v_checks,
    'message_ar', case
      when v_ok then
        'المخطط جاهز — ثُبِّت عبر setup_all.sql'
      else
        'المخطط غير مكتمل. في مرحلة البناء أعد تشغيل database/setup_all.sql من SQL Editor ثم أعد التحقق.'
    end,
    'summary', jsonb_build_object(
      'is_setup_complete', coalesce(
        (select cs.is_setup_complete from public.company_settings cs where cs.id = 1),
        false
      ),
      'company_name_ar', coalesce(
        (select cs.legal_name_ar from public.company_settings cs where cs.id = 1),
        ''
      ),
      'root_accounts', (
        select count(*)::int from public.accounts a where a.parent_id is null
      ),
      'branches', (select count(*)::int from public.branches),
      'warehouses', (select count(*)::int from public.warehouses),
      'currencies', (select count(*)::int from public.currencies where is_active = true),
      'materials', (select count(*)::int from public.materials),
      'posted_invoices', (
        select count(*)::int from public.invoices i where i.status = 'posted'
      ),
      'inventory_movements', (select count(*)::int from public.inventory_movements)
    )
  );
end;
$$;

comment on function public.get_schema_setup_status() is
  'حالة جاهزية المخطط لويزارد /setup وصفحة إعدادات قاعدة البيانات';

revoke all on function public.get_schema_setup_status() from public;
grant execute on function public.get_schema_setup_status() to authenticated;
