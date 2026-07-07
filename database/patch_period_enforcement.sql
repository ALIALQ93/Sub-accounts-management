-- =============================================================================
-- patch_period_enforcement.sql — قفل الفترة + قيود مقاصة CC/فرع عند الترحيل
-- =============================================================================
-- يتطلب: patch_accounting_periods.sql + patch_settlement_foundation.sql
-- =============================================================================

create or replace function public.assert_accounting_period_open(
  p_entry_date date,
  p_branch_id uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_closed record;
begin
  if p_entry_date is null then
    return;
  end if;

  select ap.period_code, ap.name_ar
  into v_closed
  from public.accounting_periods ap
  where ap.is_active = true
    and ap.status = 'closed'
    and p_entry_date between ap.start_date and ap.end_date
    and (
      ap.branch_id is null
      or (p_branch_id is not null and ap.branch_id = p_branch_id)
    )
  order by ap.branch_id nulls last
  limit 1;

  if found then
    raise exception 'Accounting period % (%) is closed for date %.',
      v_closed.period_code, v_closed.name_ar, p_entry_date;
  end if;
end;
$$;

comment on function public.assert_accounting_period_open(date, uuid) is
  'يمنع الترحيل داخل فترة محاسبية مغلقة (عامة أو للفرع)';

-- ---------------------------------------------------------------------------
-- ترحيل السند + قيود مقاصة CC/فرع
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
  v_netting record;
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
        branch_id = new.branch_id,
        updated_at = now()
      where id = old.journal_entry_id;
    end if;

    return new;
  end if;

  if new.status = 'posted' and old.status <> 'posted' then
    perform public.assert_accounting_period_open(new.voucher_date, new.branch_id);

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
      source_id,
      branch_id
    )
    values (
      v_entry_no,
      new.voucher_date,
      coalesce(new.description, 'Auto-posted from voucher ' || new.voucher_no),
      'posted',
      'voucher',
      new.id,
      new.branch_id
    )
    returning id into v_je_id;

    insert into public.journal_entry_lines (
      journal_entry_id,
      account_id,
      debit,
      credit,
      line_description,
      cost_center_id,
      branch_id,
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
      new.branch_id,
      new.currency_id,
      v_rate,
      case when vl.side = 'debit' then public.to_base_amount(vl.amount, v_rate) else 0 end,
      case when vl.side = 'credit' then public.to_base_amount(vl.amount, v_rate) else 0 end
    from public.voucher_lines vl
    left join public.voucher_line_categories vlc on vlc.id = vl.line_category_id
    where vl.voucher_id = new.id;

    for v_netting in
      select *
      from public.voucher_netting_lines vnl
      where vnl.voucher_id = new.id
        and vnl.amount > 0
    loop
      if v_netting.inter_account_id is null then
        raise exception 'Netting line requires inter_account_id.';
      end if;

      if v_netting.netting_kind = 'cc' then
        insert into public.journal_entry_lines (
          journal_entry_id,
          account_id,
          debit,
          credit,
          line_description,
          cost_center_id,
          branch_id,
          currency_id,
          exchange_rate,
          debit_base,
          credit_base
        )
        values (
          v_je_id,
          v_netting.inter_account_id,
          v_netting.amount,
          0,
          coalesce(v_netting.note, 'مقاصة CC — مدين'),
          v_netting.to_cc_id,
          new.branch_id,
          new.currency_id,
          v_rate,
          public.to_base_amount(v_netting.amount, v_rate),
          0
        );

        insert into public.journal_entry_lines (
          journal_entry_id,
          account_id,
          debit,
          credit,
          line_description,
          cost_center_id,
          branch_id,
          currency_id,
          exchange_rate,
          debit_base,
          credit_base
        )
        values (
          v_je_id,
          v_netting.inter_account_id,
          0,
          v_netting.amount,
          coalesce(v_netting.note, 'مقاصة CC — دائن'),
          v_netting.from_cc_id,
          new.branch_id,
          new.currency_id,
          v_rate,
          0,
          public.to_base_amount(v_netting.amount, v_rate)
        );
      elsif v_netting.netting_kind = 'branch' then
        insert into public.journal_entry_lines (
          journal_entry_id,
          account_id,
          debit,
          credit,
          line_description,
          cost_center_id,
          branch_id,
          currency_id,
          exchange_rate,
          debit_base,
          credit_base
        )
        values (
          v_je_id,
          v_netting.inter_account_id,
          v_netting.amount,
          0,
          coalesce(v_netting.note, 'مقاصة فرع — مدين'),
          null,
          v_netting.to_branch_id,
          new.currency_id,
          v_rate,
          public.to_base_amount(v_netting.amount, v_rate),
          0
        );

        insert into public.journal_entry_lines (
          journal_entry_id,
          account_id,
          debit,
          credit,
          line_description,
          cost_center_id,
          branch_id,
          currency_id,
          exchange_rate,
          debit_base,
          credit_base
        )
        values (
          v_je_id,
          v_netting.inter_account_id,
          0,
          v_netting.amount,
          coalesce(v_netting.note, 'مقاصة فرع — دائن'),
          null,
          v_netting.from_branch_id,
          new.currency_id,
          v_rate,
          0,
          public.to_base_amount(v_netting.amount, v_rate)
        );
      end if;
    end loop;

    new.journal_entry_id := v_je_id;
  end if;

  return new;
end;
$$;
