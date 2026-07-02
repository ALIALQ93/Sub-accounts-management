-- =============================================================================
-- patch_admin_edit_posted_vouchers.sql
-- =============================================================================
-- يسمح لمدير النظام (role = admin) بتعديل السندات المرحّلة
-- ويحدّث قيد اليومية المرتبط عبر sync_posted_voucher_journal().
-- =============================================================================

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
    cost_center_id
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
    vl.cost_center_id
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

create or replace function public.vouchers_validate_parties()
returns trigger
language plpgsql
as $$
declare
  v_customer_active boolean;
  v_vendor_active boolean;
begin
  if TG_OP = 'UPDATE' and new.status = 'posted' and old.status = 'posted' then
    if not public.is_admin() then
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

create or replace function public.voucher_lines_validate_account_is_postable()
returns trigger
language plpgsql
as $$
declare
  v_is_postable boolean;
  v_is_active boolean;
  v_voucher_status varchar(20);
begin
  select status
  into v_voucher_status
  from public.vouchers
  where id = new.voucher_id;

  if v_voucher_status = 'posted' and not public.is_admin() then
    raise exception 'Posted voucher lines cannot be changed.';
  end if;

  select is_postable, is_active
  into v_is_postable, v_is_active
  from public.accounts
  where id = new.account_id;

  if not v_is_postable then
    raise exception 'Voucher posting is allowed only on leaf/postable accounts.';
  end if;

  if not v_is_active then
    raise exception 'Voucher posting is not allowed on inactive accounts.';
  end if;

  return new;
end;
$$;

create or replace function public.voucher_lines_prevent_delete_when_posted()
returns trigger
language plpgsql
as $$
declare
  v_voucher_status varchar(20);
begin
  select status
  into v_voucher_status
  from public.vouchers
  where id = old.voucher_id;

  if v_voucher_status = 'posted' and not public.is_admin() then
    raise exception 'Posted voucher lines cannot be deleted.';
  end if;

  return old;
end;
$$;

create or replace function public.voucher_allocations_validate()
returns trigger
language plpgsql
as $$
declare
  v_voucher_status varchar(20);
  v_settlement_mode varchar(20);
begin
  select status, settlement_mode
  into v_voucher_status, v_settlement_mode
  from public.vouchers
  where id = coalesce(new.voucher_id, old.voucher_id);

  if v_voucher_status = 'posted' and not public.is_admin() then
    raise exception 'Posted voucher allocations cannot be changed.';
  end if;

  if v_settlement_mode <> 'invoice' then
    raise exception 'Voucher allocations are allowed only for invoice settlement mode.';
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

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
      cost_center_id
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
      vl.cost_center_id
    from public.voucher_lines vl
    left join public.voucher_line_categories vlc on vlc.id = vl.line_category_id
    where vl.voucher_id = new.id;

    new.journal_entry_id := v_je_id;
  end if;

  return new;
end;
$$;
