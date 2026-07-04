-- patch_voucher_delete.sql
-- حذف السند مع القيد المحاسبي المولَّد عنه (بما في ذلك المرحّل)
-- Run in Supabase SQL Editor on existing databases.

create or replace function public.is_force_voucher_delete()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.force_voucher_delete', true), '') = 'on';
$$;

create or replace function public.vouchers_prevent_delete_when_posted()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'posted' and not public.is_force_voucher_delete() then
    raise exception 'Posted voucher cannot be deleted.';
  end if;

  return old;
end;
$$;

create or replace function public.vouchers_validate_parties()
returns trigger
language plpgsql
as $$
declare
  v_customer_active boolean;
  v_vendor_active boolean;
begin
  if TG_OP = 'UPDATE' and new.status = 'posted' and old.status = 'posted' then
    if not public.is_admin() and not public.is_force_voucher_delete() then
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

  if v_voucher_status = 'posted' and not public.is_admin() and not public.is_force_voucher_delete() then
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

  if v_voucher_status = 'posted'
    and not public.is_admin()
    and not public.is_force_voucher_delete() then
    raise exception 'Posted voucher allocations cannot be changed.';
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;

  if v_settlement_mode <> 'invoice' then
    raise exception 'Voucher allocations are allowed only for invoice settlement mode.';
  end if;

  return new;
end;
$$;

create or replace function public.voucher_attachments_validate()
returns trigger
language plpgsql
as $$
declare
  v_voucher_status varchar(20);
begin
  select status
  into v_voucher_status
  from public.vouchers
  where id = coalesce(new.voucher_id, old.voucher_id);

  if v_voucher_status in ('posted', 'cancelled')
    and not public.is_force_voucher_delete() then
    raise exception 'Voucher attachments cannot be changed for posted or cancelled vouchers.';
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

create or replace function public.delete_voucher_with_journal(p_voucher_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_journal_id uuid;
  v_blocking_count int;
begin
  if not public.has_permission('vouchers.delete') then
    raise exception 'Permission denied: vouchers.delete required.';
  end if;

  select * into v_voucher from public.vouchers where id = p_voucher_id;
  if not found then
    raise exception 'Voucher not found.';
  end if;

  if v_voucher.status = 'cancelled' then
    raise exception 'Cancelled voucher cannot be deleted.';
  end if;

  v_journal_id := v_voucher.journal_entry_id;

  if v_journal_id is not null then
    select count(*) into v_blocking_count
    from public.voucher_allocations va
    inner join public.journal_entry_lines jel on jel.id = va.target_journal_line_id
    where jel.journal_entry_id = v_journal_id
      and va.voucher_id <> p_voucher_id;

    if v_blocking_count > 0 then
      raise exception
        'Cannot delete voucher: journal lines are referenced by other voucher allocations.';
    end if;
  end if;

  perform set_config('app.force_voucher_delete', 'on', true);

  delete from public.voucher_allocations where voucher_id = p_voucher_id;

  if v_journal_id is not null then
    update public.vouchers
    set journal_entry_id = null, updated_at = now()
    where id = p_voucher_id;

    delete from public.journal_entries where id = v_journal_id;
  end if;

  delete from public.vouchers where id = p_voucher_id;

  perform set_config('app.force_voucher_delete', 'off', true);
exception
  when others then
    perform set_config('app.force_voucher_delete', 'off', true);
    raise;
end;
$$;

grant execute on function public.delete_voucher_with_journal(uuid) to authenticated;
