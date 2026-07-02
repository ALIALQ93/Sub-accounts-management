-- Voucher numbering settings and sequences
-- Run after accounting_schema.sql

create table if not exists public.voucher_settings (
  id int primary key default 1 check (id = 1),
  auto_number_enabled boolean not null default true,
  allow_manual_override boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.voucher_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.voucher_number_sequences (
  voucher_type varchar(20) primary key
    check (voucher_type in ('receipt', 'payment', 'settlement')),
  prefix varchar(10) not null,
  padding int not null default 4 check (padding between 1 and 8),
  include_year boolean not null default true,
  last_number int not null default 0 check (last_number >= 0),
  sequence_year int not null default extract(year from current_date)::int,
  updated_at timestamptz not null default now()
);

insert into public.voucher_number_sequences (voucher_type, prefix, padding, include_year)
values
  ('receipt', 'RCP', 4, true),
  ('payment', 'PAY', 4, true),
  ('settlement', 'SET', 4, true)
on conflict (voucher_type) do nothing;

create or replace function public.format_voucher_no(
  p_prefix varchar,
  p_include_year boolean,
  p_year int,
  p_sequence int,
  p_padding int
)
returns varchar
language sql
immutable
as $$
  select case
    when p_include_year then
      p_prefix || '-' || p_year::text || '-' || lpad(p_sequence::text, p_padding, '0')
    else
      p_prefix || '-' || lpad(p_sequence::text, p_padding, '0')
  end;
$$;

create or replace function public.peek_voucher_no(p_voucher_type varchar)
returns varchar
language plpgsql
stable
as $$
declare
  v_row public.voucher_number_sequences%rowtype;
  v_year int := extract(year from current_date)::int;
  v_next int;
begin
  select * into v_row
  from public.voucher_number_sequences
  where voucher_type = p_voucher_type;

  if not found then
    raise exception 'Unknown voucher type: %', p_voucher_type;
  end if;

  v_next := v_row.last_number + 1;
  if v_row.include_year and v_row.sequence_year <> v_year then
    v_next := 1;
  end if;

  return public.format_voucher_no(
    v_row.prefix,
    v_row.include_year,
    v_year,
    v_next,
    v_row.padding
  );
end;
$$;

create or replace function public.reserve_voucher_no(p_voucher_type varchar)
returns varchar
language plpgsql
as $$
declare
  v_row public.voucher_number_sequences%rowtype;
  v_year int := extract(year from current_date)::int;
  v_next int;
  v_no varchar(40);
begin
  select * into v_row
  from public.voucher_number_sequences
  where voucher_type = p_voucher_type
  for update;

  if not found then
    raise exception 'Unknown voucher type: %', p_voucher_type;
  end if;

  if v_row.include_year and v_row.sequence_year <> v_year then
    v_row.last_number := 0;
    v_row.sequence_year := v_year;
  end if;

  v_next := v_row.last_number + 1;
  v_no := public.format_voucher_no(
    v_row.prefix,
    v_row.include_year,
    v_year,
    v_next,
    v_row.padding
  );

  update public.voucher_number_sequences
  set
    last_number = v_next,
    sequence_year = v_year,
    updated_at = now()
  where voucher_type = p_voucher_type;

  return v_no;
end;
$$;
