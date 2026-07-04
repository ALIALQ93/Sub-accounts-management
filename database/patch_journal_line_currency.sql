-- patch_journal_line_currency.sql
-- تخزين عملة السند وسعر صرفه والقيمة بالعملة الأساسية على أسطر القيود والسندات
-- Run in Supabase SQL Editor after existing patches.

-- ---------------------------------------------------------------------------
-- أعمدة جديدة
-- ---------------------------------------------------------------------------

alter table public.voucher_lines
  add column if not exists amount_base numeric(18, 2) null
    check (amount_base is null or amount_base >= 0);

alter table public.journal_entry_lines
  add column if not exists currency_id uuid null references public.currencies(id) on delete restrict,
  add column if not exists exchange_rate numeric(18, 6) null
    check (exchange_rate is null or exchange_rate > 0),
  add column if not exists debit_base numeric(18, 2) not null default 0
    check (debit_base >= 0),
  add column if not exists credit_base numeric(18, 2) not null default 0
    check (credit_base >= 0);

create index if not exists idx_journal_lines_currency_id
  on public.journal_entry_lines(currency_id);

-- ---------------------------------------------------------------------------
-- دوال مساعدة
-- ---------------------------------------------------------------------------

create or replace function public.to_base_amount(
  p_amount numeric,
  p_exchange_rate numeric
)
returns numeric
language sql
immutable
as $$
  select round((p_amount * coalesce(nullif(p_exchange_rate, 0), 1))::numeric, 2);
$$;

create or replace function public.voucher_lines_apply_amount_base()
returns trigger
language plpgsql
as $$
declare
  v_rate numeric(18, 6);
begin
  select coalesce(nullif(v.exchange_rate, 0), 1)
  into v_rate
  from public.vouchers v
  where v.id = new.voucher_id;

  new.amount_base := public.to_base_amount(new.amount, v_rate);
  return new;
end;
$$;

drop trigger if exists trg_voucher_lines_amount_base on public.voucher_lines;
create trigger trg_voucher_lines_amount_base
before insert or update of amount, voucher_id on public.voucher_lines
for each row execute function public.voucher_lines_apply_amount_base();

-- ---------------------------------------------------------------------------
-- تعبئة البيانات القديمة
-- ---------------------------------------------------------------------------

update public.voucher_lines vl
set amount_base = public.to_base_amount(
  vl.amount,
  coalesce(nullif(v.exchange_rate, 0), 1)
)
from public.vouchers v
where v.id = vl.voucher_id
  and vl.amount_base is null;

update public.journal_entry_lines jel
set
  currency_id = v.currency_id,
  exchange_rate = coalesce(nullif(v.exchange_rate, 0), 1),
  debit_base = public.to_base_amount(jel.debit, coalesce(nullif(v.exchange_rate, 0), 1)),
  credit_base = public.to_base_amount(jel.credit, coalesce(nullif(v.exchange_rate, 0), 1))
from public.journal_entries je
inner join public.vouchers v
  on v.id = je.source_id
 and je.source_type = 'voucher'
where jel.journal_entry_id = je.id
  and jel.currency_id is null;

update public.journal_entry_lines
set
  exchange_rate = 1,
  debit_base = debit,
  credit_base = credit
where currency_id is null
  and (debit_base = 0 and credit_base = 0);

-- ---------------------------------------------------------------------------
-- مزامنة قيود السندات المرحّلة
-- ---------------------------------------------------------------------------

