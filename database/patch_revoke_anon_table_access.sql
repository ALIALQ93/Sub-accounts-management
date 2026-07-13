-- =============================================================================
-- patch_revoke_anon_table_access.sql (#41)
-- =============================================================================
-- أمني حرج: إزالة دور anon من سياسات RLS على الجداول المحاسبية.
-- الاستثناء الوحيد: SELECT على company_settings (شعار/اسم الشركة بصفحة الدخول).
-- storage company-assets يبقى قراءة عامة كما في 06_storage.sql.
--
-- شغّل هذا الملف على قواعد موجودة (إنتاج) حتى لو كان setup_all محدّثاً
-- لأن السياسات القديمة بـ anon تبقى حتى تُعاد كتابتها.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) إلغاء صلاحيات الجدول المباشرة من anon
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

-- صفحة الدخول تحتاج قراءة إعدادات الشركة فقط
grant select on public.company_settings to anon;

-- ---------------------------------------------------------------------------
-- 2) إعادة كتابة أي سياسة RLS ما زالت تمنح anon (ما عدا company_settings SELECT)
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_cmd text;
  v_perm text;
  v_sql text;
begin
  for r in
    select
      schemaname,
      tablename,
      policyname,
      permissive,
      cmd,
      qual,
      with_check
    from pg_policies
    where schemaname = 'public'
      and roles @> array['anon']::name[]
  loop
    if r.tablename = 'company_settings' and upper(r.cmd) = 'SELECT' then
      continue;
    end if;

    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname,
      r.schemaname,
      r.tablename
    );

    v_cmd := case upper(r.cmd)
      when '*' then 'ALL'
      else upper(r.cmd)
    end;

    v_perm := case
      when r.permissive = 'RESTRICTIVE' then 'RESTRICTIVE'
      else 'PERMISSIVE'
    end;

    if v_cmd = 'INSERT' then
      v_sql := format(
        'create policy %I on %I.%I as %s for insert to authenticated with check (%s)',
        r.policyname,
        r.schemaname,
        r.tablename,
        v_perm,
        coalesce(r.with_check, 'true')
      );
    elsif v_cmd = 'SELECT' then
      v_sql := format(
        'create policy %I on %I.%I as %s for select to authenticated using (%s)',
        r.policyname,
        r.schemaname,
        r.tablename,
        v_perm,
        coalesce(r.qual, 'true')
      );
    elsif v_cmd = 'DELETE' then
      v_sql := format(
        'create policy %I on %I.%I as %s for delete to authenticated using (%s)',
        r.policyname,
        r.schemaname,
        r.tablename,
        v_perm,
        coalesce(r.qual, 'true')
      );
    elsif v_cmd = 'UPDATE' then
      v_sql := format(
        'create policy %I on %I.%I as %s for update to authenticated using (%s) with check (%s)',
        r.policyname,
        r.schemaname,
        r.tablename,
        v_perm,
        coalesce(r.qual, 'true'),
        coalesce(r.with_check, coalesce(r.qual, 'true'))
      );
    else
      -- ALL
      v_sql := format(
        'create policy %I on %I.%I as %s for all to authenticated using (%s) with check (%s)',
        r.policyname,
        r.schemaname,
        r.tablename,
        v_perm,
        coalesce(r.qual, 'true'),
        coalesce(r.with_check, coalesce(r.qual, 'true'))
      );
    end if;

    execute v_sql;
  end loop;
end;
$$;

-- تأكيد استثناء صفحة الدخول
drop policy if exists "company_settings_select" on public.company_settings;
create policy "company_settings_select" on public.company_settings
  for select to authenticated, anon
  using (true);
