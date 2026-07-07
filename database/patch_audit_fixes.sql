-- =============================================================================
-- patch_audit_fixes.sql — إصلاحات تدقيق أمني ومحاسبي (#24)
-- =============================================================================
-- 1) RLS: authenticated فقط (يُطبَّق عبر 02_rls.sql المحدَّث — هذا الملف للقواعد المحاسبية)
-- 2) account_direct_balances + get_trial_balance: debit_base / credit_base
-- 3) دورة حياة الحساب: ورقة↔أب مشروطة بعدم وجود حركة
-- =============================================================================

-- ---------------------------------------------------------------------------
-- عرض الأرصدة — عملة أساس
-- ---------------------------------------------------------------------------

create or replace view public.account_direct_balances
with (security_invoker = true)
as
select
  jel.account_id,
  coalesce(sum(jel.debit_base), 0)::numeric(18, 4) as debit,
  coalesce(sum(jel.credit_base), 0)::numeric(18, 4) as credit,
  coalesce(sum(jel.debit_base - jel.credit_base), 0)::numeric(18, 4) as balance
from public.journal_entry_lines jel
inner join public.journal_entries je on je.id = jel.journal_entry_id
where je.status = 'posted'
group by jel.account_id;

-- ---------------------------------------------------------------------------
-- مساعد: هل الحساب عليه حركة قيد؟
-- ---------------------------------------------------------------------------

create or replace function public.account_has_journal_movements(p_account_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.journal_entry_lines l
    where l.account_id = p_account_id
  );
$$;

grant execute on function public.account_has_journal_movements(uuid) to authenticated;

create or replace function public.get_account_ids_with_journal_movements()
returns table (account_id uuid)
language sql
stable
set search_path = public
as $$
  select distinct l.account_id
  from public.journal_entry_lines l;
$$;

grant execute on function public.get_account_ids_with_journal_movements() to authenticated;

-- ---------------------------------------------------------------------------
-- قواعد التسلسل الهرمي للحسابات
-- ---------------------------------------------------------------------------

create or replace function public.accounts_apply_hierarchy_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent_is_postable boolean;
  v_has_children boolean;
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'Account cannot be parent of itself.';
    end if;

    if tg_op = 'UPDATE' then
      if exists (
        with recursive descendants as (
          select id, parent_id
          from public.accounts
          where parent_id = old.id
          union all
          select a.id, a.parent_id
          from public.accounts a
          inner join descendants d on a.parent_id = d.id
        )
        select 1
        from descendants
        where id = new.parent_id
      ) then
        raise exception 'Circular hierarchy is not allowed.';
      end if;
    end if;

    select is_postable
    into v_parent_is_postable
    from public.accounts
    where id = new.parent_id;

    if v_parent_is_postable then
      if exists (
        select 1
        from public.journal_entry_lines l
        where l.account_id = new.parent_id
      ) then
        raise exception 'Parent account has journal entries and cannot have child accounts.';
      end if;
    end if;

    new.level := coalesce((select level + 1 from public.accounts where id = new.parent_id), 1);
  else
    new.level := 1;
  end if;

  if tg_op = 'UPDATE' then
    select exists (
      select 1 from public.accounts c where c.parent_id = old.id
    ) into v_has_children;

    if v_has_children and new.is_postable then
      raise exception 'Parent account cannot be postable.';
    end if;

    if old.is_postable = true and new.is_postable = false then
      if exists (
        select 1
        from public.journal_entry_lines l
        where l.account_id = old.id
      ) then
        raise exception 'Cannot change postable account to parent while it has journal entries.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- ميزان المراجعة — يُعاد من patch_trial_balance_opening.sql إن وُجد
-- (لا نكرر هنا لتجنب تعارض التوقيع)
-- ---------------------------------------------------------------------------
