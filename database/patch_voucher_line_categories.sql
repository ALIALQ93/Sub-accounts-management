-- =============================================================================
-- patch_voucher_line_categories.sql
-- =============================================================================

create table if not exists public.voucher_line_categories (
  id uuid primary key default gen_random_uuid(),
  voucher_type varchar(20) not null
    check (voucher_type in ('receipt', 'payment', 'settlement')),
  code varchar(30) not null,
  name_ar varchar(200) not null,
  name_en varchar(200) null,
  requires_quantity boolean not null default false,
  quantity_label varchar(100) null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (voucher_type, code)
);

create index if not exists idx_voucher_line_categories_type_active
  on public.voucher_line_categories(voucher_type, is_active);

alter table public.voucher_lines
  add column if not exists line_category_id uuid null references public.voucher_line_categories(id) on delete restrict,
  add column if not exists category_quantity numeric(18, 4) null check (category_quantity is null or category_quantity >= 0);

create index if not exists idx_voucher_lines_category_id on public.voucher_lines(line_category_id);

drop trigger if exists trg_voucher_line_categories_updated_at on public.voucher_line_categories;
create trigger trg_voucher_line_categories_updated_at
before update on public.voucher_line_categories
for each row execute function public.set_updated_at();

-- لا بيانات افتراضية لتصنيفات الأسطر — تُعرَّف من التطبيق

-- تحديث دالة الترحيل (نسخ من 01_schema.sql — vouchers_before_update_handle_posting)
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
begin
  if old.status = 'posted' then
    raise exception 'Posted voucher cannot be modified. Use reversal instead.';
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
