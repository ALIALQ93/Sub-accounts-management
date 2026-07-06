-- =============================================================================
-- patch_trial_balance_opening.sql — عمود رصيد افتتاحي منفصل في ميزان المراجعة
-- =============================================================================
-- يتطلب: patch_opening_entry.sql (is_opening_entry على journal_entries)
-- =============================================================================

create or replace function public.get_trial_balance(
  p_from_date date default null,
  p_to_date date default null,
  p_currency_id uuid default null,
  p_account_id uuid default null,
  p_account_subtree boolean default true,
  p_cost_center_id uuid default null
)
returns table (
  account_id uuid,
  account_code varchar,
  account_name varchar,
  currency_id uuid,
  parent_id uuid,
  is_postable boolean,
  opening_entry_balance numeric,
  opening_balance numeric,
  period_debit numeric,
  period_credit numeric,
  closing_balance numeric
)
language sql
stable
set search_path = public
as $$
  with scoped_accounts as (
    select a.*
    from public.accounts a
    where a.is_active = true
      and (p_currency_id is null or a.currency_id = p_currency_id)
      and (
        p_account_id is null
        or (
          p_account_subtree
          and a.id in (
            with recursive account_tree as (
              select id
              from public.accounts
              where id = p_account_id
              union all
              select child.id
              from public.accounts child
              inner join account_tree parent on child.parent_id = parent.id
            )
            select id from account_tree
          )
        )
        or (not p_account_subtree and a.id = p_account_id)
      )
  ),
  line_agg as (
    select
      jel.account_id,
      coalesce(sum(
        case
          when coalesce(je.is_opening_entry, false)
            then jel.debit - jel.credit
          else 0
        end
      ), 0)::numeric(18, 2) as opening_entry_balance,
      coalesce(sum(
        case
          when not coalesce(je.is_opening_entry, false)
            and p_from_date is not null
            and je.entry_date < p_from_date
            then jel.debit - jel.credit
          else 0
        end
      ), 0)::numeric(18, 2) as opening_balance,
      coalesce(sum(
        case
          when not coalesce(je.is_opening_entry, false)
            and (p_from_date is null or je.entry_date >= p_from_date)
            and (p_to_date is null or je.entry_date <= p_to_date)
            then jel.debit
          else 0
        end
      ), 0)::numeric(18, 2) as period_debit,
      coalesce(sum(
        case
          when not coalesce(je.is_opening_entry, false)
            and (p_from_date is null or je.entry_date >= p_from_date)
            and (p_to_date is null or je.entry_date <= p_to_date)
            then jel.credit
          else 0
        end
      ), 0)::numeric(18, 2) as period_credit
    from public.journal_entry_lines jel
    inner join public.journal_entries je on je.id = jel.journal_entry_id
    where je.status = 'posted'
      and (p_cost_center_id is null or jel.cost_center_id = p_cost_center_id)
    group by jel.account_id
  )
  select
    sa.id as account_id,
    sa.code as account_code,
    sa.name_ar as account_name,
    sa.currency_id,
    sa.parent_id,
    sa.is_postable,
    coalesce(la.opening_entry_balance, 0)::numeric(18, 2) as opening_entry_balance,
    coalesce(la.opening_balance, 0)::numeric(18, 2) as opening_balance,
    coalesce(la.period_debit, 0)::numeric(18, 2) as period_debit,
    coalesce(la.period_credit, 0)::numeric(18, 2) as period_credit,
    (
      coalesce(la.opening_entry_balance, 0)
      + coalesce(la.opening_balance, 0)
      + coalesce(la.period_debit, 0)
      - coalesce(la.period_credit, 0)
    )::numeric(18, 2) as closing_balance
  from scoped_accounts sa
  left join line_agg la on la.account_id = sa.id
  where sa.is_postable = true
  order by sa.code;
$$;

comment on function public.get_trial_balance is
  'ميزان مراجعة — opening_entry_balance منفصل عن حركة الفترة (يستثني is_opening_entry)';
