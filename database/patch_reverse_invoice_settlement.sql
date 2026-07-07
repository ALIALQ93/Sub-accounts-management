-- =============================================================================
-- patch_reverse_invoice_settlement.sql (#29)
-- =============================================================================
-- عكس سندات إغلاق الحركات/الفواتير: سند عكسي + إلغاء الأصلي لإعادة فتح التخصيصات.
-- يُصلح أيضاً دالة الترحيل (فترة محاسبية + مقاصة CC/فرع + cc_optional + حد التخصيص).
-- =============================================================================

create or replace function public.is_force_voucher_reverse()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.force_voucher_reverse', true), '') = 'on';
$$;

create or replace function public.vouchers_validate_parties()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_customer_active boolean;
  v_vendor_active boolean;
begin
  if TG_OP = 'UPDATE' and new.status = 'posted' and old.status = 'posted' then
    if not public.is_admin()
      and not public.is_force_voucher_delete()
      and not public.is_force_voucher_reverse() then
      raise exception 'Posted voucher cannot be modified. Use reversal instead.';
    end if;
  end if;

  if new.customer_id is not null then
    select is_active into v_customer_active from public.customers where id = new.customer_id;
    if not coalesce(v_customer_active, false) then
      raise exception 'Referenced customer must be active.';
    end if;
  end if;

  if new.vendor_id is not null then
    select is_active into v_vendor_active from public.vendors where id = new.vendor_id;
    if not coalesce(v_vendor_active, false) then
      raise exception 'Referenced vendor must be active.';
    end if;
  end if;

  if new.settlement_mode = 'invoice' then
    if new.voucher_type not in ('receipt', 'payment') then
      raise exception 'Invoice settlement mode is allowed only for receipt/payment vouchers.';
    end if;

    if new.customer_id is null and new.vendor_id is null then
      raise exception 'Invoice settlement voucher requires a customer or vendor reference.';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- ترحيل السند — نسخة موحّدة (فترة + مقاصة + cc_optional + حد التخصيص + اعتماد)
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
  v_netting record;
begin
  if old.status = 'posted' then
    if public.is_force_voucher_delete() or public.is_force_voucher_reverse() then
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
    if old.status <> 'approved' then
      raise exception 'Voucher must be approved before posting.';
    end if;

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

create or replace function public.reverse_posted_voucher(p_voucher_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.vouchers%rowtype;
  v_new_id uuid;
  v_new_no varchar(40);
  v_suffix text;
  v_reversal_mode varchar(20);
begin
  if not public.has_permission('vouchers.edit') then
    raise exception 'Permission denied: vouchers.edit required.';
  end if;

  select * into v_src from public.vouchers where id = p_voucher_id;
  if not found then
    raise exception 'Voucher not found.';
  end if;

  if v_src.status = 'cancelled' then
    raise exception 'Voucher is already cancelled.';
  end if;

  if v_src.status <> 'posted' then
    raise exception 'Only posted vouchers can be reversed.';
  end if;

  if v_src.voucher_no like 'RV-%' then
    raise exception 'Cannot reverse a reversal voucher.';
  end if;

  v_reversal_mode := case
    when v_src.settlement_mode = 'invoice' then 'account'
    else v_src.settlement_mode
  end;

  v_suffix := right(
    floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text,
    6
  );
  v_new_no := 'RV-' || v_src.voucher_no || '-' || v_suffix;
  if length(v_new_no) > 40 then
    v_new_no := left(v_new_no, 40);
  end if;

  perform set_config('app.force_voucher_reverse', 'on', true);

  insert into public.vouchers (
    voucher_no,
    voucher_type,
    settlement_mode,
    voucher_date,
    description,
    status,
    customer_id,
    vendor_id,
    currency_id,
    exchange_rate,
    cost_center_id,
    branch_id
  )
  values (
    v_new_no,
    v_src.voucher_type,
    v_reversal_mode,
    current_date,
    'عكس السند ' || v_src.voucher_no,
    'approved',
    v_src.customer_id,
    v_src.vendor_id,
    v_src.currency_id,
    v_src.exchange_rate,
    v_src.cost_center_id,
    v_src.branch_id
  )
  returning id into v_new_id;

  insert into public.voucher_lines (
    voucher_id,
    account_id,
    side,
    amount,
    line_description,
    cost_center_id,
    line_category_id,
    category_quantity,
    cc_optional
  )
  select
    v_new_id,
    vl.account_id,
    case when vl.side = 'debit' then 'credit' else 'debit' end,
    vl.amount,
    coalesce('عكس: ' || nullif(trim(vl.line_description), ''), 'عكس سطر'),
    vl.cost_center_id,
    vl.line_category_id,
    vl.category_quantity,
    vl.cc_optional
  from public.voucher_lines vl
  where vl.voucher_id = p_voucher_id;

  insert into public.voucher_netting_lines (
    voucher_id,
    netting_kind,
    from_cc_id,
    to_cc_id,
    from_branch_id,
    to_branch_id,
    amount,
    currency_id,
    includes_cash,
    inter_account_id,
    note
  )
  select
    v_new_id,
    vnl.netting_kind,
    vnl.to_cc_id,
    vnl.from_cc_id,
    vnl.to_branch_id,
    vnl.from_branch_id,
    vnl.amount,
    vnl.currency_id,
    vnl.includes_cash,
    vnl.inter_account_id,
    coalesce('عكس: ' || nullif(trim(vnl.note), ''), vnl.note)
  from public.voucher_netting_lines vnl
  where vnl.voucher_id = p_voucher_id
    and vnl.amount > 0;

  update public.vouchers
  set status = 'posted', updated_at = now()
  where id = v_new_id;

  update public.vouchers
  set
    status = 'cancelled',
    description = trim(both from coalesce(description, '') || ' — مُعكوس بـ ' || v_new_no),
    updated_at = now()
  where id = p_voucher_id;

  perform set_config('app.force_voucher_reverse', 'off', true);

  return v_new_id;
exception
  when others then
    perform set_config('app.force_voucher_reverse', 'off', true);
    raise;
end;
$$;

grant execute on function public.reverse_posted_voucher(uuid) to authenticated;

comment on function public.reverse_posted_voucher(uuid) is
  'عكس سند مرحّل: سند عكسي مرحّل + إلغاء الأصلي (يُعيد فتح التخصيصات لسندات invoice)';