create or replace function public.sync_posted_voucher_journal(p_voucher_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_debit numeric(18,2);
  v_credit numeric(18,2);
  v_unbalanced_cc int;
  v_rate numeric(18,6);
begin
  if not public.is_admin() then
    raise exception 'Only administrators can sync posted voucher journals.';
  end if;

  select *
  into v_voucher
  from public.vouchers
  where id = p_voucher_id;

  if not found then
    raise exception 'Voucher not found.';
  end if;

  if v_voucher.status <> 'posted' then
    raise exception 'Voucher is not posted.';
  end if;

  if v_voucher.journal_entry_id is null then
    raise exception 'Posted voucher has no linked journal entry.';
  end if;

  v_rate := coalesce(nullif(v_voucher.exchange_rate, 0), 1);

  select
    coalesce(sum(case when side = 'debit' then amount else 0 end), 0),
    coalesce(sum(case when side = 'credit' then amount else 0 end), 0)
  into v_debit, v_credit
  from public.voucher_lines
  where voucher_id = p_voucher_id;

  if v_debit = 0 and v_credit = 0 then
    raise exception 'Cannot sync empty voucher.';
  end if;

  if v_debit <> v_credit then
    raise exception 'Cannot sync unbalanced voucher: debit (%) <> credit (%).', v_debit, v_credit;
  end if;

  if v_voucher.voucher_type = 'settlement' then
    if exists (
      select 1
      from public.voucher_lines vl
      where vl.voucher_id = p_voucher_id
        and vl.cost_center_id is null
        and vl.amount > 0
        and coalesce(vl.line_description, '') not like 'تصفية —%'
    ) then
      raise exception 'Settlement voucher lines require a cost center.';
    end if;

    select count(*)
    into v_unbalanced_cc
    from (
      select
        vl.cost_center_id,
        coalesce(sum(case when vl.side = 'debit' then vl.amount else 0 end), 0) as debit_total,
        coalesce(sum(case when vl.side = 'credit' then vl.amount else 0 end), 0) as credit_total
      from public.voucher_lines vl
      where vl.voucher_id = p_voucher_id
        and vl.cost_center_id is not null
      group by vl.cost_center_id
    ) cc
    where cc.debit_total <> cc.credit_total;

    if v_unbalanced_cc > 0 then
      raise exception 'Cannot sync settlement voucher: cost centers must balance.';
    end if;
  end if;

  delete from public.journal_entry_lines
  where journal_entry_id = v_voucher.journal_entry_id;

  insert into public.journal_entry_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    line_description,
    cost_center_id,
    currency_id,
    exchange_rate,
    debit_base,
    credit_base
  )
  select
    v_voucher.journal_entry_id,
    vl.account_id,
    case when vl.side = 'debit' then vl.amount else 0 end as debit,
    case when vl.side = 'credit' then vl.amount else 0 end as credit,
    trim(both from concat_ws(
      ' — ',
      nullif(trim(vl.line_description), ''),
      case
        when vlc.name_ar is not null then
          'نوع: ' || vlc.name_ar ||
          case
            when vl.category_quantity is not null and vl.category_quantity > 0 then
              ' (' || coalesce(nullif(trim(vlc.quantity_label), ''), 'العدد') ||
              ': ' || trim(trailing '.' from trim(trailing '0' from vl.category_quantity::text)) || ')'
            else ''
          end
        else null
      end
    )),
    vl.cost_center_id,
    v_voucher.currency_id,
    v_rate,
    case when vl.side = 'debit' then public.to_base_amount(vl.amount, v_rate) else 0 end,
    case when vl.side = 'credit' then public.to_base_amount(vl.amount, v_rate) else 0 end
  from public.voucher_lines vl
  left join public.voucher_line_categories vlc on vlc.id = vl.line_category_id
  where vl.voucher_id = p_voucher_id;

  update public.journal_entries
  set
    entry_date = v_voucher.voucher_date,
    description = coalesce(
      v_voucher.description,
      'Auto-posted from voucher ' || v_voucher.voucher_no
    ),
    updated_at = now()
  where id = v_voucher.journal_entry_id;
end;
$$;

