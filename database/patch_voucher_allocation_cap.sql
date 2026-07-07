-- =============================================================================
-- patch_voucher_allocation_cap.sql — منع تجاوز التخصيص لمبلغ الحركة المفتوح (#25)
-- =============================================================================
-- يحمي من race condition (تبويبان / مستخدمان) عند إغلاق الحركات.
-- =============================================================================

create or replace function public.validate_allocation_row_capacity(
  p_voucher_id uuid,
  p_target_journal_line_id uuid,
  p_applied_amount numeric,
  p_exclude_allocation_id uuid default null,
  p_lock_line boolean default false
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_original numeric(18, 2);
  v_posted numeric(18, 2);
  v_voucher_line_total numeric(18, 2);
begin
  if p_applied_amount < 0 then
    raise exception 'Applied allocation amount cannot be negative.';
  end if;

  if p_applied_amount = 0 and p_exclude_allocation_id is null then
    raise exception 'Applied allocation amount must be positive.';
  end if;

  if p_lock_line then
    select abs(jel.debit - jel.credit)::numeric(18, 2)
    into v_original
    from public.journal_entry_lines jel
    inner join public.journal_entries je on je.id = jel.journal_entry_id
    where jel.id = p_target_journal_line_id
      and je.status = 'posted'
    for update of jel;
  else
    select abs(jel.debit - jel.credit)::numeric(18, 2)
    into v_original
    from public.journal_entry_lines jel
    inner join public.journal_entries je on je.id = jel.journal_entry_id
    where jel.id = p_target_journal_line_id
      and je.status = 'posted';
  end if;

  if v_original is null then
    raise exception 'Target journal line is not a posted entry line.';
  end if;

  select coalesce(sum(va.applied_amount), 0)::numeric(18, 2)
  into v_posted
  from public.voucher_allocations va
  inner join public.vouchers v on v.id = va.voucher_id
  where va.target_journal_line_id = p_target_journal_line_id
    and v.status = 'posted'
    and v.id <> p_voucher_id;

  select
    coalesce(sum(va.applied_amount), 0)::numeric(18, 2) + p_applied_amount
  into v_voucher_line_total
  from public.voucher_allocations va
  where va.voucher_id = p_voucher_id
    and va.target_journal_line_id = p_target_journal_line_id
    and (p_exclude_allocation_id is null or va.id <> p_exclude_allocation_id);

  if v_posted + v_voucher_line_total > v_original + 0.01 then
    raise exception
      'Allocation total (%) exceeds original amount (%) for journal line. Remaining open: %.',
      v_posted + v_voucher_line_total,
      v_original,
      greatest(v_original - v_posted, 0);
  end if;
end;
$$;

create or replace function public.validate_voucher_allocations_capacity(
  p_voucher_id uuid,
  p_lock_lines boolean default false
)
returns void
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_original numeric(18, 2);
  v_posted numeric(18, 2);
begin
  for r in
    select
      va.target_journal_line_id,
      sum(va.applied_amount)::numeric(18, 2) as line_total
    from public.voucher_allocations va
    where va.voucher_id = p_voucher_id
    group by va.target_journal_line_id
  loop
    if r.line_total <= 0 then
      raise exception 'Applied allocation amount must be positive.';
    end if;

    if p_lock_lines then
      select abs(jel.debit - jel.credit)::numeric(18, 2)
      into v_original
      from public.journal_entry_lines jel
      inner join public.journal_entries je on je.id = jel.journal_entry_id
      where jel.id = r.target_journal_line_id
        and je.status = 'posted'
      for update of jel;
    else
      select abs(jel.debit - jel.credit)::numeric(18, 2)
      into v_original
      from public.journal_entry_lines jel
      inner join public.journal_entries je on je.id = jel.journal_entry_id
      where jel.id = r.target_journal_line_id
        and je.status = 'posted';
    end if;

    if v_original is null then
      raise exception 'Target journal line is not a posted entry line.';
    end if;

    select coalesce(sum(va.applied_amount), 0)::numeric(18, 2)
    into v_posted
    from public.voucher_allocations va
    inner join public.vouchers v on v.id = va.voucher_id
    where va.target_journal_line_id = r.target_journal_line_id
      and v.status = 'posted'
      and v.id <> p_voucher_id;

    if v_posted + r.line_total > v_original + 0.01 then
      raise exception
        'Allocation total (%) exceeds original amount (%) for journal line. Remaining open: %.',
        v_posted + r.line_total,
        v_original,
        greatest(v_original - v_posted, 0);
    end if;
  end loop;
end;
$$;

grant execute on function public.validate_allocation_row_capacity(uuid, uuid, numeric, uuid, boolean)
  to authenticated;
grant execute on function public.validate_voucher_allocations_capacity(uuid, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- محفز التخصيصات
-- ---------------------------------------------------------------------------

create or replace function public.voucher_allocations_validate()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_voucher_status varchar(20);
  v_settlement_mode varchar(20);
begin
  select status, settlement_mode
  into v_voucher_status, v_settlement_mode
  from public.vouchers
  where id = coalesce(new.voucher_id, old.voucher_id);

  if v_voucher_status = 'posted'
    and not public.is_admin()
    and not public.is_force_voucher_delete() then
    raise exception 'Posted voucher allocations cannot be changed.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if v_settlement_mode <> 'invoice' then
    raise exception 'Voucher allocations are allowed only for invoice settlement mode.';
  end if;

  if tg_op = 'UPDATE'
    and old.target_journal_line_id is distinct from new.target_journal_line_id then
    perform public.validate_allocation_row_capacity(
      new.voucher_id,
      old.target_journal_line_id,
      0,
      old.id,
      false
    );
  end if;

  perform public.validate_allocation_row_capacity(
    new.voucher_id,
    new.target_journal_line_id,
    new.applied_amount,
    case when tg_op = 'UPDATE' then old.id else null end,
    false
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- تحقق عند الترحيل (مع قفل السطر — يمنع التزامن)
-- ---------------------------------------------------------------------------

create or replace function public.vouchers_before_update_handle_posting()
returns trigger
language plpgsql
set search_path = public
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
    if public.is_force_voucher_delete() then
      return new;
    end if;

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
    if old.status <> 'approved' then
      raise exception 'Voucher must be approved before posting.';
    end if;

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

      perform public.validate_voucher_allocations_capacity(new.id, true);
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

comment on function public.validate_allocation_row_capacity is
  'يرفض تخصيصاً يتجاوز المبلغ الأصلي للسطر بعد خصم التخصيصات المرحّلة';

comment on function public.validate_voucher_allocations_capacity is
  'يتحقق من كل تخصيصات السند قبل الترحيل — مع قفل اختياري لمنع التزامن';
