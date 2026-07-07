-- =============================================================================
-- patch_invoice_discount_rounding.sql — خصم الفاتورة، تدوير، حجز مخزون
-- =============================================================================
-- يتطلب: patch_invoice_reservation_discount.sql
-- الترتيب: patch #10
-- =============================================================================

-- ---------------------------------------------------------------------------
-- خصم تجاري على أسطر المواد والفاتورة
-- ---------------------------------------------------------------------------

alter table public.invoice_material_lines
  add column if not exists discount_percent numeric(5, 2) null
    check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100));

alter table public.invoice_material_lines
  add column if not exists discount_amount numeric(18, 2) not null default 0
    check (discount_amount >= 0);

alter table public.invoices
  add column if not exists invoice_discount_percent numeric(5, 2) null
    check (invoice_discount_percent is null or (invoice_discount_percent >= 0 and invoice_discount_percent <= 100));

alter table public.invoices
  add column if not exists invoice_discount_amount numeric(18, 2) not null default 0
    check (invoice_discount_amount >= 0);

-- ---------------------------------------------------------------------------
-- محفز أسطر المواد — مبلغ صافٍ بعد الخصم
-- ---------------------------------------------------------------------------

create or replace function public.invoice_material_lines_apply_quantities()
returns trigger
language plpgsql
as $$
declare
  v_gross numeric(18, 4);
  v_discount numeric(18, 2);
begin
  if not exists (
    select 1 from public.material_units mu
    where mu.id = new.material_unit_id
      and mu.material_id = new.material_id
  ) then
    raise exception 'material_unit_id does not belong to material_id.';
  end if;

  new.quantity_base := public.material_quantity_to_base(new.material_unit_id, new.quantity);
  v_gross := new.quantity * new.unit_price;

  if new.discount_percent is not null and new.discount_percent > 0 then
    v_discount := round((v_gross * new.discount_percent / 100)::numeric, 2);
    new.discount_amount := v_discount;
  else
    v_discount := coalesce(new.discount_amount, 0);
    if v_discount > v_gross then
      raise exception 'discount_amount cannot exceed line gross amount.';
    end if;
  end if;

  new.line_amount := round((v_gross - v_discount)::numeric, 2);

  if exists (
    select 1 from public.warehouses w
    where w.id = new.warehouse_id
      and w.branch_id <> new.branch_id
  ) then
    raise exception 'warehouse branch must match line branch_id.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- حجز المخزون لمسودات الفواتير
-- ---------------------------------------------------------------------------

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  invoice_line_id uuid not null references public.invoice_material_lines(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  quantity numeric(18, 6) not null check (quantity > 0),
  quantity_base numeric(18, 6) not null check (quantity_base > 0),
  status varchar(20) not null default 'active'
    check (status in ('active', 'released', 'fulfilled')),
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_line_id)
);

create index if not exists idx_inventory_reservations_invoice
  on public.inventory_reservations(invoice_id, status);
create index if not exists idx_inventory_reservations_material_wh
  on public.inventory_reservations(material_id, warehouse_id, status);

alter table public.inventory_reservations enable row level security;

drop policy if exists "inventory_reservations_all" on public.inventory_reservations;
create policy "inventory_reservations_all" on public.inventory_reservations
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_inventory_reservations_updated_at on public.inventory_reservations;
create trigger trg_inventory_reservations_updated_at
before update on public.inventory_reservations
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- مزامنة حجوزات الفاتورة بعد الحفظ
-- ---------------------------------------------------------------------------

create or replace function public.sync_invoice_reservations(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_pat public.invoice_patterns%rowtype;
  v_expires timestamptz;
  v_row record;
begin
  select * into v_inv from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'invoice not found.';
  end if;

  select * into v_pat from public.invoice_patterns where id = v_inv.pattern_id;

  if v_inv.status <> 'draft'
     or not v_pat.reservation_enabled
     or not v_pat.reserve_on_save
     or not v_pat.warehouse_movement then
    update public.inventory_reservations
    set status = 'released', updated_at = now()
    where invoice_id = p_invoice_id and status = 'active';
    return;
  end if;

  v_expires := case
    when v_pat.reservation_days is not null and v_pat.reservation_days > 0
    then now() + (v_pat.reservation_days || ' days')::interval
    else null
  end;

  update public.inventory_reservations
  set status = 'released', updated_at = now()
  where invoice_id = p_invoice_id
    and status = 'active'
    and invoice_line_id not in (
      select id from public.invoice_material_lines where invoice_id = p_invoice_id
    );

  for v_row in
    select iml.*
    from public.invoice_material_lines iml
    where iml.invoice_id = p_invoice_id
  loop
    insert into public.inventory_reservations (
      invoice_id, invoice_line_id, material_id, warehouse_id,
      quantity, quantity_base, status, expires_at
    )
    values (
      p_invoice_id, v_row.id, v_row.material_id, v_row.warehouse_id,
      v_row.quantity, v_row.quantity_base, 'active', v_expires
    )
    on conflict (invoice_line_id) do update set
      material_id = excluded.material_id,
      warehouse_id = excluded.warehouse_id,
      quantity = excluded.quantity,
      quantity_base = excluded.quantity_base,
      status = 'active',
      expires_at = excluded.expires_at,
      updated_at = now();
  end loop;
end;
$$;

grant execute on function public.sync_invoice_reservations(uuid) to authenticated;

-- تحرير الحجز عند الترحيل
create or replace function public.release_invoice_reservations(p_invoice_id uuid, p_status varchar)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inventory_reservations
  set status = p_status, updated_at = now()
  where invoice_id = p_invoice_id and status = 'active';
end;
$$;

grant execute on function public.release_invoice_reservations(uuid, varchar) to authenticated;