grant execute on function public.sync_posted_voucher_journal(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- ترحيل السند: إنشاء القيود مع العملة والأساس
-- ---------------------------------------------------------------------------

create or replace function public.vouchers_before_update_handle_posting()
returns trigger
language plpgsql
as $$
declare
  v_debit numeric(18,2);
  v_credit numeric(18,2);
  v_je_id uuid;
  v_entry_no varchar(40);
  v_allocation_count int;
  v_unbalanced_cc int;
  v_rate numeric(18,6);
begin
  if old.status = 'posted' then
    if not public.is_admin() then
      raise exception 'Posted voucher cannot be modified. Use reversal instead.';
    end if;

    if new.status <> 'posted' then
      raise exception 'Cannot change status of a posted voucher directly.';
    end if;

    if old.journal_entry_id is not null then
      update public.journal_entries
      set
        entry_date = new.voucher_date,
        description = coalesce(
          new.description,
          'Auto-posted from voucher ' || new.voucher_no
        ),
        updated_at = now()
      where id = old.journal_entry_id;
    end if;

    return new;
  end if;

  if new.status = 'posted' and old.status <> 'posted' then
    v_rate := coalesce(nullif(new.exchange_rate, 0), 1);

    select
      coalesce(sum(case when side = 'debit' then amount else 0 end), 0),
      coalesce(sum(case when side = 'credit' then amount else 0 end), 0)
    into v_debit, v_credit
    from public.voucher_lines
    where voucher_id = new.id;

    if v_debit = 0 and v_credit = 0 then
      raise exception 'Cannot post empty voucher.';
    end if;

    if v_debit <> v_credit then
      raise exception 'Cannot post unbalanced voucher: debit (%) <> credit (%).', v_debit, v_credit;
    end if;

    if new.settlement_mode = 'invoice' then
      select count(*)
      into v_allocation_count
      from public.voucher_allocations va
      where va.voucher_id = new.id;

      if v_allocation_count = 0 then
        raise exception 'Invoice settlement voucher requires allocation rows.';
      end if;
    end if;

    if new.voucher_type = 'settlement' then
      if exists (
        select 1
        from public.voucher_lines vl
        where vl.voucher_id = new.id
          and vl.cost_center_id is null
          and vl.amount > 0
          and coalesce(vl.line_description, '') not like 'تصفية —%'
      ) then
        raise exception 'Settlement voucher lines require a cost center.';
      end if;

      select count(*)
      into v_unbalanced_cc
      from (
        select
          vl.cost_center_id,
          coalesce(sum(case when vl.side = 'debit' then vl.amount else 0 end), 0) as debit_total,
          coalesce(sum(case when vl.side = 'credit' then vl.amount else 0 end), 0) as credit_total
        from public.voucher_lines vl
        where vl.voucher_id = new.id
          and vl.cost_center_id is not null
        group by vl.cost_center_id
      ) cc
      where cc.debit_total <> cc.credit_total;

      if v_unbalanced_cc > 0 then
        raise exception 'Cannot post settlement voucher: cost centers must balance (debit = credit per cost center).';
      end if;
    end if;

    if old.journal_entry_id is not null then
      raise exception 'Voucher already posted with journal entry.';
    end if;

    v_entry_no := 'JE-' || new.voucher_no;

    insert into public.journal_entries (
      entry_no,
      entry_date,
      description,
      status,
      source_type,
      source_id
    )
    values (
      v_entry_no,
      new.voucher_date,
      coalesce(new.description, 'Auto-posted from voucher ' || new.voucher_no),
      'posted',
      'voucher',
      new.id
    )
    returning id into v_je_id;

    insert into public.journal_entry_lines (
      journal_entry_id,
      account_id,
      debit,
      credit,
      line_description,
      cost_center_id,
      currency_id,
      exchange_rate,
      debit_base,
      credit_base
    )
    select
      v_je_id,
      vl.account_id,
      case when vl.side = 'debit' then vl.amount else 0 end as debit,
      case when vl.side = 'credit' then vl.amount else 0 end as credit,
      trim(both from concat_ws(
        ' — ',
        nullif(trim(vl.line_description), ''),
        case
          when vlc.name_ar is not null then
            'نوع: ' || vlc.name_ar ||
            case
              when vl.category_quantity is not null and vl.category_quantity > 0 then
                ' (' || coalesce(nullif(trim(vlc.quantity_label), ''), 'العدد') ||
                ': ' || trim(trailing '.' from trim(trailing '0' from vl.category_quantity::text)) || ')'
              else ''
            end
          else null
        end
      )),
      vl.cost_center_id,
      new.currency_id,
      v_rate,
      case when vl.side = 'debit' then public.to_base_amount(vl.amount, v_rate) else 0 end,
      case when vl.side = 'credit' then public.to_base_amount(vl.amount, v_rate) else 0 end
    from public.voucher_lines vl
    left join public.voucher_line_categories vlc on vlc.id = vl.line_category_id
    where vl.voucher_id = new.id;

    new.journal_entry_id := v_je_id;
  end if;

  return new;
end;
$$;
