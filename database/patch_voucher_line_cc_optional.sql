-- =============================================================================
-- patch_voucher_line_cc_optional.sql (#26)
-- =============================================================================
-- استبدال شرط مركز الكلفة المعتمد على نص «تصفية —%» بعلم cc_optional صريح.
-- =============================================================================

alter table public.voucher_lines
  add column if not exists cc_optional boolean not null default false;

comment on column public.voucher_lines.cc_optional is
  'عند true يُعفى السطر من إلزامية مركز الكلفة (مثلاً أسطر حساب التصفية المقابلة)';

update public.voucher_lines
set cc_optional = true
where coalesce(line_description, '') like 'تصفية —%';

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
        and not coalesce(vl.cc_optional, false)
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

-- ---------------------------------------------------------------------------
-- تحقق عند الترحيل
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
          and not coalesce(vl.cc_optional, false)
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
